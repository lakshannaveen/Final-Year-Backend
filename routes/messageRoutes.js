const express = require("express");
const router = express.Router();
const { getMessages } = require("../controllers/messageController");
const { requireAuth } = require("../middleware/auth");

module.exports = (io) => {
  const { sendMessage } = require("../controllers/messageController");

  router.get("/:recipientId", requireAuth, getMessages);
  router.post("/:recipientId", requireAuth, sendMessage(io));
  return router;
};