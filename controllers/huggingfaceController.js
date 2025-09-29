const fetch = global.fetch || require('node-fetch');

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const MAX_USES = 5;

// Track usage with session storage
const userUsage = new Map();

function getUserId(req) {
  return req.ip || req.headers['user-agent'] || 'anonymous';
}

// More reliable models
const MODELS = [
  "microsoft/DialoGPT-medium",
  "microsoft/DialoGPT-small", 
  "google/flan-t5-base"
];

// Enhanced platform knowledge base
const PLATFORM_KNOWLEDGE = {
  "what is doop": {
    answer: "Doop is a comprehensive service marketplace platform designed to connect local service providers with customers seeking various services. It serves as a bridge between skilled professionals and people who need their services, making it easy to find, compare, and book services in your local area.",
    details: "Key features include: service listings, provider profiles, direct messaging, booking system, reviews and ratings, secure payments, and location-based service discovery."
  },
  "how does doop work": {
    answer: "Doop operates on a simple yet effective model:\n\nFor Customers:\n1. Browse services by category or search\n2. View provider profiles with ratings and prices\n3. Contact providers directly or book services\n4. Pay securely through the platform\n5. Leave reviews after service completion\n\nFor Providers:\n1. Create a professional service profile\n2. List services with detailed descriptions and pricing\n3. Manage bookings and customer inquiries\n4. Build reputation through customer reviews\n5. Grow your business locally"
  },
  "services available": {
    answer: "Doop offers a wide range of service categories to meet diverse needs:\n\n• Home Services: Cleaning, Plumbing, Electrical, Painting, Carpentry\n• Education: Tutoring, Music Lessons, Language Classes, Academic Coaching\n• Professional: IT Support, Graphic Design, Writing, Consulting\n• Personal: Beauty Services, Fitness Training, Pet Care, Event Planning\n• Automotive: Car Repair, Detailing, Maintenance\n• Healthcare: Fitness Training, Wellness Services, Therapy\n\nNew categories are regularly added based on user demand and market trends."
  },
  "how to book": {
    answer: "Booking a service on Doop is straightforward:\n\n1. **Search & Browse**: Use the search bar or browse categories\n2. **Compare Providers**: Check ratings, reviews, and pricing\n3. **Contact**: Message the provider directly or call them\n4. **Schedule**: Agree on date, time, and service details\n5. **Confirm**: Receive booking confirmation\n6. **Payment**: Pay securely after service completion\n\nYou can also save favorite providers for future bookings."
  },
  "become a provider": {
    answer: "Join Doop as a service provider in these simple steps:\n\n1. **Sign Up**: Create a provider account with basic details\n2. **Verify**: Complete identity verification process\n3. **Create Profile**: Build your professional service profile\n4. **List Services**: Add your services with clear descriptions and pricing\n5. **Set Availability**: Define your working hours and areas\n6. **Go Live**: Start receiving customer inquiries and bookings\n\nBenefits for providers:\n• Reach more customers in your area\n• Build your reputation with reviews\n• Manage bookings efficiently\n• Secure payment processing\n• Grow your business steadily"
  },
  "pricing structure": {
    answer: "Doop offers flexible pricing options:\n\n**For Customers:**\n• Service prices set by providers\n• Transparent pricing with no hidden fees\n• Option for hourly or fixed-price services\n• Secure payment protection\n\n**For Providers:**\n• Free basic listing options\n• Premium features available\n• Commission-based model\n• No upfront costs for basic accounts\n\nAll payments are processed securely through the platform."
  },
  "contact support": {
    answer: "Doop Support Options:\n\n• **Help Center**: Comprehensive FAQs and guides\n• **Email Support**: support@doop.com (response within 24 hours)\n• **Live Chat**: Available during business hours\n• **Phone Support**: Call +1-800-DOOP-NOW\n• **Community Forum**: Connect with other users\n\nOur support team is dedicated to helping you have the best experience on our platform."
  }
};

