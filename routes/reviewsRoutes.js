const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  createReview,
  getUserReviews,
  updateReview,
  deleteReview,
  checkUserReview
} = require('../controllers/reviewsController');

// Only protect review actions, not public GET
router.post('/', requireAuth, createReview);
router.get('/check/:reviewedUserId', requireAuth, checkUserReview);
router.put('/:reviewId', requireAuth, updateReview);
router.delete('/:reviewId', requireAuth, deleteReview);

// Public: anyone can see reviews for a user
router.get('/user/:userId', getUserReviews);

module.exports = router;