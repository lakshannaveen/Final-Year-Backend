const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Feed', required: true },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, required: true, trim: true },
    status: { type: String, enum: ['pending', 'reviewed', 'dismissed'], default: 'pending' },
    metadata: { type: Object, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
