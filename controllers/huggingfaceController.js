const fetch = global.fetch || require('node-fetch');

const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const MAX_USES = 10; // Increased limit

// Track usage with session storage
const userUsage = new Map();

function getUserId(req) {
  return req.ip || req.headers['user-agent'] || 'anonymous';
}

// Better models for conversational AI
const MODELS = [
  "microsoft/DialoGPT-large",
  "microsoft/DialoGPT-medium",
  "google/flan-t5-xxl",
  "facebook/blenderbot-400M-distill",
  "microsoft/DialoGPT-small"
];

// Enhanced platform knowledge base with more natural responses
const PLATFORM_KNOWLEDGE = {
  "what is doop": {
    answer: "Doop is an innovative service marketplace that connects local service providers with customers in your community. Think of it as your go-to platform for finding trusted professionals for various services - from home repairs and tutoring to beauty services and more.\n\nWhat makes Doop special is our focus on building local connections while ensuring quality and reliability through our review system and secure payment processing.",
    details: "🌟 Key Features:\n• Service Discovery: Find exactly what you need in your area\n• Verified Providers: All professionals are vetted for quality\n• Secure Booking: Easy scheduling and payment system\n• Real Reviews: Honest feedback from other customers\n• Direct Communication: Chat directly with providers"
  },
  "how does doop work": {
    answer: "Doop works like having a personal assistant for all your service needs! Here's how it works:\n\n**For Customers:**\n1. **Search**: Tell us what service you need or browse categories\n2. **Discover**: View profiles, ratings, and prices of local providers\n3. **Connect**: Message providers directly to discuss your needs\n4. **Book**: Schedule the service at your convenience\n5. **Pay Securely**: Payment is processed safely after service completion\n6. **Review**: Share your experience to help others\n\n**For Service Providers:**\n1. **Create Profile**: Showcase your skills and experience\n2. **Get Discovered**: Appear in local searches\n3. **Grow Business**: Build your reputation through reviews\n4. **Get Paid**: Secure and timely payments"
  },
  "services available": {
    answer: "Doop offers an extensive range of services to make your life easier! Here are our main categories:\n\n🏠 **Home Services**\n• Cleaning, Plumbing, Electrical, Painting, Carpentry\n• Gardening, Pest Control, Moving Help\n\n🎓 **Education & Tutoring**\n• Academic Subjects, Music Lessons, Language Classes\n• Test Preparation, Skill Development\n\n💼 **Professional Services**\n• IT Support, Graphic Design, Writing, Consulting\n• Marketing, Business Services\n\n💅 **Personal Care**\n• Beauty Services, Hair Styling, Massage Therapy\n• Fitness Training, Wellness Coaching\n\n🚗 **Automotive**\n• Car Repair, Detailing, Maintenance\n• Roadside Assistance\n\n🐾 **Pet Services**\n• Pet Sitting, Grooming, Training, Walking\n\nWe're constantly adding new categories based on what our community needs!"
  },
  "how to book": {
    answer: "Booking a service on Doop is super simple! Here's your step-by-step guide:\n\n1. **Find Your Service**: Use our search bar or browse categories to find what you need\n2. **Compare Options**: Check out provider profiles, read reviews, and compare prices\n3. **Contact Providers**: Send messages to 1-3 providers that seem like a good fit\n4. **Discuss Details**: Chat about timing, specific requirements, and pricing\n5. **Confirm Booking**: Once you agree on details, confirm the booking\n6. **Get It Done**: The provider completes the service at the scheduled time\n7. **Secure Payment**: Pay through our protected system after you're satisfied\n8. **Share Feedback**: Leave a review to help other customers\n\n💡 **Pro Tip**: You can save favorite providers for future bookings!"
  },
  "become a provider": {
    answer: "That's awesome you're interested in joining the Doop community as a service provider! Here's how to get started:\n\n**Getting Started Process:**\n1. **Sign Up**: Create your provider account (takes 2 minutes)\n2. **Build Your Profile**: Showcase your skills, experience, and portfolio\n3. **List Your Services**: Detail what you offer with clear pricing\n4. **Set Your Availability**: Define when you're available for work\n5. **Get Verified**: Complete our quick verification process\n6. **Go Live**: Start receiving booking requests!\n\n**Why Join Doop?**\n• **More Customers**: Reach people actively looking for your services\n• **Build Reputation**: Grow your business through authentic reviews\n• **Flexible Schedule**: Work when you want, where you want\n• **Secure Payments**: Get paid reliably without chasing invoices\n• **Support**: Access our provider support team when needed\n\nMany providers see a significant increase in bookings within their first month!"
  },
  "pricing structure": {
    answer: "Doop is designed to be affordable and transparent for everyone. Here's how our pricing works:\n\n**For Customers:**\n• **Service Prices**: Set by providers based on market rates\n• **No Hidden Fees**: You see the total price upfront\n• **Payment Protection**: Your payment is secure until you're satisfied\n• **Free to Browse**: No cost to search and contact providers\n\n**For Service Providers:**\n• **Free Tier**: Basic listing with essential features\n• **Premium Options**: Enhanced visibility and advanced tools (optional)\n• **Competitive Commission**: We only succeed when you succeed\n• **No Upfront Costs**: Start free and upgrade as you grow\n\nWe believe in fair pricing that works for both customers and service professionals. The exact pricing for each service is clearly displayed on provider profiles."
  },
  "contact support": {
    answer: "I'm here to help! For Doop support, we have multiple ways to get assistance:\n\n**Quick Help Options:**\n📞 **Phone Support**: 1-800-DOOP-NOW (Mon-Fri 9AM-6PM)\n✉️ **Email**: support@doop.com (24/7, response within 4 hours)\n💬 **Live Chat**: Available in the app (9AM-9PM daily)\n\n**Self-Service Resources:**\n• **Help Center**: Detailed guides and FAQs\n• **Community Forum**: Connect with other users\n• **Video Tutorials**: Step-by-step walkthroughs\n\n**Urgent Issues:**\nFor payment issues or account problems, our phone support provides the fastest resolution.\n\nDon't hesitate to reach out - we're committed to making your Doop experience smooth and enjoyable!"
  }
};

