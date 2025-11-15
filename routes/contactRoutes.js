const express = require('express');
const router = express.Router();
const { 
  submitContact,
  getAllContacts,
  getContactStats,
  updateContactStatus,
  deleteContact,
  getContactById
} = require('../controllers/contactController');

// Public routes
router.post('/submit', submitContact);

// Admin routes (no authentication for now as requested)
router.get('/admin/contacts', getAllContacts);
router.get('/admin/stats', getContactStats);
router.get('/admin/:contactId', getContactById);
router.put('/admin/:contactId/status', updateContactStatus);
router.delete('/admin/:contactId', deleteContact);

module.exports = router;