const Message = require("../models/Message");
const User = require("../models/User");

// Send a message
exports.sendMessage = async (req, res) => {
  try {
    const { recipientId } = req.params;
    const { text } = req.body;
    const senderId = req.user.id;

    if (!text || !recipientId) {
      return res.status(400).json({ error: "Text and recipient are required." });
    }

    const message = await Message.create({
      sender: senderId,
      recipient: recipientId,
      text,
    });

    res.status(201).json({ message });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// Fetch all messages between two users, with sender username and profilePic
exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recipientId } = req.params;

    // Fetch messages between both users (both directions)
    const messages = await Message.find({
      $or: [
        { sender: userId, recipient: recipientId },
        { sender: recipientId, recipient: userId },
      ],
    })
      .sort("createdAt")
      .populate("sender", "username profilePic") // Get profilePic and username for sender
      .lean();

    const formatted = messages.map((msg) => ({
      _id: msg._id,
      sender: msg.sender._id.toString() === userId ? "me" : msg.sender.username,
      senderProfilePic: msg.sender.profilePic,
      text: msg.text,
      createdAt: msg.createdAt,
    }));

    res.json({ messages: formatted });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};