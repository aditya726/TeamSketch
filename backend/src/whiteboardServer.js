/**
 * Whiteboard Server - Main Entry Point (JavaScript)
 * Express + Socket.IO server for collaborative whiteboarding
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const { initializeWhiteboardSocket } = require('./socket/whiteboardSocket');

const app = express();
const PORT = process.env.WHITEBOARD_PORT;
const FRONTEND_URL = process.env.FRONTEND_URL;

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'whiteboard-server',
    timestamp: new Date().toISOString() 
  });
});

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Initialize whiteboard Socket.IO logic
initializeWhiteboardSocket(io);

// Start server
httpServer.listen(PORT, () => {
  console.log('=================================');
  console.log('🎨 Whiteboard Server Started');
  console.log('=================================');
  console.log(`Port: ${PORT}`);
  console.log(`Frontend URL: ${FRONTEND_URL}`);
  console.log(`Health Check: http://localhost:${PORT}/health`);
  console.log('=================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
