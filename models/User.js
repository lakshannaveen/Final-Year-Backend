const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, maxlength: 10, trim: true },
    email: { type: String, lowercase: true, trim: true, required: true },
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
    serviceType: { type: String, enum: ['finding', 'posting'], required: true },
    bio: { type: String, default: "", trim: true },
    profilePic: { type: String, default: "" },
    coverImage: { type: String, default: "" },
  },
  { timestamps: true }
);

// Compound unique index: email + serviceType
userSchema.index({ email: 1, serviceType: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);