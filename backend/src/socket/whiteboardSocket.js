/**
 * Whiteboard Socket.IO Server Logic (JavaScript)
 * Manages real-time collaborative whiteboard sessions with room support
 */

const { getRedisClient } = require('../config/redis');

/**
 * Configuration for whiteboard validation
 */
const VALIDATION_CONFIG = {
  MAX_POINTS: 10000, // Maximum number of points in a path
  ALLOWED_TYPES: ['path', 'circle', 'rect', 'line', 'text', 'image'], // Allowed object types
  MAX_STROKE_WIDTH: 100, // Maximum stroke width
};

/**
 * In-memory storage for room states
 * Key: roomId, Value: { objects: [] }
 */
const roomStates = new Map();

/**
 * Validates a drawing payload to prevent malicious data
 * @param {Object} object - Drawing object to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function validateDrawingPayload(object) {
  if (!object || typeof object !== 'object') {
    return false;
  }

  // Check if object type is allowed
  if (!VALIDATION_CONFIG.ALLOWED_TYPES.includes(object.type)) {
    return false;
  }

  // Validate path points count if it's a path
  if (object.type === 'path' && object.path) {
    const pointCount = object.path.length;
    if (pointCount > VALIDATION_CONFIG.MAX_POINTS) {
      return false;
    }
  }

  // Validate stroke width
  if (object.strokeWidth && object.strokeWidth > VALIDATION_CONFIG.MAX_STROKE_WIDTH) {
    return false;
  }

  // Check for required properties based on type
  if (object.type === 'path' && !object.path) {
    return false;
  }

  return true;
}

/**
 * Gets or initializes a room state
 * @param {string} roomId - The room identifier
 * @returns {Object} - Room state object
 */
function getRoomState(roomId) {
  if (!roomStates.has(roomId)) {
    roomStates.set(roomId, { objects: [], users: [] });
  }
  return roomStates.get(roomId);
}

/**
 * Clean up empty room from memory and Redis
 * @param {string} roomId - The room identifier
 */
async function cleanupEmptyRoom(roomId) {
  const roomState = roomStates.get(roomId);

  // Check if room is empty
  if (roomState && roomState.users.length === 0) {
    console.log(`[Socket] Room ${roomId} is empty, cleaning up...`);

    // Delete from memory
    roomStates.delete(roomId);

    // Delete from Redis
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        await redisClient.del(`room:${roomId}`);
        console.log(`[Socket] Deleted room ${roomId} from Redis`);
      } catch (error) {
        console.error(`[Socket] Error deleting room ${roomId} from Redis:`, error);
      }
    }
  }
}

/**
 * Initializes Socket.IO server with whiteboard logic
 * @param {Object} io - Socket.IO server instance
 */
