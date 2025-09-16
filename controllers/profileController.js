const User = require('../models/User');
const B2 = require('backblaze-b2');
const dotenv = require('dotenv');
dotenv.config();

const b2 = new B2({
  applicationKeyId: process.env.B2_KEY_ID,
  applicationKey: process.env.B2_APPLICATION_KEY,
});

// Get Profile
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

// Update Profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bio, profilePic, coverImage, phone, website } = req.body;
    const update = { bio, profilePic, coverImage, phone, website };
    for (let key in update) if (update[key] === undefined) delete update[key];
    const user = await User.findByIdAndUpdate(
      userId,
      update,
      { new: true, runValidators: true }
    ).select('-password');
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ errors: { server: 'Server error' } });
  }
};

// Upload Image to Backblaze B2
exports.uploadImage = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ errors: { image: 'No image uploaded' } });

    // Authorize with Backblaze B2
    await b2.authorize();
    
    // Get upload URL
    const uploadUrlResponse = await b2.getUploadUrl({
      bucketId: process.env.B2_BUCKET_ID
    });
    
    const uploadUrl = uploadUrlResponse.data.uploadUrl;
    const uploadAuthToken = uploadUrlResponse.data.authorizationToken;

    // Generate unique file name
    const fileName = `profile/${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
    
    // Upload file to B2
    const b2Response = await b2.uploadFile({
      uploadUrl: uploadUrl,
      uploadAuthToken: uploadAuthToken,
      fileName: fileName,
      data: file.buffer,
      contentType: file.mimetype,
    });

    // Construct public URL
    const imageUrl = `https://f005.backblazeb2.com/file/${process.env.B2_BUCKET_NAME}/${fileName}`;
    
    res.status(200).json({ imageUrl });
  } catch (err) {
    console.error('B2 Upload Error:', err);
    res.status(500).json({ errors: { server: 'Upload failed', details: err.message } });
  }
};