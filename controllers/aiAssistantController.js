const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const Feed = require('../models/Feed');
const User = require('../models/User');
const dotenv = require('dotenv');
dotenv.config();

const MAX_DAILY_USES = 10;
const userUsage = new Map();

// Helper to get user identifier
const getUserId = (req) => req.ip || req.headers['user-agent'] || 'anonymous';

const SERVICE_KEYWORDS = [
  "plumber", "plumbing", "electrician", "electrical", "carpenter", "woodwork",
  "cleaner", "cleaning", "tutor", "teacher", "teaching", "driver", "chauffeur",
  "chef", "cook", "babysitter", "nanny", "gardener", "garden", "mechanic",
  "repair", "painting", "painter", "ac repair", "appliance", "mason", "welding",
  "decorator", "photographer", "photo", "makeup", "beauty", "salon", "hair",
  "barber", "pet", "vet", "laundry", "moving", "mover", "security", "guard",
  "coach", "fitness", "yoga", "trainer"
];

/**
 * Extract meaningful search terms from a user prompt.
 * Returns distinct lowercased terms that match known service keywords
 */
function extractServiceTerms(prompt) {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const matches = new Set();
  for (const w of words) {
    for (const kw of SERVICE_KEYWORDS) {
      if (kw.includes(w) || w.includes(kw)) {
        matches.add(kw);
      }
    }
  }
  // Fallback: if user typed something like "find plumber near me"
  if (matches.size === 0) {
    const idx = words.findIndex((w) =>
      ["find", "need", "want", "search", "looking"].includes(w)
    );
    if (idx !== -1 && words[idx + 1]) {
      matches.add(words[idx + 1]);
    }
  }
  return Array.from(matches).slice(0, 4);
}

/**
 * Decide if a prompt is a service search intent
 */
function isServiceIntent(prompt) {
  const lower = prompt.toLowerCase();
  if (/(find|search|looking for|need|want|near|in)\b/.test(lower)) return true;
  return SERVICE_KEYWORDS.some((kw) => lower.includes(kw));
}

// --- SHARED SEARCH LOGIC (as in searchController) ---
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const fetch = global.fetch || require('node-fetch');
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

async function smartFeedSearch(query, limit = 20) {
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
      .populate("user", "username profilePic location serviceType status");
  }
  return await Feed.find(mongoQuery)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("user", "username profilePic location serviceType status");
}

async function deepseekAISearch(query, limit = 15) {
  if (!DEEPSEEK_API_KEY) return [];
  const feeds = await Feed.find({}).limit(200).populate("user", "username profilePic location serviceType status");
  const documents = feeds.map(feed => ({
    id: feed._id.toString(),
    text: `${feed.title} ${feed.description} ${feed.location} ${feed.user?.serviceType || ""} ${feed.user?.username || ""}`,
  }));
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
    const resultIds = deepseekData.results.map(r => r.id);
    const matchedFeeds = feeds.filter(feed => resultIds.includes(feed._id.toString()));
    return matchedFeeds.map(feed => ({
      ...feed._doc,
      user: feed.user ? {
        _id: feed.user._id,
        username: feed.user.username,
        profilePic: feed.user.profilePic || "",
        location: feed.user.location || "",
        serviceType: feed.user.serviceType || "",
        status: feed.user.status || ""
      } : { _id: "", username: "", profilePic: "", location: "", serviceType: "", status: "" }
    }));
  } catch (err) {
    return [];
  }
}

// ---- AI ASSISTANT CONTROLLER ----