function initializeWhiteboardSocket(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    /**
     * Handle client joining a room
     */
    socket.on('join-room', (payload) => {
      const { roomId, userId, userName } = payload || {};

      if (!roomId || typeof roomId !== 'string') {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      // Store room info on socket for later use
      socket.currentRoomId = roomId;
      socket.userId = userId || socket.id;
      socket.userName = userName || `User-${socket.id.substring(0, 4)}`;

      // Join the room
      socket.join(roomId);
      console.log(`[Socket] Client ${socket.id} (${socket.userName}) joined room: ${roomId}`);

      // Get current room state
      const roomState = getRoomState(roomId);

      // Add user to room's user list if not already there
      const userExists = roomState.users.find(u => u.id === socket.userId);
      if (!userExists) {
        roomState.users.push({
          id: socket.userId,
          name: socket.userName,
          socketId: socket.id
        });
      }

      // Send current canvas state to the newly joined client
      socket.emit('room-state', roomState);
      console.log(`[Socket] Sent room state to ${socket.id} (${roomState.objects.length} objects)`);

      // Broadcast updated user list to all clients in the room
      io.to(roomId).emit('users-update', { users: roomState.users });
      console.log(`[Socket] Broadcasted user list to room ${roomId} (${roomState.users.length} users)`);
    });

    /**
     * Handle client leaving a room
     */
    socket.on('leave-room', async (payload) => {
      const { roomId } = payload || {};

      if (!roomId || typeof roomId !== 'string') {
        return;
      }

      // Remove user from room state
      const roomState = getRoomState(roomId);
      roomState.users = roomState.users.filter(u => u.socketId !== socket.id);

      socket.leave(roomId);
      console.log(`[Socket] Client ${socket.id} left room: ${roomId}`);

      // Broadcast updated user list
      io.to(roomId).emit('users-update', { users: roomState.users });

      // Clean up room if empty
      await cleanupEmptyRoom(roomId);
    });

    /**
     * Handle drawing events
     */
    socket.on('draw', (payload) => {
      const { roomId, object } = payload || {};

      // Validate payload structure
      if (!roomId || typeof roomId !== 'string' || !object) {
        socket.emit('error', { message: 'Invalid draw payload' });
        return;
      }

      // Validate drawing object
      if (!validateDrawingPayload(object)) {
        socket.emit('error', { message: 'Invalid drawing object' });
        console.log(`[Socket] Rejected invalid drawing object from ${socket.id}`);
        return;
      }

      // Add to room state
      const roomState = getRoomState(roomId);
      roomState.objects.push(object);

      // Broadcast to all clients in the room EXCEPT the sender
      // Emit the complete object structure that Fabric.js needs
      socket.to(roomId).emit('draw', { object });
      console.log(`[Socket] Broadcasted draw event in room ${roomId} (type: ${object.type})`);
    });

    /**
     * Handle object modification (move, resize, rotate)
     */
    socket.on('modify', (payload) => {
      const { roomId, object } = payload || {};

      if (!roomId || typeof roomId !== 'string' || !object || !object.id) {
        return;
      }

      const roomState = getRoomState(roomId);

      // Find and update object
      const index = roomState.objects.findIndex(obj => obj.id === object.id);
      if (index !== -1) {
        // Update the object with new properties
        roomState.objects[index] = { ...roomState.objects[index], ...object };

        // Broadcast modification
        socket.to(roomId).emit('modify', { object });
        console.log(`[Socket] Modified object ${object.id} in room ${roomId}`);
      }
    });

    /**
     * Handle object deletion
     */
    socket.on('delete', (payload) => {
      const { roomId, objectId } = payload || {};

      if (!roomId || typeof roomId !== 'string' || !objectId) {
        return;
      }

      const roomState = getRoomState(roomId);

      // Filter out the deleted object
      const initialLength = roomState.objects.length;
      roomState.objects = roomState.objects.filter(obj => obj.id !== objectId);

      if (roomState.objects.length < initialLength) {
        // Broadcast deletion
        socket.to(roomId).emit('delete', { objectId });
        console.log(`[Socket] Deleted object ${objectId} from room ${roomId}`);
      }
    });

    /**
     * Handle clear canvas events
     */
    socket.on('clear-canvas', (payload) => {
      const { roomId } = payload || {};

      if (!roomId || typeof roomId !== 'string') {
        return;
      }

      // Clear room state
      const roomState = getRoomState(roomId);
      roomState.objects = [];

      // Broadcast clear event to all clients in the room INCLUDING the sender
      io.to(roomId).emit('clear-canvas');
      console.log(`[Socket] Cleared canvas in room ${roomId}`);
    });



    /**
     * Handle client disconnect
     */
    socket.on('disconnect', async () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);

      // Remove user from their current room if they were in one
      if (socket.currentRoomId) {
        const roomState = getRoomState(socket.currentRoomId);
        roomState.users = roomState.users.filter(u => u.socketId !== socket.id);

        // Broadcast updated user list
        io.to(socket.currentRoomId).emit('users-update', { users: roomState.users });
        console.log(`[Socket] Removed user from room ${socket.currentRoomId}`);

        // Clean up room if empty
        await cleanupEmptyRoom(socket.currentRoomId);
      }
    });
  });

  console.log('[Socket] Whiteboard Socket.IO server initialized');
}

module.exports = { initializeWhiteboardSocket };
