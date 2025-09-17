const Feed = require('../models/Feed'); // Make sure the filename and registration is Feed.js
const B2 = require('backblaze-b2');
const dotenv = require('dotenv');
dotenv.config();

const b2 = new B2({
  applicationKeyId: process.env.B2_KEY_ID,
  applicationKey: process.env.B2_APPLICATION_KEY,
});

// Create a new service post
exports.createFeed = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title,
      location,
      contactNumber,
      price,
      priceType,
      priceCurrency,
      photo,
      video,
      websiteLink,
      description,
    } = req.body;

    if (!title || !location || !contactNumber || !price || !priceType) {
      return res.status(400).json({ errors: { server: "Missing required fields" } });
    }

    const feed = new Feed({
      user: userId,
      title,
      location,
      contactNumber,
      price,
      priceType,
      priceCurrency,
      photo,
      video,
      websiteLink,
      description,
    });

    await feed.save();
    res.status(201).json({ feed });
  } catch (err) {
    console.error("Create feed error:", err);
    res.status(500).json({ errors: { server: "Failed to create post" } });
  }
};

// Get all feeds with user's username and profilePic
exports.getAllFeedsWithUser = async (req, res) => {
  try {
    const feeds = await Feed.find()
      .sort({ createdAt: -1 })
      .populate("user", "username profilePic");
    res.status(200).json({ feeds });
  } catch (err) {
    console.error("Get all feeds error:", err);
    res.status(500).json({ errors: { server: "Failed to fetch posts" } });
  }
};

// Get one post by ID
exports.getFeedById = async (req, res) => {
  try {
    const { id } = req.params;
    const feed = await Feed.findById(id).populate("user", "username serviceType profilePic");
    if (!feed) return res.status(404).json({ errors: { feed: "Post not found" } });
    res.status(200).json({ feed });
  } catch (err) {
    res.status(500).json({ errors: { server: "Failed to fetch post" } });
  }
};

// Upload Image/Video to Backblaze B2 for Feed
exports.uploadFeedMedia = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ errors: { file: 'No file uploaded' } });

    // Authorize with Backblaze B2
    const auth = await b2.authorize();
    const downloadUrl = auth.data.downloadUrl;

    // Get upload URL for the target bucket
    const uploadUrlResponse = await b2.getUploadUrl({
      bucketId: process.env.B2_BUCKET_ID,
    });

    const uploadUrl = uploadUrlResponse.data.uploadUrl;
    const uploadAuthToken = uploadUrlResponse.data.authorizationToken;

    // Generate unique file name in "feed/" folder
    const fileName = `feed/${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;

    // Upload file to B2
    await b2.uploadFile({
      uploadUrl,
      uploadAuthToken,
      fileName,
      data: file.buffer,
      contentType: file.mimetype,
    });

    // Construct public URL
    const fileUrl = `${downloadUrl}/file/${process.env.B2_BUCKET_NAME}/${fileName}`;

    res.status(200).json({ fileUrl });
  } catch (err) {
    console.error('Feed B2 Upload Error:', err);
    res.status(500).json({ errors: { server: 'Upload failed', details: err.message } });
  }
};
exports.getMyFeeds = async (req, res) => {
  try {
    const userId = req.user.id;
    const feeds = await Feed.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("user", "username profilePic");
    res.status(200).json({ feeds });
  } catch (err) {
    console.error("Get my feeds error:", err);
    res.status(500).json({ errors: { server: "Failed to fetch your posts" } });
  }
};