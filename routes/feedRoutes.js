const express = require('express');
const router = express.Router();
const { 
  createFeed, 
  getFeedById, 
  uploadFeedMedia, 
  getFeedsPaginated,
  getMyFeedsPaginated,
  deleteFeed,
  updateFeed
} = require('../controllers/feedController');
const { requireAuth } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Create a post
router.post('/', requireAuth, createFeed);

// Infinite scroll paginated posts with user info
router.get('/paginated', getFeedsPaginated);



// Get logged-in user's own posts (paginated, infinite scroll)
router.get('/my-paginated', requireAuth, getMyFeedsPaginated);

// Get one post by ID
router.get('/:id', getFeedById);

// Upload photo/video for feed post
router.post('/upload', requireAuth, upload.single('file'), uploadFeedMedia);

// Delete a feed post (only owner)
router.delete('/:id', requireAuth, deleteFeed);

// Edit/update a feed post (only owner)
router.put('/:id', requireAuth, updateFeed);

module.exports = router;