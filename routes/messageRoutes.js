const express = require("express");
const router = express.Router();
const { getMessages, getInbox } = require("../controllers/messageController");
const { requireAuth } = require("../middleware/auth");

module.exports = (io) => {
  const { sendMessage } = require("../controllers/messageController");

  router.get("/inbox", requireAuth, getInbox); // <-- Place this BEFORE /:recipientId
  router.get("/:recipientId", requireAuth, getMessages);
  router.post("/:recipientId", requireAuth, sendMessage(io));
  return router;
};