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

    // Read current serviceType to enforce rules
    const current = await User.findById(userId).select('serviceType');
    if (!current) return res.status(404).json({ errors: { user: 'User not found' } });

    let { bio, profilePic, coverImage, phone, website } = req.body;

    // If the user is not a posting account, ignore phone, website, and cover updates
    if (current.serviceType !== 'posting') {
      phone = undefined;
      website = undefined;
      coverImage = undefined;
    } else {
      // Normalize website to include protocol if provided
      if (typeof website === 'string' && website.trim() !== '') {
        website =
          website.startsWith('http://') || website.startsWith('https://')
            ? website.trim()
            : `https://${website.trim()}`;
      }
    }

    const update = { bio, profilePic, coverImage, phone, website };
    // remove undefined keys to avoid overwriting unintentionally
    for (const key in update) {
      if (update[key] === undefined) delete update[key];
    }

    const user = await User.findByIdAndUpdate(userId, update, {
      new: true,
      runValidators: true,
    }).select('-password');

    res.status(200).json({ user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ errors: { server: 'Server error' } });
  }
};

// Upload Image to Backblaze B2
exports.uploadImage = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ errors: { image: 'No image uploaded' } });

    // Authorize with Backblaze B2 and get the correct download URL for your account/cluster
    const auth = await b2.authorize();
    const downloadUrl = auth.data.downloadUrl; // e.g., https://f003.backblazeb2.com

    // Get upload URL for the target bucket
    const uploadUrlResponse = await b2.getUploadUrl({
      bucketId: process.env.B2_BUCKET_ID,
    });

    const uploadUrl = uploadUrlResponse.data.uploadUrl;
    const uploadAuthToken = uploadUrlResponse.data.authorizationToken;

    // Generate unique file name
    const fileName = `profile/${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;

    // Upload file to B2
    await b2.uploadFile({
      uploadUrl,
      uploadAuthToken,
      fileName,
      data: file.buffer,
      contentType: file.mimetype,
    });

    // Construct public URL using the correct downloadUrl
    const imageUrl = `${downloadUrl}/file/${process.env.B2_BUCKET_NAME}/${fileName}`;

    res.status(200).json({ imageUrl });
  } catch (err) {
    console.error('B2 Upload Error:', err);
    res.status(500).json({ errors: { server: 'Upload failed', details: err.message } });
  }
};
// Get Public Profile by ID or username
exports.getPublicProfile = async (req, res) => {
  try {
    const { idOrUsername } = req.params;
    let user;
    if (/^[0-9a-fA-F]{24}$/.test(idOrUsername)) {
      // Looks like a MongoDB ObjectId
      user = await User.findById(idOrUsername).select('-password -email -phone -website');
    } else {
      // Otherwise treat as username
      user = await User.findOne({ username: idOrUsername }).select('-password -email -phone -website');
    }
    if (!user) return res.status(404).json({ errors: { user: 'User not found' } });
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ errors: { server: 'Server error' } });
  }
};