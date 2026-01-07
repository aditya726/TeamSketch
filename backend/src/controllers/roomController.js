/**
 * Room Controller - Handles room creation and management
 */

const crypto = require('crypto');
const { getRedisClient } = require('../config/redis');

// Room expiry time (24 hours in seconds)
const ROOM_EXPIRY = 24 * 60 * 60;

/**
 * Generate a unique room ID
 * @returns {string} - Unique room ID
 */
function generateRoomId() {
  // Generate a random 8-character room ID
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Create a new room (requires authentication)
 * @route POST /api/rooms/create
 * @access Private
 */
exports.createRoom = async (req, res) => {
  try {
    // Generate unique room ID
    const roomId = generateRoomId();
    
    // Store room in Redis with expiry
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        const roomData = JSON.stringify({
          id: roomId,
          createdBy: req.user.id,
          createdAt: new Date().toISOString(),
          creatorName: req.user.username || req.user.email
        });
        
        // Store room with 24-hour expiry
        await redisClient.setEx(`room:${roomId}`, ROOM_EXPIRY, roomData);
        console.log(`[Room] Created room ${roomId} in Redis`);
      } catch (redisError) {
        console.error('[Room] Redis error, continuing without storage:', redisError);
      }
    }

    // Return the room ID
    res.status(200).json({
      success: true,
      roomId,
      message: 'Room created successfully',
      createdBy: req.user.id
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create room'
    });
  }
};

/**
 * Validate a room ID format
 * @route GET /api/rooms/validate/:roomId
 * @access Public
 */
exports.validateRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    // First check format - must be 8 hex characters
    const isValidFormat = /^[A-F0-9]{8}$/.test(roomId);
    
    if (!isValidFormat) {
      return res.status(200).json({
        success: true,
        isValid: false,
        roomId,
        reason: 'Invalid format'
      });
    }

    // Check if room exists in Redis
    const redisClient = getRedisClient();
    let roomExists = true; // Default to true if Redis is not available
    
    if (redisClient) {
      try {
        const roomData = await redisClient.get(`room:${roomId}`);
        roomExists = roomData !== null;
        
        if (roomExists) {
          // Refresh room expiry when validated
          await redisClient.expire(`room:${roomId}`, ROOM_EXPIRY);
        }
      } catch (redisError) {
        console.error('[Room] Redis error during validation:', redisError);
        // If Redis fails, allow joining (graceful degradation)
        roomExists = true;
      }
    }

    res.status(200).json({
      success: true,
      isValid: roomExists,
      roomId,
      reason: roomExists ? 'Valid' : 'Room not found'
    });
  } catch (error) {
    console.error('Error validating room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate room'
    });
  }
};

/**
 * Join a room (requires authentication and validates room ID)
 * @route POST /api/rooms/join
 * @access Private
 */
exports.joinRoom = async (req, res) => {
  try {
    const { roomId } = req.body;

    // Validate room ID format
    if (!roomId || typeof roomId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Room ID is required'
      });
    }

    // Check if room ID has valid format (8 hex characters)
    const isValidFormat = /^[A-F0-9]{8}$/.test(roomId);
    
    if (!isValidFormat) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room ID format'
      });
    }

    // Check if room exists in Redis
    const redisClient = getRedisClient();
    let roomExists = true; // Default to true if Redis is not available
    
    if (redisClient) {
      try {
        const roomData = await redisClient.get(`room:${roomId}`);
        roomExists = roomData !== null;
        
        if (!roomExists) {
          return res.status(404).json({
            success: false,
            message: 'Room not found or has expired'
          });
        }
        
        // Refresh room expiry when someone joins
        await redisClient.expire(`room:${roomId}`, ROOM_EXPIRY);
        console.log(`[Room] User ${req.user.id} joined room ${roomId}`);
      } catch (redisError) {
        console.error('[Room] Redis error during join:', redisError);
        // If Redis fails, allow joining (graceful degradation)
      }
    }

    res.status(200).json({
      success: true,
      roomId,
      message: 'Room validated successfully',
      userId: req.user.id
    });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join room'
    });
  }
};

