const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, getProfile);
router.put('/', requireAuth, updateProfile); 

module.exports = router;