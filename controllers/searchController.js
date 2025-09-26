const Feed = require('../models/Feed');
const User = require('../models/User');
const dotenv = require('dotenv');
dotenv.config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const fetch = global.fetch || require('node-fetch'); // For Node < 18
const SERVICE_TYPES = [
  "plumber", "electrician", "carpenter", "cleaner", "repair",
  "gardener", "driver", "mechanic", "chef", "babysitter"
];
const LOCATIONS = [
  "galle", "colombo", "kandy", "negombo", "matara", "jaffna", "kurunegala",
  "anuradhapura", "ratnapura", "batticaloa", "trincomalee", "badulla"
];

function parseSearchQuery(query) {
  const q = query.toLowerCase();
  let serviceType = null, location = null;
  for (const service of SERVICE_TYPES) {
    if (q.includes(service)) {
      serviceType = service;
      break;
    }
  }
  for (const loc of LOCATIONS) {
    if (q.includes(loc)) {
      location = loc;
      break;
    }
  }
  return { serviceType, location };
}

async function smartFeedSearch(query, limit = 15) {
  const { serviceType, location } = parseSearchQuery(query);
  const mongoQuery = {};
  if (serviceType) {
    mongoQuery["$or"] = [
      { "title": new RegExp(serviceType, "i") },
      { "description": new RegExp(serviceType, "i") },
      { "user.serviceType": new RegExp(serviceType, "i") }
    ];
  }
  if (location) {
    mongoQuery["location"] = new RegExp(location, "i");
  }
  if (!serviceType && !location) {
    return await Feed.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { location: { $regex: query, $options: 'i' } }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("user", "username profilePic location serviceType");
  }
  return await Feed.find(mongoQuery)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("user", "username profilePic location serviceType");
}

async function deepseekAISearch(query, limit = 15) {
  if (!DEEPSEEK_API_KEY) return [];
  // Prepare all feeds for embedding search
  const feeds = await Feed.find({}).limit(200).populate("user", "username profilePic location serviceType");
  const documents = feeds.map(feed => ({
    id: feed._id.toString(),
    text: `${feed.title} ${feed.description} ${feed.location} ${feed.user?.serviceType || ""} ${feed.user?.username || ""}`,
  }));
  // Call DeepSeek API for semantic search
  try {
    const deepseekRes = await fetch("https://api.deepseek.com/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        documents,
        limit,
      }),
    });
    const deepseekData = await deepseekRes.json();
    if (!deepseekRes.ok || !deepseekData.results) return [];
    // Match feed IDs
    const resultIds = deepseekData.results.map(r => r.id);
    const matchedFeeds = feeds.filter(feed => resultIds.includes(feed._id.toString()));
    // Always shape user fields
    return matchedFeeds.map(feed => ({
      ...feed._doc,
      user: feed.user ? {
        _id: feed.user._id,
        username: feed.user.username,
        profilePic: feed.user.profilePic || "",
        location: feed.user.location || "",
        serviceType: feed.user.serviceType || "",
      } : { _id: "", username: "", profilePic: "", location: "", serviceType: "" }
    }));
  } catch (err) {
    return [];
  }
}

exports.searchFeeds = async (req, res) => {
  try {
    const query = req.query.query?.trim();
    if (!query) {
      return res.status(200).json({ feeds: [], message: "No search query provided", searchType: "none" });
    }
    // 1. Smart keyword search
    let feeds = await smartFeedSearch(query, 20);
    feeds = feeds.map(feed => ({
      ...feed._doc,
      user: feed.user ? {
        _id: feed.user._id,
        username: feed.user.username,
        profilePic: feed.user.profilePic || "",
        location: feed.user.location || "",
        serviceType: feed.user.serviceType || "",
      } : { _id: "", username: "", profilePic: "", location: "", serviceType: "" }
    }));

    if (feeds.length >= 5) {
      return res.status(200).json({
        feeds: feeds.slice(0, 15),
        searchType: "text",
        message: `Found ${feeds.length} matches`
      });
    }

    // 2. Fallback to DeepSeek semantic search
    const aiFeeds = await deepseekAISearch(query, 15);
    if (aiFeeds.length > 0) {
      return res.status(200).json({
        feeds: aiFeeds,
        searchType: "ai",
        message: `Found ${aiFeeds.length} results (AI search)`
      });
    }

    // 3. Fallback to basic results
    return res.status(200).json({
      feeds,
      searchType: "text-fallback",
      message: `Found ${feeds.length} results (basic search)`
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
  res.status(200).json({ available: !!DEEPSEEK_API_KEY, message: "AI service check" });
};