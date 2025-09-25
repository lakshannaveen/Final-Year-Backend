const Message = require("../models/Message");
const Feed = require("../models/Feed");

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

    const message = await Message.create({
      sender: senderId,
      recipient: recipientId,
      postId: postId || undefined,
      text,
    });

    await message.populate("sender", "username profilePic");
    await message.populate("recipient", "username profilePic");

    // Format for frontend
    const formatted = {
      _id: message._id,
      sender: senderId === message.sender._id.toString() ? "me" : message.sender.username,
      senderId: message.sender._id,
      senderProfilePic: message.sender.profilePic,
      recipientId: message.recipient._id,
      recipientUsername: message.recipient.username,
      postId: message.postId,
      text: message.text,
      createdAt: message.createdAt,
    };

    // Real-time delivery
    io.emit("receiveMessage", formatted);

    res.status(201).json({ message: formatted });
  } catch (err) {
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
      senderId: msg.sender._id,
      senderProfilePic: msg.sender.profilePic,
      recipientId: msg.recipient._id,
      recipientUsername: msg.recipient.username,
      postId: msg.postId,
      text: msg.text,
      createdAt: msg.createdAt,
    }));

    res.json({ messages: formatted });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};