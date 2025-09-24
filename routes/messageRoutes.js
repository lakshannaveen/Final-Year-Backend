const express = require("express");
const router = express.Router();
const { sendMessage, getMessages } = require("../controllers/messageController");
const { requireAuth } = require("../middleware/auth");

// Get chat messages with a user (optionally by post)
router.get("/:recipientId", requireAuth, getMessages);

// Send a message to a user (optionally for a post)
router.post("/:recipientId", requireAuth, sendMessage);

module.exports = router;