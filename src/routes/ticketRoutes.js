const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { requireAuth } = require('../middleware/auth');

// Public web views & assets
router.get('/:id/view', ticketController.viewTicketWeb);
router.get('/:id/image', ticketController.streamTicketImage);
router.get('/:id/pdf', ticketController.streamTicketPDF);

// User protected
router.get('/my', requireAuth, ticketController.getMyTickets);
router.get('/:id', requireAuth, ticketController.getTicketById);

module.exports = router;
