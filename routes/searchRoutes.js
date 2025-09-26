const express = require('express');
const router = express.Router();
const {
  searchFeeds,
  getSearchSuggestions,
  checkAIService
} = require('../controllers/searchController');

router.get('/feeds/search', searchFeeds);
router.get('/feeds/suggestions', getSearchSuggestions);
router.get('/feeds/ai-status', checkAIService);

module.exports = router;