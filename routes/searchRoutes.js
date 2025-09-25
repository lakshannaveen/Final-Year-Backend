const express = require('express');
const router = express.Router();
const { searchFeeds } = require('../controllers/searchController');
const { requireAuth } = require('../middleware/auth');

router.get('/feed/search', requireAuth, searchFeeds);

module.exports = router;