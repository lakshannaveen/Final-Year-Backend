const express = require('express');
const router = express.Router();
const { aiChat, getAIUsage } = require('../controllers/huggingfaceController');

// No authentication middleware needed
router.post('/huggingface/chat', aiChat);
router.get('/huggingface/usage', getAIUsage);

module.exports = router;