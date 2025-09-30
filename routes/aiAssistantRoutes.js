const express = require('express');
const router = express.Router();
const { chatWithAI, getUsage } = require('../controllers/aiAssistantController');

// No authentication required for basic AI access
router.post('/ai/chat', chatWithAI);
router.get('/ai/usage', getUsage);

module.exports = router;