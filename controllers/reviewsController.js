const Review = require('../models/Review');
const User = require('../models/User');
const mongoose = require('mongoose');

// Create a review
exports.createReview = async (req, res) => {
  try {
    const { reviewedUserId, rating, message } = req.body;
    const reviewerId = req.user.id;

    // Validation
    if (!reviewedUserId || !rating || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    if (message.length > 500) {
      return res.status(400).json({ error: 'Message must be less than 500 characters' });
    }

    // Prevent self-review
    if (reviewerId === reviewedUserId) {
      return res.status(400).json({ error: 'You cannot review yourself' });
    }

    // Check if reviewed user exists
    const reviewedUser = await User.findById(reviewedUserId);
    if (!reviewedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({ reviewerId, reviewedUserId });
    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this user' });
    }

    // Create review
    const review = new Review({
      reviewerId,
      reviewedUserId,
      rating,
      message
    });

    await review.save();

    // Populate reviewer details
    await review.populate('reviewerId', 'username profilePic');

    res.status(201).json({
      message: 'Review added successfully',
      review
    });

  } catch (err) {
    console.error('Create review error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get reviews for a user
exports.getUserReviews = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const reviews = await Review.find({ reviewedUserId: userId })
      .populate('reviewerId', 'username profilePic')
      .sort({ createdAt: -1 });

    // Calculate average rating
    const averageRating = await Review.aggregate([
      { $match: { reviewedUserId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, average: { $avg: '$rating' } } }
    ]);

    const avgRating = averageRating.length > 0 ? averageRating[0].average : 0;

    res.status(200).json({
      reviews,
      averageRating: Math.round(avgRating * 10) / 10,
      totalReviews: reviews.length
    });

  } catch (err) {
    console.error('Get reviews error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update a review
exports.updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, message } = req.body;
    const userId = req.user.id;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check if user owns the review
    if (review.reviewerId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to update this review' });
    }

    if (rating) review.rating = rating;
    if (message) review.message = message;

    await review.save();
    await review.populate('reviewerId', 'username profilePic');

    res.status(200).json({
      message: 'Review updated successfully',
      review
    });

  } catch (err) {
    console.error('Update review error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete a review
exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check if user owns the review
    if (review.reviewerId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this review' });
    }

    await Review.findByIdAndDelete(reviewId);

    res.status(200).json({ message: 'Review deleted successfully' });

  } catch (err) {
    console.error('Delete review error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Check if user has reviewed
exports.checkUserReview = async (req, res) => {
  try {
    const { reviewedUserId } = req.params;
    const reviewerId = req.user.id;

    const review = await Review.findOne({ reviewerId, reviewedUserId })
      .populate('reviewerId', 'username profilePic');

    res.status(200).json({ hasReviewed: !!review, review });

  } catch (err) {
    console.error('Check review error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};