// Enhanced general knowledge responses
const GENERAL_KNOWLEDGE = {
  "sri lanka": "Sri Lanka, officially the Democratic Socialist Republic of Sri Lanka, is an island country in South Asia. It's known for its diverse landscapes ranging from rainforests and arid plains to highlands and sandy beaches. Key facts:\n• Capital: Sri Jayawardenepura Kotte\n• Commercial Capital: Colombo\n• Population: Approximately 22 million\n• Official Languages: Sinhala, Tamil\n• Currency: Sri Lankan Rupee (LKR)\n• Famous for: Tea production, cinnamon, gems, and beautiful tourism destinations",
  "history": "I'd be happy to discuss historical topics! History encompasses the study of past events, particularly human affairs. Could you specify which historical period, civilization, or event you're interested in? For example: ancient civilizations, world wars, specific countries, or historical figures.",
  "weather": "For accurate and current weather information, I recommend checking reliable weather services like:\n• Weather.com\n• AccuWeather\n• Your local meteorological service\n• Weather apps on your smartphone\n\nThese provide real-time forecasts, radar maps, and severe weather alerts specific to your location.",
  "news": "For the latest news updates, I suggest checking reputable news sources such as:\n• BBC News\n• CNN\n• Reuters\n• Associated Press\n• Your local news channels\n\nThese sources provide verified, up-to-date information on current events worldwide."
};

