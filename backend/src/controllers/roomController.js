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
