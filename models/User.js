const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, maxlength: 10, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },

    phone: { type: String, trim: true },

    // Add website so users can save and display it
    website: {
      type: String,
      default: "",
      trim: true,
      // Optional: basic validation to ensure http/https if provided
      validate: {
        validator: function (v) {
          if (!v) return true; // allow empty string
          return /^https?:\/\//i.test(v);
        },
        message: 'Website must start with http:// or https://',
      },
    },

    serviceType: { type: String, enum: ['finding', 'posting'], required: true },

    bio: { type: String, default: "", trim: true },
    profilePic: { type: String, default: "" },
    coverImage: { type: String, default: "" },
  },
  { timestamps: true }
);

// Optional: ensure unique index is created (especially useful in dev)
userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);