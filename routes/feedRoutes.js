const express = require('express');
const router = express.Router();
const { createFeed, getFeedById, uploadFeedMedia, getAllFeedsWithUser, getMyFeeds } = require('../controllers/feedController');
const { requireAuth } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Create a post
router.post('/', requireAuth, createFeed);

// Get all posts with user info
router.get('/all', getAllFeedsWithUser);

// Get logged-in user's own posts
router.get('/my', requireAuth, getMyFeeds);

// Get one post by ID
router.get('/:id', getFeedById);

// Upload photo/video for feed post
router.post('/upload', requireAuth, upload.single('file'), uploadFeedMedia);

module.exports = router;