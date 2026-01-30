const Feedback = require("../models/Feedback");
const User = require('../models/User');

// Submit feedback
const submitFeedback = async (req, res) => {
  try {
    const { message, rating } = req.body;
    const userId = req.user.id;

    console.log("Feedback submission - User ID:", userId);
    console.log("Feedback data:", { message, rating });

    // Validation
    if (!message || !rating) {
      return res.status(400).json({ error: "Message and rating are required." });
    }

    const wordCount = message.trim().split(/\s+/).length;
    if (wordCount < 2) {
      return res.status(400).json({ error: "Message must be at least 2 words." });
    }
    if (wordCount > 50) {
      return res.status(400).json({ error: "Message must not exceed 50 words." });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5." });
    }

    // Create feedback
    const feedback = await Feedback.create({
      user: userId,
      message: message.trim(),
      rating,
      status: 'pending'
    });

    // Populate user details
    await feedback.populate("user", "username profilePic email");

    res.status(201).json({
      message: "Feedback submitted successfully!",
      feedback: {
        _id: feedback._id,
        message: feedback.message,
        rating: feedback.rating,
        status: feedback.status,
        createdAt: feedback.createdAt,
        user: {
          username: feedback.user.username,
          profilePic: feedback.user.profilePic,
          email: feedback.user.email
        }
      }
    });
  } catch (err) {
    console.error("Submit feedback error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get all feedbacks
const getAllFeedbacks = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    let query = {};
    if (status && ['pending', 'reviewed', 'resolved'].includes(status)) {
      query.status = status;
    }

    const feedbacks = await Feedback.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("user", "username profilePic email")
      .lean();

    const total = await Feedback.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum);

    // Format response
    const formattedFeedbacks = feedbacks.map(feedback => ({
      _id: feedback._id,
      message: feedback.message,
      rating: feedback.rating,
      status: feedback.status,
      createdAt: feedback.createdAt,
      user: {
        username: feedback.user.username,
        profilePic: feedback.user.profilePic,
        email: feedback.user.email
      }
    }));

    res.json({
      feedbacks: formattedFeedbacks,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalFeedbacks: total,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
  } catch (err) {
    console.error("Get feedbacks error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get feedback stats
const getFeedbackStats = async (req, res) => {
  try {
    const stats = await Feedback.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = await Feedback.countDocuments();
    const averageRating = await Feedback.aggregate([
      {
        $group: {
          _id: null,
          average: { $avg: '$rating' }
        }
      }
    ]);

    const statsObj = {
      total,
      averageRating: averageRating[0]?.average || 0,
      pending: 0,
      reviewed: 0,
      resolved: 0
    };

    stats.forEach(stat => {
      statsObj[stat._id] = stat.count;
    });

    res.json(statsObj);
  } catch (err) {
    console.error("Get feedback stats error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Update feedback status
const updateFeedbackStatus = async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const { status } = req.body;

    if (!['pending', 'reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }

    const feedback = await Feedback.findById(feedbackId)
      .populate("user", "username profilePic email");

    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found." });
    }

    feedback.status = status;
    await feedback.save();

    res.json({
      message: "Feedback status updated successfully!",
      feedback: {
        _id: feedback._id,
        message: feedback.message,
        rating: feedback.rating,
        status: feedback.status,
        createdAt: feedback.createdAt,
        user: {
          username: feedback.user.username,
          profilePic: feedback.user.profilePic,
          email: feedback.user.email
        }
      }
    });
  } catch (err) {
    console.error("Update feedback status error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Delete feedback
const deleteFeedback = async (req, res) => {
  try {
    const { feedbackId } = req.params;

    const feedback = await Feedback.findById(feedbackId);
    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found." });
    }

    await Feedback.findByIdAndDelete(feedbackId);

    res.json({ message: "Feedback deleted successfully!" });
  } catch (err) {
    console.error("Delete feedback error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  submitFeedback,
  getAllFeedbacks,
  getFeedbackStats,
  updateFeedbackStatus,
  deleteFeedback
};