const fetch = global.fetch || require('node-fetch');

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const MAX_USES = 5;

// Track usage with session storage
const userUsage = new Map();

function getUserId(req) {
  return req.ip || req.headers['user-agent'] || 'anonymous';
}

// List of reliable free models to try
const MODELS = [
  "microsoft/DialoGPT-medium",
  "microsoft/DialoGPT-small", 
  "microsoft/DialoGPT-large"
];

// Platform-specific information about Doop
const PLATFORM_INFO = {
  "what is doop": "Doop is a service marketplace platform that connects service providers with customers. It allows people to find and book various services like cleaning, tutoring, repairs, and more in their local area.",
  "how does doop work": "Doop works by allowing service providers to post their services with details like pricing, location, and description. Customers can browse these services, contact providers, and book appointments directly through the platform.",
  "services on doop": "Doop offers a wide range of services including home cleaning, tutoring, plumbing, electrical work, beauty services, fitness training, pet care, and many other local services.",
  "how to book a service": "To book a service on Doop: 1) Browse available services, 2) Click on a service provider you like, 3) Contact them via their provided number or message, 4) Schedule your appointment directly with the provider.",
  "how to post a service": "To post a service on Doop: 1) Create a provider account, 2) Click 'Post a Service', 3) Fill in service details like title, description, price, and location, 4) Add photos if available, 5) Publish your service listing.",
  "pricing on doop": "Service providers set their own prices on Doop. Prices can be hourly rates or fixed task prices. You'll see the pricing clearly listed on each service post.",
  "contact support": "For support on Doop, you can use the contact information provided in the app settings or reach out through the help section. Our team is here to assist you with any platform-related issues."
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

    // Check for platform-specific questions first
    if (lowerPrompt.includes('doop')) {
      if (lowerPrompt.includes('what is') || lowerPrompt.includes('tell me about')) {
        userUsage.set(userId, currentUses + 1);
        return res.status(200).json({
          answer: "Doop is a service marketplace platform that connects local service providers with customers. It allows people to find and book various services like cleaning, tutoring, plumbing, repairs, beauty services, and more in their area. Providers can post their services, set their prices, and connect directly with customers looking for their expertise.",
          uses: currentUses + 1,
          max: MAX_USES
        });
      }
      if (lowerPrompt.includes('how to book') || lowerPrompt.includes('how do i book')) {
        userUsage.set(userId, currentUses + 1);
        return res.status(200).json({
          answer: "To book a service on Doop: 1) Browse available services on the home page, 2) Click on a service provider that interests you, 3) View their details, pricing, and contact information, 4) Contact them directly via phone or message to schedule your service. It's that simple!",
          uses: currentUses + 1,
          max: MAX_USES
        });
      }
      if (lowerPrompt.includes('how to post') || lowerPrompt.includes('become a provider')) {
        userUsage.set(userId, currentUses + 1);
        return res.status(200).json({
          answer: "To post a service on Doop: 1) Sign up as a service provider, 2) Click 'Post a Service' in the navigation, 3) Fill in your service details (title, description, location, price), 4) Add photos to showcase your work, 5) Set your availability and contact information, 6) Publish your service to start receiving customers!",
          uses: currentUses + 1,
          max: MAX_USES
        });
      }
    }

    // Check for service-related questions
    if (lowerPrompt.includes('service') || lowerPrompt.includes('provider') || lowerPrompt.includes('clean') || 
        lowerPrompt.includes('plumb') || lowerPrompt.includes('tutor') || lowerPrompt.includes('repair')) {
      
      if (lowerPrompt.includes('what services') || lowerPrompt.includes('available services')) {
        userUsage.set(userId, currentUses + 1);
        return res.status(200).json({
          answer: "Doop offers a wide variety of services including: • Home Cleaning • Tutoring & Education • Plumbing & Electrical • Beauty Services • Fitness Training • Pet Care • Moving & Transportation • IT & Tech Support • Event Planning • and many more local services! You can browse all categories on our platform.",
          uses: currentUses + 1,
          max: MAX_USES
        });
      }
    }

    let answer = "";
    let usedHuggingFace = false;

    // Try HuggingFace models for general questions
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
            inputs: prompt,
            parameters: {
              max_length: 200,
              temperature: 0.7,
              do_sample: true,
              return_full_text: false
            }
          })
        });

        if (hfRes.status === 404) {
          console.log(`Model ${model} not found, trying next...`);
          continue;
        }

        if (!hfRes.ok) {
          const errorText = await hfRes.text();
          console.log(`Model ${model} failed:`, hfRes.status);
          continue;
        }

        const data = await hfRes.json();
        
        if (data.generated_text) {
          answer = data.generated_text;
          usedHuggingFace = true;
          break;
        } else if (Array.isArray(data) && data[0]?.generated_text) {
          answer = data[0].generated_text;
          usedHuggingFace = true;
          break;
        }
      } catch (modelError) {
        console.log(`Model ${model} error:`, modelError.message);
        continue;
      }
    }

    // If HuggingFace didn't work or no answer, use smart fallback
    if (!answer) {
      // General knowledge fallback responses
      const generalResponses = {
        "sri lanka": "Sri Lanka is an island country in South Asia, known for its beautiful beaches, rich history, and diverse culture. Its capital is Sri Jayawardenepura Kotte, while Colombo is the commercial capital.",
        "history": "I'd be happy to help with historical questions! Could you specify which historical topic or era you're interested in?",
        "weather": "For current weather information, I recommend checking a reliable weather service or app as I don't have real-time weather data.",
        "news": "For the latest news, please check reputable news websites or apps as I don't have access to current news updates."
      };

      // Check if we have a predefined response
      for (const [keyword, response] of Object.entries(generalResponses)) {
        if (lowerPrompt.includes(keyword)) {
          answer = response;
          break;
        }
      }

      // If no specific response, provide a general helpful answer
      if (!answer) {
        answer = `I understand you asked: "${prompt}". `;
        
        // Add context based on question type
        if (lowerPrompt.includes('how') || lowerPrompt.includes('what') || lowerPrompt.includes('why')) {
          answer += "This seems like a general knowledge question. While I'm primarily here to help with Doop platform questions, I'll do my best to provide helpful information based on my training.";
        } else {
          answer += "I'm here to help with both general questions and Doop platform assistance. Feel free to ask me anything!";
        }
      }
    }

    // Clean up the response
    answer = answer.trim();
    
    // Remove the original prompt if it's included in the response
    if (answer.includes(prompt) && answer.length > prompt.length + 10) {
      answer = answer.replace(prompt, '').trim();
    }
    
    // Ensure we have a reasonable response
    if (answer.length < 5) {
      answer = "I received your question but couldn't generate a detailed response. Please try asking in a different way or be more specific about what you'd like to know.";
    }

    // Increment usage
    userUsage.set(userId, currentUses + 1);

    res.status(200).json({
      answer,
      uses: currentUses + 1,
      max: MAX_USES,
      source: usedHuggingFace ? "ai_model" : "fallback"
    });

  } catch (error) {
    console.error('AI chat overall error:', error);
    
    const userId = getUserId(req);
    const currentUses = userUsage.get(userId) || 0;
    
    // Provide a helpful fallback response
    const fallbackAnswer = `I understand you asked about "${req.body?.prompt || 'your question'}". I'm experiencing high demand but I'm still here to help! For Doop platform questions, I can tell you it's a service marketplace connecting providers with customers. For other questions, please try rephrasing.`;
    
    res.status(200).json({
      answer: fallbackAnswer,
      uses: currentUses,
      max: MAX_USES,
      source: "error_fallback"
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
}, 24 * 60 * 60 * 1000); // 24 hours