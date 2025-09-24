const express = require("express");
const router = express.Router();
const { sendMessage, getMessages } = require("../controllers/messageController");


// Get chat messages with a user
router.get("/:recipientId", getMessages);

// Send a message to a user
router.post("/:recipientId", sendMessage);

module.exports = router;