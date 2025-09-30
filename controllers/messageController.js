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

    // Create message (unread by default)
    const message = await Message.create({
      sender: senderId,
      recipient: recipientId,
      postId: postId || undefined,
      text,
      read: false
    });

    // Populate sender and recipient details
    await message.populate("sender", "username profilePic");
    await message.populate("recipient", "username profilePic");

    // Format for frontend
    const formatted = {
      _id: message._id,
      sender: message.sender.username,
      senderId: message.sender._id.toString(),
      senderProfilePic: message.sender.profilePic,
      recipientId: message.recipient._id.toString(),
      recipientUsername: message.recipient.username,
      postId: message.postId,
      text: message.text,
      read: message.read,
      createdAt: message.createdAt,
    };

    // Real-time delivery to both users with proper formatting
    const recipientMessage = { ...formatted };
    const senderMessage = { 
      ...formatted, 
      sender: "me",
      read: true // Messages sent by user are automatically read
    };

    // Emit to both users via Socket.IO
    io.to(recipientId).emit("receiveMessage", recipientMessage);
    io.to(senderId).emit("receiveMessage", senderMessage);

    // Emit unread count update to recipient
    const unreadCount = await Message.countDocuments({
      recipient: recipientId,
      read: false
    });
    io.to(recipientId).emit("unreadCountUpdate", { unreadCount });

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
      read: msg.read,
      createdAt: msg.createdAt,
    }));

    res.json({ messages: formatted });
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get inbox with chat summaries and unread counts
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

    // Group by the OTHER user in each message and count unread
    const chatMap = new Map();
    const unreadCountsMap = new Map();

    messages.forEach((msg) => {
      const otherUser = msg.sender._id.toString() === userId ? msg.recipient : msg.sender;
      const key = otherUser._id.toString();
      
      // Count unread messages for this chat
      if (msg.recipient._id.toString() === userId && !msg.read) {
        unreadCountsMap.set(key, (unreadCountsMap.get(key) || 0) + 1);
      }
      
      // Only add if not already present (to get the latest message per chat)
      if (!chatMap.has(key)) {
        chatMap.set(key, {
          recipientId: otherUser._id.toString(),
          recipientUsername: otherUser.username,
          recipientProfilePic: otherUser.profilePic,
          lastMessage: msg.text,
          lastMessageTime: msg.createdAt,
          unreadCount: unreadCountsMap.get(key) || 0
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

// Get total unread count for navbar
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const unreadCount = await Message.countDocuments({
      recipient: userId,
      read: false
    });

    res.json({ unreadCount });
  } catch (err) {
    console.error("Get unread count error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId)
      .populate("sender", "username profilePic")
      .populate("recipient", "username profilePic");

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if user is the recipient
    if (message.recipient._id.toString() !== userId) {
      return res.status(403).json({ error: "Not authorized to mark this message as read" });
    }

    // Mark as read
    message.read = true;
    await message.save();

    // Emit unread count update to user
    const unreadCount = await Message.countDocuments({
      recipient: userId,
      read: false
    });

    // Emit via Socket.IO if available
    if (req.app.get('io')) {
      req.app.get('io').to(userId).emit("unreadCountUpdate", { unreadCount });
    }

    res.json({ 
      message: "Message marked as read",
      unreadCount 
    });
  } catch (err) {
    console.error("Mark as read error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Mark all messages from a user as read
exports.markAllAsRead = async (req, res) => {
  try {
    const { recipientId } = req.params;
    const userId = req.user.id;

    // Mark all unread messages from this sender as read
    const result = await Message.updateMany(
      {
        sender: recipientId,
        recipient: userId,
        read: false
      },
      {
        $set: { read: true }
      }
    );

    // Get updated unread count
    const unreadCount = await Message.countDocuments({
      recipient: userId,
      read: false
    });

    // Emit unread count update to user
    if (req.app.get('io')) {
      req.app.get('io').to(userId).emit("unreadCountUpdate", { unreadCount });
    }

    res.json({ 
      message: "All messages marked as read",
      modifiedCount: result.modifiedCount,
      unreadCount 
    });
  } catch (err) {
    console.error("Mark all as read error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
// Mark all messages in inbox as read
exports.markAllInboxRead = async (req, res) => {
  try {
    const userId = req.user.id;

    // Mark all unread messages for this user as read
    const result = await Message.updateMany(
      {
        recipient: userId,
        read: false
      },
      {
        $set: { read: true }
      }
    );

    // Get updated unread count
    const unreadCount = await Message.countDocuments({
      recipient: userId,
      read: false
    });

    // Emit unread count update to user
    if (req.app.get('io')) {
      req.app.get('io').to(userId).emit("unreadCountUpdate", { unreadCount });
    }

    res.json({ 
      message: "All messages marked as read",
      modifiedCount: result.modifiedCount,
      unreadCount 
    });
  } catch (err) {
    console.error("Mark all inbox as read error:", err);
    res.status(500).json({ error: "Server error" });
  }
};