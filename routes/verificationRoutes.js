const express = require('express');
const router = express.Router();
const {
  submitVerification,
  getVerificationStatus,
  getAllVerifications,
  updateVerificationStatus
} = require('../controllers/verificationController');
const { requireAuth } = require('../middleware/auth');
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// User routes (require authentication)
router.post('/submit', 
  requireAuth,
  upload.fields([
    { name: 'nicFront', maxCount: 1 },
    { name: 'nicBack', maxCount: 1 },
    { name: 'dlFront', maxCount: 1 },
    { name: 'dlBack', maxCount: 1 },
    { name: 'businessCert', maxCount: 1 }
  ]),
  submitVerification
);

router.get('/status', requireAuth, getVerificationStatus);

// Testing routes (no auth required for development)
router.get('/all', getAllVerifications);
router.put('/:verificationId', updateVerificationStatus);

module.exports = router;