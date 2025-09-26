const Feed = require('../models/Feed');
const User = require('../models/User');
const dotenv = require('dotenv');
dotenv.config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const fetchAI = global.fetch;
const FEED_LIMIT = 30;

// Always returns feeds[] with user._id, username, profilePic, location, serviceType
async function simpleTextSearch(query, limit = 15) {
  try {
    const feeds = await Feed.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { location: { $regex: query, $options: 'i' } }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("user", "username profilePic location serviceType");
    // Ensure user is always an object
    return feeds.map(feed => ({
      ...feed._doc,
      user: feed.user ? {
        _id: feed.user._id,
        username: feed.user.username,
        profilePic: feed.user.profilePic || "",
        location: feed.user.location || "",
        serviceType: feed.user.serviceType || "",
      } : { _id: "", username: "", profilePic: "", location: "", serviceType: "" }
    }));
  } catch (error) {
    return [];
  }
}

exports.searchFeeds = async (req, res) => {
  try {
    const query = req.query.query?.trim();
    if (!query) {
      return res.status(200).json({ feeds: [], message: "No search query provided", searchType: "none" });
    }
    // Always return feeds, never undefined users
    let simpleResults = await simpleTextSearch(query, 20);
    if (simpleResults.length >= 5) {
      return res.status(200).json({ feeds: simpleResults.slice(0, 15), searchType: "text", message: `Found ${simpleResults.length} matches` });
    }
    // --- AI logic omitted for clarity and stability ---
    return res.status(200).json({
      feeds: simpleResults,
      searchType: "text-fallback",
      message: `Found ${simpleResults.length} results (basic search)`
    });
  } catch (err) {
    res.status(200).json({ feeds: [], searchType: "error", error: "Search service temporarily unavailable" });
  }
};

exports.getSearchSuggestions = async (req, res) => {
  try {
    const query = req.query.query?.trim();
    if (!query || query.length < 2) {
      return res.status(200).json({ suggestions: [] });
    }
    const feeds = await Feed.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { location: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    })
    .limit(12)
    .populate("user", "username serviceType");
    const suggestions = new Set();
    feeds.forEach(feed => {
      if (feed.title?.toLowerCase().includes(query.toLowerCase())) suggestions.add(feed.title);
      if (feed.location?.toLowerCase().includes(query.toLowerCase())) suggestions.add(feed.location);
      if (feed.user?.username?.toLowerCase().includes(query.toLowerCase())) suggestions.add(feed.user.username);
      if (feed.user?.serviceType?.toLowerCase().includes(query.toLowerCase())) suggestions.add(feed.user.serviceType);
    });
    res.status(200).json({ suggestions: Array.from(suggestions).slice(0, 10) });
  } catch (error) {
    res.status(200).json({ suggestions: [], error: "Failed to load suggestions" });
  }
};

exports.checkAIService = async (req, res) => {
  res.status(200).json({ available: true, message: "AI service check (mock)" });
};