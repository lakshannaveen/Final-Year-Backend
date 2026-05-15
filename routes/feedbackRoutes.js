const express = require('express');
const router = express.Router();
const { 
  submitFeedback,
  getAllFeedbacks,
  getFeedbackStats,
  updateFeedbackStatus,
  deleteFeedback
} = require('../controllers/feedbackController');
const { requireAuth } = require('../middleware/auth');

// Submit feedback (requires authentication)
router.post('/submit', requireAuth, submitFeedback);

// Admin routes (require authentication)
router.get('/admin/feedbacks', getAllFeedbacks);
router.get('/admin/stats',getFeedbackStats);
router.put('/admin/:feedbackId/status',updateFeedbackStatus);
router.delete('/admin/:feedbackId',deleteFeedback);

module.exports = router;