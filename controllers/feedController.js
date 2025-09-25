const Feed = require('../models/Feed');
const B2 = require('backblaze-b2');
const dotenv = require('dotenv');
dotenv.config();

const b2 = new B2({
  applicationKeyId: process.env.B2_KEY_ID,
  applicationKey: process.env.B2_APPLICATION_KEY,
});

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

// PAGINATED FEEDS ENDPOINT for infinite scrolling
exports.getFeedsPaginated = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    const [feeds, total] = await Promise.all([
      Feed.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("user", "username profilePic"),
      Feed.countDocuments(),
    ]);

    res.status(200).json({
      feeds,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error("Get paginated feeds error:", err);
    res.status(500).json({ errors: { server: "Failed to fetch posts" } });
  }
};

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

exports.uploadFeedMedia = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ errors: { file: 'No file uploaded' } });

    const auth = await b2.authorize();
    const downloadUrl = auth.data.downloadUrl;

    const uploadUrlResponse = await b2.getUploadUrl({
      bucketId: process.env.B2_BUCKET_ID,
    });

    const uploadUrl = uploadUrlResponse.data.uploadUrl;
    const uploadAuthToken = uploadUrlResponse.data.authorizationToken;

    const fileName = `feed/${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;

    await b2.uploadFile({
      uploadUrl,
      uploadAuthToken,
      fileName,
      data: file.buffer,
      contentType: file.mimetype,
    });

    const fileUrl = `${downloadUrl}/file/${process.env.B2_BUCKET_NAME}/${fileName}`;

    res.status(200).json({ fileUrl });
  } catch (err) {
    console.error('Feed B2 Upload Error:', err);
    res.status(500).json({ errors: { server: 'Upload failed', details: err.message } });
  }
};

exports.getMyFeedsPaginated = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    const [feeds, total] = await Promise.all([
      Feed.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("user", "username profilePic"),
      Feed.countDocuments({ user: userId }),
    ]);

    res.status(200).json({
      feeds,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error("Get my paginated feeds error:", err);
    res.status(500).json({ errors: { server: "Failed to fetch your posts" } });
  }
};


exports.deleteFeed = async (req, res) => {
  try {
    const feedId = req.params.id;
    const userId = req.user.id;
    const feed = await Feed.findById(feedId);
    if (!feed) {
      return res.status(404).json({ errors: { server: "Post not found" } });
    }
    if (feed.user.toString() !== userId) {
      return res.status(403).json({ errors: { server: "Unauthorized" } });
    }
    await Feed.findByIdAndDelete(feedId);
    res.status(200).json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("Delete feed error:", err);
    res.status(500).json({ errors: { server: "Failed to delete post" } });
  }
};

exports.updateFeed = async (req, res) => {
  try {
    const feedId = req.params.id;
    const userId = req.user.id;
    const feed = await Feed.findById(feedId);
    if (!feed) {
      return res.status(404).json({ errors: { server: "Post not found" } });
    }
    if (feed.user.toString() !== userId) {
      return res.status(403).json({ errors: { server: "Unauthorized" } });
    }

    const {
      title,
      location,
      price,
      priceType,
      priceCurrency,
      description,
      websiteLink
    } = req.body;

    if (title !== undefined) feed.title = title;
    if (location !== undefined) feed.location = location;
    if (price !== undefined) feed.price = price;
    if (priceType !== undefined) feed.priceType = priceType;
    if (priceCurrency !== undefined) feed.priceCurrency = priceCurrency;
    if (description !== undefined) feed.description = description;
    if (websiteLink !== undefined) feed.websiteLink = websiteLink;

    await feed.save();
    res.status(200).json({ feed });
  } catch (err) {
    console.error("Update feed error:", err);
    res.status(500).json({ errors: { server: "Failed to update post" } });
  }
};