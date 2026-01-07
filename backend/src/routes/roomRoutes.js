/**
 * Room Routes
 */

const express = require('express');
const router = express.Router();
const { createRoom, validateRoom, joinRoom } = require('../controllers/roomController');
const { protect } = require('../middleware/authMiddleware');

/**
 * @swagger
 * /api/rooms/create:
 *   post:
 *     summary: Create a new room (requires authentication)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Room created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 roomId:
 *                   type: string
 *                 message:
 *                   type: string
 *                 createdBy:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.post('/create', protect, createRoom);

/**
 * @swagger
 * /api/rooms/validate/{roomId}:
 *   get:
 *     summary: Validate a room ID format
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: The room ID to validate
 *     responses:
 *       200:
 *         description: Room ID validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 isValid:
 *                   type: boolean
 *                 roomId:
 *                   type: string
 */
router.get('/validate/:roomId', validateRoom);

/**
 * @swagger
 * /api/rooms/join:
 *   post:
 *     summary: Join a room (requires authentication)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               roomId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully joined room
 *       400:
 *         description: Invalid room ID
 *       401:
 *         description: Unauthorized
 */
router.post('/join', protect, joinRoom);

module.exports = router;
