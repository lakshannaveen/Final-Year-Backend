const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Feed", required: false },
    text: { type: String, required: true },
    read: { type: Boolean, default: false }, 
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);