// Enhanced general knowledge with more conversational responses
const GENERAL_KNOWLEDGE = {
  "sri lanka": "Sri Lanka is a beautiful island nation in South Asia that I find quite fascinating! Here's what makes it special:\n\n🏝️ **Island Paradise**: Known as the 'Pearl of the Indian Ocean'\n🏛️ **Rich History**: Ancient kingdoms dating back 2500+ years\n🌿 **Biodiversity**: Incredible wildlife including elephants and leopards\n🍵 **Famous Exports**: World-renowned Ceylon tea and cinnamon\n🏄 **Tourist Hotspots**: Beautiful beaches, ancient cities, and lush mountains\n\nIt's a country with amazing cultural heritage and natural beauty that's definitely worth visiting!",
  
  "history": "History is such an interesting subject! It's like a giant story of everything that's brought us to where we are today. I can help with:\n\n• **Ancient Civilizations**: Egypt, Rome, Greece, Mesopotamia\n• **World History**: Major events and turning points\n• **Cultural History**: Arts, inventions, and social changes\n• **Historical Figures**: Influential people who shaped our world\n\nWhat specific historical topic or era are you curious about? I'd love to dive deeper into whatever interests you!",
  
  "weather": "I'd love to give you weather information, but for the most accurate and current conditions, I recommend checking:\n\n🌤️ **Reliable Weather Apps**:\n• Weather.com or their mobile app\n• AccuWeather for detailed forecasts\n• Your phone's built-in weather app\n• National Weather Service for official alerts\n\nThese sources provide real-time radar, hourly forecasts, and severe weather alerts specific to your exact location. Stay safe and prepared!",
  
  "news": "For the latest news, I suggest these trusted sources:\n\n📰 **Major News Outlets**:\n• BBC News for global coverage\n• Reuters for unbiased reporting\n• Associated Press for factual news\n• Local newspapers for community updates\n\n🔍 **News Aggregators**:\n• Google News for comprehensive coverage\n• Apple News for curated stories\n\nI recommend cross-referencing multiple sources to get a well-rounded perspective on current events!",
  
  "technology": "Technology is evolving so rapidly! It's amazing to see how it's transforming our world. I can discuss:\n\n🤖 **AI & Machine Learning**: How it's changing various industries\n📱 **Mobile Technology**: Latest smartphones and apps\n💻 **Computing**: Advances in hardware and software\n🌐 **Internet & Web**: Digital transformation trends\n🔬 **Emerging Tech**: VR, AR, blockchain, and more\n\nWhat specific technology topic interests you? I'd be happy to explore it with you!",
  
  "science": "Science is the process of understanding how our universe works - from the smallest particles to the vastness of space! I can help with:\n\n🔭 **Space & Astronomy**: Planets, stars, and cosmic phenomena\n🧬 **Biology & Life Sciences**: Animals, plants, and human biology\n⚛️ **Physics**: Laws that govern matter and energy\n🧪 **Chemistry**: Elements, compounds, and reactions\n🌍 **Earth Science**: Geology, weather, and climate\n\nWhat scientific topic would you like to explore? The world of science is full of fascinating discoveries!"
};

