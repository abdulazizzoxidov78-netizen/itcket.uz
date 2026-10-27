const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const scannerController = require('../controllers/scannerController');
const { requireAuth, requireRole } = require('../middleware/auth');

// All admin routes require authentication and at least scanner / admin role
router.use(requireAuth);

// QR Scanner endpoint (accessible by 'scanner', 'organizer', 'admin', 'superadmin')
router.post('/tickets/validate', requireRole(['scanner', 'organizer', 'admin', 'superadmin']), scannerController.validateTicket);

// Admin & Organizer endpoints
router.get('/dashboard', requireRole(['admin', 'superadmin', 'organizer']), adminController.getDashboardStats);
router.get('/events', requireRole(['admin', 'superadmin', 'organizer']), adminController.adminGetEvents);
router.post('/events', requireRole(['admin', 'superadmin', 'organizer']), adminController.adminCreateEvent);
router.patch('/events/:id', requireRole(['admin', 'superadmin', 'organizer']), adminController.adminUpdateEvent);
router.delete('/events/:id', requireRole(['admin', 'superadmin']), adminController.adminDeleteEvent);

router.post('/ticket-types', requireRole(['admin', 'superadmin', 'organizer']), adminController.adminCreateTicketType);
router.patch('/ticket-types/:id', requireRole(['admin', 'superadmin', 'organizer']), adminController.adminUpdateTicketType);

router.get('/orders', requireRole(['admin', 'superadmin', 'organizer']), adminController.adminGetOrders);
router.get('/payments', requireRole(['admin', 'superadmin']), adminController.adminGetPayments);
router.get('/tickets', requireRole(['admin', 'superadmin', 'organizer']), adminController.adminGetTickets);

router.get('/reports/csv', requireRole(['admin', 'superadmin']), adminController.adminExportReportsCSV);

// Superadmin only
router.get('/users', requireRole(['superadmin', 'admin']), adminController.adminGetUsers);
router.patch('/users/:id/role', requireRole(['superadmin']), adminController.adminUpdateUserRole);

module.exports = router;
