const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, maxlength: 10, trim: true, required: true, unique: true },
    email: { type: String, lowercase: true, trim: true, required: true, unique: true },
    password: { type: String },
    googleId: { type: String, default: "" },
    phone: { type: String, trim: true },
    website: {
      type: String,
      default: "",
      trim: true,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^https?:\/\//i.test(v);
        },
        message: 'Website must start with http:// or https://',
      },
    },
    serviceType: { type: String, enum: ['serviceSeeker', 'posting'], required: true },
    bio: { type: String, default: "", trim: true },
    profilePic: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    status: { type: String, default: "", trim: true, maxlength: 32 },
    isVerified: { type: Boolean, default: false } // ADD THIS FIELD
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);