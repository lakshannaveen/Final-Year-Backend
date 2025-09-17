const express = require('express');
const router = express.Router();
const {
  register,
  login,
  logout,
  getCurrentUser,
  googleAuth,
  googleCallback
} = require('../controllers/registerController');
const { requireAuth } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', getCurrentUser);

// Google OAuth
router.get('/google', googleAuth);
router.get('/google/callback',googleCallback);

// Protected route example
router.get('/profile', requireAuth, (req, res) => {
  res.json({ message: 'Protected route accessed successfully', user: req.user });
});

module.exports = router;