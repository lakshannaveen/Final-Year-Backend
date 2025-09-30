const express = require("express");
const router = express.Router();
const { getMessages, getInbox, markAsRead, getUnreadCount, markAllAsRead, markAllInboxRead } = require("../controllers/messageController");
const { requireAuth } = require("../middleware/auth");

module.exports = (io) => {
  const { sendMessage } = require("../controllers/messageController");

  router.get("/inbox", requireAuth, getInbox);
  router.get("/unread-count", requireAuth, getUnreadCount);
  router.get("/:recipientId", requireAuth, getMessages);
  router.post("/:recipientId", requireAuth, sendMessage(io));
  router.put("/:messageId/read", requireAuth, markAsRead);
  router.put("/:recipientId/mark-all-read", requireAuth, markAllAsRead);
  router.put("/mark-all-inbox-read", requireAuth, markAllInboxRead); // New route
  
  return router;
};