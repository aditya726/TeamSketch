/**
 * Whiteboard Socket.IO Server Logic (JavaScript)
 * Manages real-time collaborative whiteboard sessions with room support
 */

/**
 * Configuration for whiteboard validation
 */
const VALIDATION_CONFIG = {
  MAX_POINTS: 10000, // Maximum number of points in a path
  ALLOWED_TYPES: ['path', 'circle', 'rect', 'line', 'text'], // Allowed object types
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
    roomStates.set(roomId, { objects: [] });
  }
  return roomStates.get(roomId);
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
      const { roomId } = payload || {};

      if (!roomId || typeof roomId !== 'string') {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      // Join the room
      socket.join(roomId);
      console.log(`[Socket] Client ${socket.id} joined room: ${roomId}`);

      // Get current room state
      const roomState = getRoomState(roomId);

      // Send current canvas state to the newly joined client
      socket.emit('room-state', roomState);
      console.log(`[Socket] Sent room state to ${socket.id} (${roomState.objects.length} objects)`);
    });

    /**
     * Handle client leaving a room
     */
    socket.on('leave-room', (payload) => {
      const { roomId } = payload || {};

      if (!roomId || typeof roomId !== 'string') {
        return;
      }

      socket.leave(roomId);
      console.log(`[Socket] Client ${socket.id} left room: ${roomId}`);
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
      socket.to(roomId).emit('draw', { object });
      console.log(`[Socket] Broadcasted draw event in room ${roomId} (type: ${object.type})`);
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
    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  console.log('[Socket] Whiteboard Socket.IO server initialized');
}

module.exports = { initializeWhiteboardSocket };
