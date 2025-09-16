const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, maxlength: 10 },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String },
  serviceType: { type: String, enum: ['finding', 'posting'], required: true },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);