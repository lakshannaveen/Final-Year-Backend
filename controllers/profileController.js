const User = require('../models/User');

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ errors: { user: 'User not found' } });
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ errors: { server: 'Server error' } });
  }
};

// Profile update (bio, profilePic, coverImage)
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bio, profilePic, coverImage } = req.body;
    const user = await User.findByIdAndUpdate(
      userId,
      { bio, profilePic, coverImage },
      { new: true, runValidators: true }
    ).select('-password');
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ errors: { server: 'Server error' } });
  }
};