const DOOP_KNOWLEDGE_BASE = {
  "what is doop": {
    answer: "Doop is a revolutionary service marketplace platform that connects customers with trusted local service providers. We make it easy to find, book, and manage various services all in one place.",
    category: "platform"
  },
   "how does doop work": {
    answer: "Doop works through a simple process:\n\n1. **Search**: Find services you need\n2. **Compare**: View provider profiles, ratings, and prices\n3. **Book**: Schedule appointments directly\n4. **Manage**: Track bookings and communicate with providers\n5. **Pay**: Secure payment processing\n6. **Review**: Share your experience",
    category: "platform"
  },
  "services available": {
    answer: "Doop offers a wide range of services including:\n\n• Home cleaning & maintenance\n• Tutoring & educational services\n• Beauty & wellness services\n• Professional services (IT, consulting)\n• Automotive services\n• Pet care services\n• Event planning services\n\nNew services are constantly being added based on community needs!",
    category: "services"
  },
  "how to book a service": {
    answer: "Booking a service on Doop is simple:\n\n1. **Search** for the service you need\n2. **Browse** available providers in your area\n3. **Check** reviews, ratings, and pricing\n4. **Select** your preferred provider\n5. **Choose** date and time\n6. **Confirm** your booking\n7. **Make** secure payment\n\nYou'll receive confirmation and can track your booking in real-time!",
    category: "booking"
  },
  "become a service provider": {
    answer: "Join Doop as a service provider:\n\n1. **Sign up** as a provider on our platform\n2. **Complete** your profile with services offered\n3. **Get verified** through our screening process\n4. **Set** your availability and pricing\n5. **Start** receiving booking requests\n6. **Grow** your business through reviews\n\nBenefits include: More customers, flexible schedule, secure payments, and business growth tools!",
    category: "providers"
  },
  "pricing and fees": {
    answer: "Doop's pricing structure:\n\n**For Customers:**\n• Service prices set by providers\n• Transparent pricing with no hidden fees\n• Secure payment processing\n• Free to search and contact providers\n\n**For Providers:**\n• Competitive commission rates\n• Free basic listing option\n• Premium features available\n• No upfront costs to join\n\nWe believe in fair pricing that benefits both customers and service professionals!",
    category: "pricing"
  },
  "contact customer support": {
    answer: "Doop Support Options:\n\n📞 **Phone**: 1-800-DOOP-NOW (Mon-Fri 9AM-6PM)\n✉️ **Email**: support@doop.com\n💬 **Live Chat**: Available in app (9AM-9PM)\n🆘 **Help Center**: 24/7 self-service resources\n\nFor urgent issues, phone support provides the fastest resolution. Our average response time for email is under 4 hours!",
    category: "support"
  },
  "safety and verification": {
    answer: "Doop takes safety seriously:\n\n✅ **Provider Verification**: All providers undergo background checks\n⭐ **Review System**: Authentic customer feedback\n🔒 **Secure Payments**: Protected transactions\n📞 **Support**: 24/7 customer assistance\n🚨 **Emergency**: Immediate issue resolution\n\nYour safety and satisfaction are our top priorities!",
    category: "safety"
  },
  "cancellation policy": {
    answer: "Doop's Cancellation Policy:\n\n**Flexible Cancellation**:\n• Cancel up to 24 hours before for full refund\n• Emergency cancellations handled case-by-case\n• Provider cancellations automatically refunded\n• No-show policies clearly stated\n\nWe understand plans change and aim to be fair to both customers and providers!",
    category: "policies"
  },
  "areas covered": {
    answer: "Doop Service Coverage:\n\n🌍 **Currently Available In**:\n• Major metropolitan areas\n• Suburban regions\n• Select rural communities\n\nWe're expanding rapidly! Check your location in the app to see available services. New areas are added weekly based on demand!",
    category: "coverage"
  }
};

