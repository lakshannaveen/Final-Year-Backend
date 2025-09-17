const mongoose = require('mongoose');

const feedSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 250 },
    location: { type: String, required: true, trim: true },
    contactNumber: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    priceType: { type: String, enum: ['hourly', 'task'], required: true },
    priceCurrency: { type: String, default: 'LKR' },
    photo: { type: String, default: "" },
    video: { type: String, default: "" },
    websiteLink: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Feed', feedSchema);