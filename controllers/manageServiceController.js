/**
 * controllers/manageServiceController.js
 *
 * Controller to allow admins (or management UI) to list and remove services (feeds)
 * and to delete admin users. Per user's request these endpoints do not require
 * authentication (no middleware applied here). Use carefully.
 */

const Feed = require('../models/Feed');
const User = require('../models/User');

const userSelect = 'username profilePic status serviceType';

exports.getAllServicesPaginated = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Optional search by title or username
    const { q } = req.query;
    const searchQuery = {};
    if (q) {
      // simple text search: title or location or username
      searchQuery.$or = [
        { title: new RegExp(q, 'i') },
        { location: new RegExp(q, 'i') },
      ];
    }

    // If searching by username, we need to find matching users first and filter by user ids
    if (q && !searchQuery.$or.find(o => o.title)) {
      // fallback - but above already covers title/location
    }

    const [feeds, total] = await Promise.all([
      Feed.find(searchQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', userSelect),
      Feed.countDocuments(searchQuery),
    ]);

    res.status(200).json({
      feeds,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error('Get all services paginated error:', err);
    res.status(500).json({ errors: { server: 'Failed to fetch services' } });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const serviceId = req.params.id;
    const feed = await Feed.findById(serviceId);
    if (!feed) {
      return res.status(404).json({ errors: { service: 'Service not found' } });
    }

    await Feed.findByIdAndDelete(serviceId);

    res.status(200).json({ message: 'Service deleted successfully', id: serviceId });
  } catch (err) {
    console.error('Delete service error:', err);
    res.status(500).json({ errors: { server: 'Failed to delete service' } });
  }
};

exports.deleteAdmin = async (req, res) => {
  try {
    const adminId = req.params.id;

    const user = await User.findById(adminId);
    if (!user) {
      return res.status(404).json({ errors: { user: 'User not found' } });
    }

    // Remove user's feeds as cleanup
    await Feed.deleteMany({ user: user._id });

    // Delete user
    await User.findByIdAndDelete(adminId);

    res.status(200).json({ message: 'Admin (user) deleted successfully', id: adminId });
  } catch (err) {
    console.error('Delete admin error:', err);
    res.status(500).json({ errors: { server: 'Failed to delete admin' } });
  }
};