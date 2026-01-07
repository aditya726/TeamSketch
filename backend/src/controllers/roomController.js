/**
 * Room Controller - Handles room creation and management
 */

const crypto = require('crypto');

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

    // Simple validation - check if it's a valid format (8 hex characters)
    const isValid = /^[A-F0-9]{8}$/.test(roomId);

    res.status(200).json({
      success: true,
      isValid,
      roomId
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
    const isValid = /^[A-F0-9]{8}$/.test(roomId);
    
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room ID format'
      });
    }

    // In a real app, you might want to check if the room exists in a database
    // For now, we'll just validate the format and allow joining

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