const generateDoopResponse = (prompt, context = []) => {
  const lowerPrompt = prompt.toLowerCase().trim();
  if (lowerPrompt.match(/(hi|hello|hey|greetings)/)) {
    return "Hello! 👋 I'm your Doop AI assistant. I can help you with information about our platform, services, booking process, becoming a provider, and more! What would you like to know?";
  }
  if (lowerPrompt.match(/(thanks|thank you|appreciate)/)) {
    return "You're welcome! 😊 Is there anything else about Doop you'd like to know?";
  }
  if (lowerPrompt.match(/(bye|goodbye|see you)/)) {
    return "Goodbye! 👋 Thank you for using Doop. Have a great day!";
  }
  for (const [keyword, knowledge] of Object.entries(DOOP_KNOWLEDGE_BASE)) {
    if (lowerPrompt.includes(keyword) ||
        keyword.split(' ').some(word => lowerPrompt.includes(word))) {
      return knowledge.answer;
    }
  }
  if (lowerPrompt.includes('clean') || lowerPrompt.includes('cleaning')) {
    return "For cleaning services on Doop:\n\n• **Standard Cleaning**: Regular home cleaning\n• **Deep Cleaning**: Thorough cleaning service\n• **Move In/Out**: Specialized moving cleaning\n• **Commercial**: Office and business cleaning\n\nYou can browse available cleaning providers, compare prices, read reviews, and book directly through our platform!";
  }
  if (lowerPrompt.includes('tutor') || lowerPrompt.includes('teaching')) {
    return "For tutoring services on Doop:\n\n• **Academic Subjects**: Math, Science, Languages, etc.\n• **Test Preparation**: SAT, ACT, GRE, etc.\n• **Skill Development**: Music, Arts, Sports\n• **Online/In-person**: Flexible learning options\n\nFind qualified tutors with verified credentials and teaching experience!";
  }
  if (lowerPrompt.includes('beauty') || lowerPrompt.includes('salon')) {
    return "For beauty services on Doop:\n\n• **Hair Services**: Cutting, styling, coloring\n• **Skincare**: Facials, treatments\n• **Makeup**: Professional application\n• **Spa Services**: Massages, wellness\n• **At-home Services**: Convenient mobile options\n\nBook certified beauty professionals with portfolio reviews!";
  }
  if (lowerPrompt.includes('doop')) {
    return "I understand you're asking about Doop! While I don't have a specific answer for that question, I can definitely help you with:\n\n• How Doop works\n• Available services\n• Booking process\n• Becoming a provider\n• Pricing information\n• Customer support\n\nCould you be more specific about what you'd like to know?";
  }
  return null;
};

