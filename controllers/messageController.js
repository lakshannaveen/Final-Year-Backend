const Message = require("../models/Message");
const User = require("../models/User");
const Feed = require("../models/Feed");

// Send a message (now supports postId)
exports.sendMessage = async (req, res) => {
  try {
    const { recipientId } = req.params;
    const { text, postId } = req.body;
    const senderId = req.user.id;

    console.log("DEBUG sendMessage:", { senderId, recipientId, postId, text });

    if (!text || !recipientId) {
      return res.status(400).json({ error: "Text and recipient are required." });
    }

    // Optionally you can check if postId exists in Feed collection
    let post = null;
    if (postId) {
      post = await Feed.findById(postId);
      if (!post) {
        return res.status(400).json({ error: "Post not found." });
      }
    }

    const message = await Message.create({
      sender: senderId,
      recipient: recipientId,
      postId: postId || undefined,
      text,
    });

    res.status(201).json({ message });
  } catch (err) {
    console.error("sendMessage ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Fetch all messages between two users (optionally filtered by postId)
exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recipientId } = req.params;
    const { postId } = req.query; // pass postId as query param

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
      senderId: msg.sender._id,
      senderProfilePic: msg.sender.profilePic,
      recipientId: msg.recipient._id,
      recipientUsername: msg.recipient.username,
      postId: msg.postId,
      text: msg.text,
      createdAt: msg.createdAt,
    }));

    console.log("DEBUG getMessages:", formatted);

    res.json({ messages: formatted });
  } catch (err) {
    console.error("getMessages ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
};