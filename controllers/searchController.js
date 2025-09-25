const Feed = require('../models/Feed');
const User = require('../models/User');
const dotenv = require('dotenv');
dotenv.config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Use global fetch (Node 18+)
const fetchAI = global.fetch;

// Limit how many feeds you embed per search (for demo, max 20)
const FEED_LIMIT = 20;

async function getEmbedding(text) {
  const res = await fetchAI('https://api.deepseek.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: "deepseek-embedding-v2",
      input: text
    })
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error("DeepSeek API Error:", res.status, errorText, text);
    throw new Error("DeepSeek API Error: " + errorText);
  }
  const data = await res.json();
  if (!data.data || !Array.isArray(data.data) || !data.data[0].embedding) {
    throw new Error("No embedding returned from DeepSeek");
  }
  return data.data[0].embedding;
}

function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return dot / (normA * normB);
}

exports.searchFeeds = async (req, res) => {
  try {
    const query = req.query.query?.trim();
    if (!query) return res.status(400).json({ feeds: [] });

    // Get logged-in user location (if authenticated)
    let userLocation = undefined;
    if (req.user) {
      const user = await User.findById(req.user.id);
      userLocation = user?.location || "";
    }

    // Limit to top 20 recent feeds for demo (avoid rate limit)
    let feeds = await Feed.find().sort({ createdAt: -1 }).limit(FEED_LIMIT).populate("user", "username profilePic location");

    // Get embedding for user query
    let queryEmbedding;
    try {
      queryEmbedding = await getEmbedding(query);
    } catch (err) {
      return res.status(500).json({ error: "AI embedding error: " + err.message, feeds: [] });
    }

    // For each feed, get text and embedding
    const feedWithScores = [];
    for (const feed of feeds) {
      try {
        const feedText = `${feed.title} ${feed.location} ${feed.description}`;
        const feedEmbedding = await getEmbedding(feedText);
        const similarity = cosineSimilarity(queryEmbedding, feedEmbedding);

        // Boost similarity if user's location matches feed location
        let locationBoost = 0;
        if (
          userLocation &&
          feed.location &&
          feed.location.toLowerCase().includes(userLocation.toLowerCase())
        ) {
          locationBoost = 0.1;
        }
        feedWithScores.push({ feed, score: similarity + locationBoost });
      } catch (err) {
        console.error("Feed embedding error:", err);
        // If embedding fails for a feed, skip it
      }
    }

    // Sort by score and return top 10
    feedWithScores.sort((a, b) => b.score - a.score);
    const topFeeds = feedWithScores.slice(0, 10).map(f => f.feed);

    res.status(200).json({ feeds: topFeeds });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: err.message, feeds: [] });
  }
};