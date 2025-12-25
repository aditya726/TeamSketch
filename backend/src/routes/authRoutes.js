const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const { register, login, getMe, googleAuthCallback } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: '/api/auth/google/failure'
  }),
  googleAuthCallback
);

// OAuth failure route
router.get('/google/failure', (req, res) => {
  res.status(401).json({
    success: false,
    message: 'Google authentication failed'
  });
});

// Protected routes (require authentication)
router.get('/me', protect, getMe);

module.exports = router;
