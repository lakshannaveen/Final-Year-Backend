const express = require('express');
const router = express.Router();
const {
  createReport,
  getAllReports,
  updateReportStatus,
  deleteReport
} = require('../controllers/reportController');
const { requireAuth } = require('../middleware/auth');

// Submit a report (requires auth)
router.post('/', requireAuth, createReport);

// Admin routes
router.get('/admin', requireAuth, getAllReports);
router.put('/admin/:reportId/status', requireAuth, updateReportStatus);
router.delete('/admin/:reportId', requireAuth, deleteReport);

module.exports = router;
