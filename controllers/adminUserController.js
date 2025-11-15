const User = require('../models/User');

// Get all users with pagination and filtering
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const serviceType = req.query.serviceType || '';
    const skip = (page - 1) * limit;

    // Build search filter
    let filter = {};
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (serviceType) {
      filter.serviceType = serviceType;
    }

    // Get users with pagination
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit);

    res.status(200).json({
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Server error while fetching users' });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ user });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Server error while fetching user' });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { username, email, phone, website, bio, status, profilePic } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { 
        username, 
        email, 
        phone, 
        website, 
        bio, 
        status,
        // include profilePic if provided (if undefined it will set undefined; using conditional below)
        ...(profilePic !== undefined ? { profilePic } : {}),
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ 
      message: 'User updated successfully', 
      user 
    });
  } catch (error) {
    console.error('Update user error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Server error while updating user' });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error while deleting user' });
  }
};

// Get user statistics
exports.getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const serviceSeekerCount = await User.countDocuments({ serviceType: 'serviceSeeker' });
    const postingCount = await User.countDocuments({ serviceType: 'posting' });
    
    // Users created in last 7 days
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const newUsersThisWeek = await User.countDocuments({ 
      createdAt: { $gte: lastWeek } 
    });

    // Users created in last 30 days
    const lastMonth = new Date();
    lastMonth.setDate(lastMonth.getDate() - 30);
    const newUsersThisMonth = await User.countDocuments({ 
      createdAt: { $gte: lastMonth } 
    });

    res.status(200).json({
      totalUsers,
      serviceSeekerCount,
      postingCount,
      newUsersThisWeek,
      newUsersThisMonth
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Server error while fetching user statistics' });
  }
};