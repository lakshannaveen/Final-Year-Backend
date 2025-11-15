const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true,
      minlength: 2,
      maxlength: 50
    },
    email: { 
      type: String, 
      required: true, 
      trim: true,
      lowercase: true
    },
    message: { 
      type: String, 
      required: true, 
      trim: true,
      minlength: 2,
      maxlength: 1000
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved'],
      default: 'pending'
    },
    phone: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

// Index for better query performance
contactSchema.index({ status: 1 });
contactSchema.index({ createdAt: -1 });
contactSchema.index({ email: 1 });

module.exports = mongoose.model('Contact', contactSchema);