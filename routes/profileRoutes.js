const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, uploadImage, getPublicProfile } = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', requireAuth, getProfile);
router.put('/', requireAuth, updateProfile);
router.post('/upload', requireAuth, upload.single('image'), uploadImage);

// Public profile route
router.get('/public/:idOrUsername', getPublicProfile);

module.exports = router;