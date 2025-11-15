const express = require('express');
const router = express.Router();
const {
  getAllServicesPaginated,
  deleteService,
  deleteAdmin,
} = require('../controllers/manageServiceController');

// List all services (paginated)
router.get('/services', getAllServicesPaginated);

// Delete a specific service by id (no auth)
router.delete('/services/:id', deleteService);

// Delete an admin/user by id (no auth)
router.delete('/admins/:id', deleteAdmin);

module.exports = router;