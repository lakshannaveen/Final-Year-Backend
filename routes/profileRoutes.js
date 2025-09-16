const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, uploadImage } = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Profile routes
router.get('/', requireAuth, getProfile);
router.put('/', requireAuth, updateProfile);
router.post('/upload', requireAuth, upload.single('image'), uploadImage);

module.exports = router;