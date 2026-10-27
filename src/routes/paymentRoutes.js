const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { requireAuth } = require('../middleware/auth');

// Protected Checkout
router.post('/checkout', requireAuth, paymentController.checkout);

// Test payment execution endpoint
router.all('/test-pay/:orderId', paymentController.testPay);

// Payment Webhooks
router.post('/webhooks/click', paymentController.handleClickWebhook);
router.post('/webhooks/payme', paymentController.handlePaymeWebhook);

module.exports = router;