exports.chatWithAI = async (req, res) => {
  try {
    if (!HUGGINGFACE_API_KEY) {
      return res.status(503).json({
        error: "AI service is currently unavailable. Please try again later.",
        uses: 0,
        max: MAX_DAILY_USES
      });
    }
    const userId = getUserId(req);
    const currentUses = userUsage.get(userId) || 0;
    if (currentUses >= MAX_DAILY_USES) {
      return res.status(429).json({
        error: `You've reached your daily limit of ${MAX_DAILY_USES} AI requests. Please try again tomorrow.`,
        uses: currentUses,
        max: MAX_DAILY_USES
      });
    }
    const { prompt, context = [] } = req.body;
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
      return res.status(400).json({
        error: "Please enter a valid question (at least 2 characters)."
      });
    }
    if (prompt.length > 500) {
      return res.status(400).json({
        error: "Question is too long. Please keep it under 500 characters."
      });
    }
    const cleanPrompt = prompt.trim();
    let answer = "";
    let source = "doop_knowledge";
    let suggestions = [];
    let serviceSearchMeta = null;

    // --- Service Search Integration ---
    const serviceIntent = isServiceIntent(cleanPrompt);
    if (serviceIntent) {
      // Use same as searchFeeds
      const terms = extractServiceTerms(cleanPrompt);
      const effectiveQuery = terms.length ? terms.join(" ") : cleanPrompt;
      // 1. Smart keyword search
      let feeds = await smartFeedSearch(effectiveQuery, 20);
      feeds = feeds.map(feed => ({
        ...feed._doc,
        user: feed.user ? {
          _id: feed.user._id,
          username: feed.user.username,
          profilePic: feed.user.profilePic || "",
          location: feed.user.location || "",
          serviceType: feed.user.serviceType || "",
          status: feed.user.status || "" // <-- ADD THIS
        } : { _id: "", username: "", profilePic: "", location: "", serviceType: "", status: "" }
      }));
      // 2. DeepSeek AI search (optional, only if API enabled)
      let aiFeeds = [];
      if (DEEPSEEK_API_KEY) {
        aiFeeds = await deepseekAISearch(effectiveQuery, 15);
      }
      // Merge and dedupe
      const seen = new Set();
      const addAndMark = arr => arr.filter(f => {
        if (seen.has(f._id.toString())) return false;
        seen.add(f._id.toString());
        return true;
      });
      suggestions = [...addAndMark(feeds), ...addAndMark(aiFeeds)].slice(0, 5).map(sug => ({
        ...sug,
        user: sug.user ? {
          _id: sug.user._id,
          username: sug.user.username,
          profilePic: sug.user.profilePic || "",
          location: sug.user.location || "",
          serviceType: sug.user.serviceType || "",
          status: sug.user.status || "" // <-- ADD THIS
        } : { _id: "", username: "", profilePic: "", location: "", serviceType: "", status: "" }
      }));
      serviceSearchMeta = {
        attempted: true,
        query: cleanPrompt,
        found: suggestions.length
      };
    }

    // Try Doop knowledge base first
    const doopResponse = generateDoopResponse(cleanPrompt, context);
    if (doopResponse) {
      answer = doopResponse;
    } else if (!serviceIntent) {
      // Use HuggingFace for other questions with Doop context
      try {
        const enhancedPrompt = `You are Doop AI assistant for a service marketplace platform. 
        Answer this user question helpfully and conversationally: "${cleanPrompt}"
        If it's about service marketplaces, local services, or online platforms, provide informative advice.
        Keep responses under 300 characters and be friendly.`;
        const hfResponse = await fetch(
          "https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${HUGGINGFACE_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              inputs: enhancedPrompt,
              parameters: {
                max_length: 300,
                temperature: 0.7,
                do_sample: true
              }
            })
          }
        );
        if (hfResponse.ok) {
          const data = await hfResponse.json();
          if (data[0]?.generated_text) {
            answer = data[0].generated_text.replace(enhancedPrompt, '').trim();
            source = "ai_model";
          }
        }
        if (!answer) {
          answer = `I understand you're asking about "${cleanPrompt}". As the Doop AI assistant, I'm here to help with service marketplace questions, booking information, provider details, and platform features. Could you rephrase your question or ask something specific about Doop services?`;
          source = "fallback";
        }
      } catch (hfError) {
        answer = `I understand you're asking about "${cleanPrompt}". While I specialize in Doop platform questions, I'd be happy to help! You can ask me about service bookings, provider information, platform features, or general service marketplace topics.`;
        source = "error_fallback";
      }
    } else if (!answer) {
      answer = "Here are service providers matching your request:";
    }

    userUsage.set(userId, currentUses + 1);

    res.status(200).json({
      answer,
      uses: currentUses + 1,
      max: MAX_DAILY_USES,
      source,
      timestamp: new Date().toISOString(),
      suggestions,
      serviceSearchMeta
    });

  } catch (error) {
    const userId = getUserId(req);
    const currentUses = userUsage.get(userId) || 0;
    res.status(200).json({
      answer: "I apologize, but I'm having trouble processing your request right now. Please try again in a moment. For immediate assistance with Doop, you can contact our support team at support@doop.com.",
      uses: currentUses,
      max: MAX_DAILY_USES,
      source: "error",
      timestamp: new Date().toISOString()
    });
  }
};

exports.getUsage = async (req, res) => {
  try {
    const userId = getUserId(req);
    const uses = userUsage.get(userId) || 0;
    res.status(200).json({
      uses,
      max: MAX_DAILY_USES,
      resetTime: "24 hours"
    });
  } catch (error) {
    res.status(200).json({
      uses: 0,
      max: MAX_DAILY_USES,
      resetTime: "24 hours"
    });
  }
};

// Reset usage every 24 hours
setInterval(() => {
  userUsage.clear();
}, 24 * 60 * 60 * 1000);