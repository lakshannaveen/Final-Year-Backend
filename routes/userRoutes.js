const express = require('express');
const router = express.Router();
const passport = require("passport"); // <-- IMPORT PASSPORT!
const {
  register,
  login,
  logout,
  getCurrentUser,
  googleAuth,
  googleCallback
} = require('../controllers/registerController');
const { requireAuth } = require('../middleware/auth');

// Register & Login routes
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', getCurrentUser);

// Google OAuth: Pass serviceType as "state"
router.get('/google', (req, res, next) => {
  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: req.query.serviceType || "finding",
  })(req, res, next);
});

// Callback
router.get('/google/callback', googleCallback);

// Protected route example
router.get('/profile', requireAuth, (req, res) => {
  res.json({ message: 'Protected route accessed successfully', user: req.user });
});

module.exports = router;