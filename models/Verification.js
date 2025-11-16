const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    docType: {
      type: String,
      enum: ['nic', 'dl'],
      required: true
    },
    nicFront: { type: String, default: "" },
    nicBack: { type: String, default: "" },
    dlFront: { type: String, default: "" },
    dlBack: { type: String, default: "" },
    businessCert: { type: String, default: "" },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewNotes: { type: String, default: "" },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date }
  },
  { timestamps: true }
);

// Index for faster queries
verificationSchema.index({ user: 1 });
verificationSchema.index({ status: 1 });

module.exports = mongoose.model('Verification', verificationSchema);