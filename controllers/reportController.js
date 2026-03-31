const Report = require('../models/Report');
const User = require('../models/User');

// Create a new report
const createReport = async (req, res) => {
  try {
    const { postId, reason } = req.body;
    const userId = req.user?.id || null;

    if (!postId || !reason) {
      return res.status(400).json({ message: 'postId and reason are required.' });
    }

    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      return res.status(400).json({ message: 'Please provide a more detailed reason.' });
    }

    const report = await Report.create({ postId, reporter: userId, reason: trimmed });
    await report.populate('reporter', 'username email profilePic').catch(() => {});

    res.status(201).json({ message: 'Report submitted successfully.', report });
  } catch (err) {
    console.error('Create report error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all reports (admin)
const getAllReports = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    let query = {};
    if (status && ['pending', 'reviewed', 'dismissed'].includes(status)) query.status = status;

    const reports = await Report.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('reporter', 'username email profilePic')
      .lean();

    const total = await Report.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      reports,
      pagination: { currentPage: pageNum, totalPages, totalReports: total }
    });
  } catch (err) {
    console.error('Get reports error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update report status (admin)
const updateReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body;

    if (!['pending', 'reviewed', 'dismissed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const report = await Report.findById(reportId).populate('reporter', 'username email profilePic');
    if (!report) return res.status(404).json({ message: 'Report not found.' });

    report.status = status;
    await report.save();

    res.json({ message: 'Report status updated.', report });
  } catch (err) {
    console.error('Update report status error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a report (admin)
const deleteReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await Report.findById(reportId);
    if (!report) return res.status(404).json({ message: 'Report not found.' });

    await Report.findByIdAndDelete(reportId);
    res.json({ message: 'Report deleted successfully.' });
  } catch (err) {
    console.error('Delete report error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createReport,
  getAllReports,
  updateReportStatus,
  deleteReport
};
