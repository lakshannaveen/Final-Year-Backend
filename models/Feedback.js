const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    message: { 
      type: String, 
      required: true, 
      trim: true,
      minlength: 2,
      maxlength: 1000
    },
    rating: { 
      type: Number, 
      required: true, 
      min: 1, 
      max: 5 
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved'],
      default: 'pending'
    }
  },
  { timestamps: true }
);

// Index for better query performance
feedbackSchema.index({ user: 1, createdAt: -1 });
feedbackSchema.index({ status: 1 });

module.exports = mongoose.model('Feedback', feedbackSchema);