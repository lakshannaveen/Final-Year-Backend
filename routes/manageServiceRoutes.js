/**
 * routes/manageServiceRoutes.js
 *
 * Routes for the management UI that lists all services and allows deletion of services
 * and deletion of admin users. These routes are intentionally left without authentication
 * middleware per the user's request — use with caution.
 *
 * Mount in your server e.g.:
 *    app.use('/api/admin/manage', require('./routes/manageServiceRoutes'));
 */

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