// Enhanced response generator for more natural conversations
function generateEnhancedResponse(prompt, context = []) {
  const lowerPrompt = prompt.toLowerCase().trim();
  
  // Check if this is a follow-up question
  const lastMessage = context[context.length - 2]; // User's previous message
  const isFollowUp = context.length > 1 && lastMessage && lastMessage.type === 'user';
  
  // Enhanced greeting responses
  if (lowerPrompt.match(/(hi|hello|hey|greetings|good morning|good afternoon)/)) {
    const greetings = [
      "Hello! 👋 I'm your Doop AI assistant. How can I help you today?",
      "Hi there! 😊 I'm here to assist with anything about Doop or answer your questions. What can I do for you?",
      "Hey! Great to see you! I'm ready to help with Doop services or any questions you might have.",
      "Greetings! I'm your friendly Doop assistant. What would you like to know about our platform or anything else?"
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  
  // Enhanced thanks responses
  if (lowerPrompt.match(/(thanks|thank you|appreciate it|cheers)/)) {
    const thanks = [
      "You're very welcome! 😊 Happy I could help. Is there anything else you'd like to know?",
      "My pleasure! 👍 Let me know if you have any other questions about Doop or anything else.",
      "Glad I could assist! 🎉 Don't hesitate to ask if you need anything else.",
      "Anytime! 😄 I'm here whenever you need help or information."
    ];
    return thanks[Math.floor(Math.random() * thanks.length)];
  }
  
  // Enhanced farewell responses
  if (lowerPrompt.match(/(bye|goodbye|see you|farewell|have a good)/)) {
    const farewells = [
      "Goodbye! 👋 Thanks for chatting with me. Come back anytime you need help!",
      "See you later! 😊 It was great helping you today.",
      "Take care! 👍 Hope to see you again soon on Doop!",
      "Have a wonderful day! 🌟 Don't hesitate to return if you have more questions."
    ];
    return farewells[Math.floor(Math.random() * farewells.length)];
  }
  
  // Check platform knowledge with better matching
  for (const [keyword, knowledge] of Object.entries(PLATFORM_KNOWLEDGE)) {
    if (lowerPrompt.includes(keyword) || 
        (keyword.includes('doop') && lowerPrompt.includes('doop')) ||
        (isFollowUp && lastMessage.content.toLowerCase().includes(keyword))) {
      return knowledge.answer;
    }
  }
  
  // Check general knowledge
  for (const [keyword, response] of Object.entries(GENERAL_KNOWLEDGE)) {
    if (lowerPrompt.includes(keyword)) {
      return response;
    }
  }
  
  return null; // Let HuggingFace handle it
}

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

    const { prompt, context = [] } = req.body;
    
    // Validate prompt
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
      return res.status(400).json({ error: "Please enter a valid question (at least 2 characters)." });
    }

    if (prompt.length > 500) {
      return res.status(400).json({ error: "Question is too long. Please keep it under 500 characters." });
    }

    const cleanPrompt = prompt.trim();
    let answer = "";
    let source = "knowledge_base";

    // Try enhanced response generator first
    const enhancedResponse = generateEnhancedResponse(cleanPrompt, context);
    if (enhancedResponse) {
      answer = enhancedResponse;
    } else {
      // If no enhanced response, try HuggingFace with better prompts
      let usedHuggingFace = false;
      
      for (const model of MODELS) {
        try {
          console.log(`Trying model: ${model}`);
          
          // Enhanced prompt for better responses
          const conversationContext = context.length > 0 ? 
            `Previous context: ${context.slice(-4).map(msg => `${msg.type}: ${msg.content}`).join(' | ')}. ` : '';
          
          const enhancedPrompt = `${conversationContext}User question: "${cleanPrompt}". 
          Please provide a helpful, conversational, and accurate response. 
          If this is about service marketplaces, local services, or online platforms, focus on being informative yet friendly. 
          If you're unsure, be honest about limitations while still being helpful.`;
          
          const hfRes = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${HUGGINGFACE_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
              inputs: enhancedPrompt,
              parameters: {
                max_length: 300,
                temperature: 0.8,
                do_sample: true,
                return_full_text: false,
                repetition_penalty: 1.3,
                top_p: 0.9,
                top_k: 50
              }
            }),
            timeout: 20000
          });

          if (hfRes.status === 404 || hfRes.status === 503) {
            continue;
          }

          if (hfRes.ok) {
            const data = await hfRes.json();
            let generatedText = "";
            
            if (data.generated_text) {
              generatedText = data.generated_text;
            } else if (Array.isArray(data) && data[0]?.generated_text) {
              generatedText = data[0].generated_text;
            }
            
            // Clean up the response
            if (generatedText) {
              // Remove the prompt if it's repeated
              if (generatedText.includes(cleanPrompt)) {
                generatedText = generatedText.replace(cleanPrompt, '').trim();
              }
              
              // Remove any weird prefixes or suffixes
              generatedText = generatedText.replace(/^(Response:|Answer:|🤖|👤)/, '').trim();
              
              // Ensure reasonable length
              if (generatedText.length > 50 && generatedText.length < 400) {
                answer = generatedText;
                usedHuggingFace = true;
                source = "ai_model";
                break;
              }
            }
          }
        } catch (modelError) {
          console.log(`Model ${model} error:`, modelError.message);
          continue;
        }
      }

      // Final fallback for unanswered questions
      if (!answer) {
        const lowerPrompt = cleanPrompt.toLowerCase();
        
        if (lowerPrompt.includes('doop') || 
            lowerPrompt.includes('service') || 
            lowerPrompt.includes('book') || 
            lowerPrompt.includes('provider')) {
          answer = `I understand you're asking about "${cleanPrompt}". This seems related to the Doop platform! \n\nI can definitely help you with:\n\n• Understanding how Doop works\n• Finding and booking services\n• Becoming a service provider\n• Platform features and pricing\n• Contacting support\n\nCould you tell me a bit more about what specific aspect you'd like to know?`;
        } else {
          answer = `I understand you're asking about "${cleanPrompt}". While I'm designed to provide helpful information, I may not have enough specific knowledge about this topic to give you a comprehensive answer.\n\nFor the most accurate and current information, I'd recommend checking reliable specialized sources or rephrasing your question with more context. I'm great at helping with Doop platform questions, general knowledge, and various other topics though!`;
        }
        source = "fallback";
      }
    }

    // Final response cleaning and enhancement
    answer = answer.trim();
    
    // Ensure the response doesn't just repeat the question
    if (answer.toLowerCase().includes(cleanPrompt.toLowerCase()) && answer.length < cleanPrompt.length + 30) {
      answer = "I understand your question, but I need a bit more context to provide a helpful answer. Could you rephrase or provide more details about what you're looking for?";
      source = "context_request";
    }
    
    // Add conversational elements for very short responses
    if (answer.length < 20 && source !== "context_request") {
      answer += " Is there anything specific you'd like to know more about?";
    }

    // Increment usage
    userUsage.set(userId, currentUses + 1);

    res.status(200).json({
      answer,
      uses: currentUses + 1,
      max: MAX_USES,
      source,
      question: cleanPrompt
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