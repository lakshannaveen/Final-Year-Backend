const Feed = require('../models/Feed');
const User = require('../models/User');
const dotenv = require('dotenv');
dotenv.config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const fetchAI = global.fetch;
const FEED_LIMIT = 30;

async function getEmbedding(text) {
  if (!DEEPSEEK_API_KEY) {
    console.error("DeepSeek API key not configured");
    throw new Error("AI service not configured");
  }
  if (!text || typeof text !== "string" || text.trim().length < 3) {
    throw new Error("Query too short for embedding");
  }
  try {
    const res = await fetchAI('https://api.deepseek.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "deepseek-embedding-v2",
        input: text.trim().slice(0, 512)
      })
    });
    if (!res.ok) {
      const errorText = await res.text();
      console.error("DeepSeek API Error:", res.status, errorText);
      throw new Error(`AI service error: ${res.status} ${errorText}`);
    }
    const data = await res.json();
    if (!data.data || !Array.isArray(data.data) || !data.data[0].embedding) {
      throw new Error("Invalid response from AI service");
    }
    return data.data[0].embedding;
  } catch (error) {
    console.error("Embedding API call failed:", error);
    throw new Error("AI service unavailable");
  }
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  try {
    const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
    const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
    if (normA === 0 || normB === 0) return 0;
    return dot / (normA * normB);
  } catch (error) {
    return 0;
  }
}

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

    return feeds.filter(feed =>
      (feed.user?.username && feed.user.username.toLowerCase().includes(query.toLowerCase())) ||
      (feed.user?.serviceType && feed.user.serviceType.toLowerCase().includes(query.toLowerCase())) ||
      feed.title?.toLowerCase().includes(query.toLowerCase()) ||
      feed.location?.toLowerCase().includes(query.toLowerCase()) ||
      feed.description?.toLowerCase().includes(query.toLowerCase())
    ).slice(0, limit);
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

    let simpleResults = await simpleTextSearch(query, 20);
    if (simpleResults.length >= 5) {
      return res.status(200).json({ feeds: simpleResults.slice(0, 15), searchType: "text", message: `Found ${simpleResults.length} matches` });
    }

    let aiResults = [];
    let aiError = null;
    if (DEEPSEEK_API_KEY && query.length > 2) {
      try {
        let feeds = await Feed.find()
          .sort({ createdAt: -1 })
          .limit(FEED_LIMIT)
          .populate("user", "username profilePic location serviceType");
        if (feeds.length > 0) {
          let queryEmbedding = await getEmbedding(query);
          const feedWithScores = [];
          for (const feed of feeds) {
            try {
              const feedText = [
                feed.title,
                feed.location,
                feed.description,
                feed.user?.username,
                feed.user?.serviceType,
                feed.priceType
              ].filter(Boolean).join(' ').slice(0, 512);
              if (feedText.length < 3) continue;
              const feedEmbedding = await getEmbedding(feedText);
              const similarity = cosineSimilarity(queryEmbedding, feedEmbedding);
              let boost = 0;
              if (feed.location?.toLowerCase().includes(query.toLowerCase())) boost += 0.2;
              if (feed.title?.toLowerCase().includes(query.toLowerCase())) boost += 0.3;
              if (feed.user?.username?.toLowerCase().includes(query.toLowerCase())) boost += 0.15;
              if (feed.user?.serviceType?.toLowerCase().includes(query.toLowerCase())) boost += 0.1;
              const finalScore = similarity + boost;
              if (finalScore > 0.15) feedWithScores.push({ feed, score: finalScore });
            } catch (feedError) {}
          }
          feedWithScores.sort((a, b) => b.score - a.score);
          aiResults = feedWithScores.slice(0, 10).map(f => f.feed);
        }
      } catch (aiSearchError) {
        aiError = aiSearchError.message;
        aiResults = [];
      }
    }

    const finalResults = [];
    const usedIds = new Set();
    aiResults.forEach(feed => {
      if (!usedIds.has(feed._id.toString())) {
        finalResults.push(feed);
        usedIds.add(feed._id.toString());
      }
    });
    simpleResults.forEach(feed => {
      if (!usedIds.has(feed._id.toString()) && finalResults.length < 15) {
        finalResults.push(feed);
        usedIds.add(feed._id.toString());
      }
    });

    res.status(200).json({
      feeds: finalResults,
      searchType: aiResults.length > 0 ? "ai-enhanced" : "text",
      message: aiError ? `AI search failed, using text results: ${aiError}` : `Found ${finalResults.length} results`
    });
  } catch (err) {
    try {
      const query = req.query.query?.trim();
      const fallbackResults = await simpleTextSearch(query || '', 10);
      res.status(200).json({
        feeds: fallbackResults,
        searchType: "text-fallback",
        error: "Search service experienced issues, showing limited results"
      });
    } catch (finalError) {
      res.status(200).json({ feeds: [], searchType: "error", error: "Search service temporarily unavailable" });
    }
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

    [
      'plumbing', 'electrical', 'cleaning', 'repair',
      'carpentry', 'painting', 'gardening', 'construction',
      'mechanic', 'beauty', 'healthcare', 'education'
    ].forEach(service => {
      if (service.includes(query.toLowerCase())) suggestions.add(service);
    });

    res.status(200).json({ suggestions: Array.from(suggestions).slice(0, 10) });
  } catch (error) {
    res.status(200).json({ suggestions: [], error: "Failed to load suggestions" });
  }
};

exports.checkAIService = async (req, res) => {
  try {
    if (!DEEPSEEK_API_KEY) {
      return res.status(200).json({ available: false, message: "AI API key not configured" });
    }
    try {
      await getEmbedding("test health check");
      res.status(200).json({ available: true, message: "AI service is available" });
    } catch (e) {
      res.status(200).json({ available: false, message: "AI service unavailable: " + e.message });
    }
  } catch (error) {
    res.status(200).json({ available: false, message: "AI health check failed" });
  }
};