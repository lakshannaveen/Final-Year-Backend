const Message = require("../models/Message");
const Feed = require("../models/Feed");
const User = require('../models/User');

exports.sendMessage = (io) => async (req, res) => {
  try {
    const { recipientId } = req.params;
    const { text, postId } = req.body;
    const senderId = req.user.id;

    if (!text || !recipientId) {
      return res.status(400).json({ error: "Text and recipient are required." });
    }

    if (postId) {
      const post = await Feed.findById(postId);
      if (!post) return res.status(400).json({ error: "Post not found." });
    }

    // Create message
    const message = await Message.create({
      sender: senderId,
      recipient: recipientId,
      postId: postId || undefined,
      text,
    });

    // Populate sender and recipient details
    await message.populate("sender", "username profilePic");
    await message.populate("recipient", "username profilePic");

    // Format for frontend
    const formatted = {
      _id: message._id,
      sender: message.sender.username, // Keep as username for recipient
      senderId: message.sender._id.toString(),
      senderProfilePic: message.sender.profilePic,
      recipientId: message.recipient._id.toString(),
      recipientUsername: message.recipient.username,
      postId: message.postId,
      text: message.text,
      createdAt: message.createdAt,
    };

    // Real-time delivery to both users with proper formatting
    const recipientMessage = { ...formatted };
    const senderMessage = { 
      ...formatted, 
      sender: "me" // Mark as "me" for sender
    };

    // Emit to both users via Socket.IO
    io.to(recipientId).emit("receiveMessage", recipientMessage);
    io.to(senderId).emit("receiveMessage", senderMessage);

    // Return sender-formatted message for the API response
    res.status(201).json({ message: senderMessage });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recipientId } = req.params;
    const { postId } = req.query;

    let query = {
      $or: [
        { sender: userId, recipient: recipientId },
        { sender: recipientId, recipient: userId },
      ],
    };
    if (postId) query.postId = postId;

    const messages = await Message.find(query)
      .sort("createdAt")
      .populate("sender", "username profilePic")
      .populate("recipient", "username profilePic")
      .lean();

    const formatted = messages.map((msg) => ({
      _id: msg._id,
      sender: msg.sender._id.toString() === userId ? "me" : msg.sender.username,
      senderId: msg.sender._id.toString(),
      senderProfilePic: msg.sender.profilePic,
      recipientId: msg.recipient._id.toString(),
      recipientUsername: msg.recipient.username,
      postId: msg.postId,
      text: msg.text,
      createdAt: msg.createdAt,
    }));

    res.json({ messages: formatted });
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get inbox with chat summaries
exports.getInbox = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userId = req.user.id;

    // Find all messages involving this user, latest first
    const messages = await Message.find({
      $or: [{ sender: userId }, { recipient: userId }]
    })
      .sort({ createdAt: -1 })
      .populate("sender", "username profilePic")
      .populate("recipient", "username profilePic");

    // Group by the OTHER user in each message
    const chatMap = new Map();
    messages.forEach((msg) => {
      const otherUser =
        msg.sender._id.toString() === userId ? msg.recipient : msg.sender;
      const key = otherUser._id.toString();
      
      // Only add if not already present (to get the latest message per chat)
      if (!chatMap.has(key)) {
        chatMap.set(key, {
          recipientId: otherUser._id.toString(),
          recipientUsername: otherUser.username,
          recipientProfilePic: otherUser.profilePic,
          lastMessage: msg.text,
          lastMessageTime: msg.createdAt
        });
      }
    });

    const chatSummaries = Array.from(chatMap.values());

    res.json({ chats: chatSummaries });
  } catch (err) {
    console.error("getInbox internal error:", err);
    res.status(500).json({ error: "Server error", details: err?.message });
  }
};