exports.aiChat = async (req, res) => {
  try {
    if (!HUGGINGFACE_API_KEY) {
      return res.status(503).json({ 
        error: "AI service is currently being configured. Please try again in a few minutes.",
        uses: 0,
        max: MAX_USES
      });
    }

    const userId = getUserId(req);
    const currentUses = userUsage.get(userId) || 0;

    // Check usage limit
    if (currentUses >= MAX_USES) {
      return res.status(429).json({ 
        error: `Daily usage limit reached (${MAX_USES}/${MAX_USES}). You can use this feature again tomorrow.`,
        uses: currentUses,
        max: MAX_USES
      });
    }

    const { prompt } = req.body;
    
    // Validate prompt
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
      return res.status(400).json({ error: "Please enter a valid question (at least 2 characters)." });
    }

    if (prompt.length > 500) {
      return res.status(400).json({ error: "Question is too long. Please keep it under 500 characters." });
    }

    const lowerPrompt = prompt.toLowerCase().trim();
    let answer = "";
    let source = "knowledge_base";

    // Enhanced platform question detection with fuzzy matching
    const platformKeywords = ['doop', 'service', 'provider', 'book', 'booking', 'price', 'cost', 'how to', 'what is', 'clean', 'plumb', 'tutor', 'repair', 'support', 'help'];
    const isPlatformQuestion = platformKeywords.some(keyword => 
      lowerPrompt.includes(keyword) && 
      (lowerPrompt.includes('doop') || lowerPrompt.length < 50) // Assume short questions are platform-related
    );

    // Check for specific platform questions first
    if (isPlatformQuestion) {
      // Enhanced question matching
      if (lowerPrompt.includes('what is doop') || lowerPrompt.includes('tell me about doop')) {
        answer = PLATFORM_KNOWLEDGE["what is doop"].answer;
        if (PLATFORM_KNOWLEDGE["what is doop"].details) {
          answer += "\n\n" + PLATFORM_KNOWLEDGE["what is doop"].details;
        }
      }
      else if (lowerPrompt.includes('how does doop work') || lowerPrompt.includes('how do i use doop')) {
        answer = PLATFORM_KNOWLEDGE["how does doop work"].answer;
      }
      else if (lowerPrompt.includes('service') && (lowerPrompt.includes('what') || lowerPrompt.includes('available') || lowerPrompt.includes('offer'))) {
        answer = PLATFORM_KNOWLEDGE["services available"].answer;
      }
      else if (lowerPrompt.includes('how to book') || lowerPrompt.includes('book a service') || lowerPrompt.includes('make appointment')) {
        answer = PLATFORM_KNOWLEDGE["how to book"].answer;
      }
      else if (lowerPrompt.includes('become a provider') || lowerPrompt.includes('post service') || lowerPrompt.includes('list service')) {
        answer = PLATFORM_KNOWLEDGE["become a provider"].answer;
      }
      else if (lowerPrompt.includes('price') || lowerPrompt.includes('cost') || lowerPrompt.includes('how much')) {
        answer = PLATFORM_KNOWLEDGE["pricing structure"].answer;
      }
      else if (lowerPrompt.includes('contact') || lowerPrompt.includes('support') || lowerPrompt.includes('help')) {
        answer = PLATFORM_KNOWLEDGE["contact support"].answer;
      }
    }

    // If no platform answer found, check general knowledge
    if (!answer) {
      for (const [keyword, response] of Object.entries(GENERAL_KNOWLEDGE)) {
        if (lowerPrompt.includes(keyword)) {
          answer = response;
          break;
        }
      }
    }

    // If still no answer, try HuggingFace models
    if (!answer) {
      let usedHuggingFace = false;
      
      for (const model of MODELS) {
        try {
          console.log(`Trying model: ${model}`);
          
          const hfRes = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${HUGGINGFACE_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
              inputs: `Please provide a helpful and accurate response to this question: "${prompt}"`,
              parameters: {
                max_length: 250,
                temperature: 0.7,
                do_sample: true,
                return_full_text: false,
                repetition_penalty: 1.2
              }
            }),
            timeout: 15000
          });

          if (hfRes.status === 404 || hfRes.status === 503) {
            continue;
          }

          if (hfRes.ok) {
            const data = await hfRes.json();
            
            if (data.generated_text) {
              answer = data.generated_text;
              usedHuggingFace = true;
              source = "ai_model";
              break;
            } else if (Array.isArray(data) && data[0]?.generated_text) {
              answer = data[0].generated_text;
              usedHuggingFace = true;
              source = "ai_model";
              break;
            }
          }
        } catch (modelError) {
          console.log(`Model ${model} error:`, modelError.message);
          continue;
        }
      }

      // Final fallback for unanswered questions
      if (!answer) {
        answer = `I understand you're asking about "${prompt}". `;
        
        if (isPlatformQuestion) {
          answer += "This appears to be related to our Doop platform. I'd be happy to help you with:\n\n• Understanding how Doop works\n• Finding and booking services\n• Becoming a service provider\n• Platform features and pricing\n• Contacting support\n\nCould you please rephrase your question or ask about one of these specific topics?";
        } else {
          answer += "While I'm designed to provide helpful information, I may not have enough context about this specific topic. For the most accurate and current information, I recommend checking reliable sources or rephrasing your question with more details.";
        }
        source = "fallback";
      }
    }

    // Clean and format the response
    answer = answer.trim();
    
    // Remove repetitive or low-quality content
    if (answer.includes(prompt) && answer.length > prompt.length + 20) {
      answer = answer.replace(prompt, '').trim();
    }
    
    // Ensure response quality
    if (answer.length < 10) {
      answer = "I received your question but couldn't generate a sufficiently detailed response. This might be due to the complexity of the question or limitations in my current knowledge. Please try rephrasing or asking about a different topic.";
      source = "quality_fallback";
    }

    // Increment usage
    userUsage.set(userId, currentUses + 1);

    res.status(200).json({
      answer,
      uses: currentUses + 1,
      max: MAX_USES,
      source,
      question: prompt // Return the original question for frontend display
    });

  } catch (error) {
    console.error('AI chat overall error:', error);
    
    const userId = getUserId(req);
    const currentUses = userUsage.get(userId) || 0;
    
    const fallbackAnswer = `I understand you asked about "${req.body?.prompt || 'your question'}". I'm currently experiencing high demand but I'm still here to help! \n\nFor Doop platform questions, I can assist with service bookings, provider information, and platform features. For other topics, please try rephrasing your question.`;
    
    res.status(200).json({
      answer: fallbackAnswer,
      uses: currentUses,
      max: MAX_USES,
      source: "error_fallback",
      question: req.body?.prompt || ""
    });
  }
};

exports.getAIUsage = async (req, res) => {
  try {
    const userId = getUserId(req);
    const uses = userUsage.get(userId) || 0;
    
    res.status(200).json({
      uses,
      max: MAX_USES
    });
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(200).json({ 
      uses: 0, 
      max: MAX_USES 
    });
  }
};

// Reset usage daily
setInterval(() => {
  const userCount = userUsage.size;
  userUsage.clear();
  console.log(`AI usage reset for ${userCount} users`);
}, 24 * 60 * 60 * 1000);