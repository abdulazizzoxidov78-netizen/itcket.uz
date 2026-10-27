const crypto = require('crypto');
const { Order, Payment } = require('../models');
const { createPaymentSession, completePayment } = require('../services/paymentService');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Initialize Checkout & Payment
 */
async function checkout(req, res, next) {
  try {
    const { orderId, provider = 'test' } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Buyurtma allaqachon to\'langan' });
    }

    const payment = await createPaymentSession(order, provider, req.user._id);

    res.json({
      success: true,
      payment,
      paymentUrl: payment.paymentUrl,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Test Mode instant payment completion
 */
async function testPay(req, res, next) {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });

    const result = await completePayment(order._id, `TEST-${Date.now()}`, {
      source: 'web_test_pay',
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'Test to\'lov muvaffaqiyatli amalga oshirildi! Chiptalar chiqarildi.',
      order: result.order,
      tickets: result.tickets,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Click Webhook Handler
 */
async function handleClickWebhook(req, res) {
  try {
    const {
      click_trans_id,
      service_id,
      merchant_trans_id, // our orderNumber
      merchant_prepare_id,
      amount,
      action,
      error,
      error_note,
      sign_time,
      sign_string,
    } = req.body;

    // Check MD5 signature if secretKey is set
    if (config.payment.click.secretKey) {
      const checkString = `${click_trans_id}${service_id}${config.payment.click.secretKey}${merchant_trans_id}${action === 1 ? merchant_prepare_id : ''}${amount}${action}${sign_time}`;
      const myHash = crypto.createHash('md5').update(checkString).digest('hex');
      if (myHash !== sign_string) {
        return res.json({ error: -1, error_note: 'SIGN CHECK FAILED' });
      }
    }

    const order = await Order.findOne({ orderNumber: merchant_trans_id });
    if (!order) {
      return res.json({ error: -5, error_note: 'User does not exist' });
    }

    if (Number(amount) !== Number(order.total)) {
      return res.json({ error: -2, error_note: 'Incorrect parameter amount' });
    }

    // Action 0: Prepare
    if (action === 0) {
      return res.json({
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id: order._id,
        error: 0,
        error_note: 'Success',
      });
    }

    // Action 1: Complete
    if (action === 1) {
      await completePayment(order.orderNumber, `CLICK-${click_trans_id}`, req.body);
      return res.json({
        click_trans_id,
        merchant_trans_id,
        merchant_confirm_id: order._id,
        error: 0,
        error_note: 'Success',
      });
    }

    return res.json({ error: -3, error_note: 'Action not found' });
  } catch (err) {
    logger.error('Click Webhook error:', err);
    return res.json({ error: -7, error_note: 'Internal server error' });
  }
}

/**
 * Payme JSON-RPC 2.0 Webhook Handler
 */
async function handlePaymeWebhook(req, res) {
  const { method, params, id } = req.body;

  try {
    if (method === 'CheckPerformTransaction') {
      const orderNumber = params.account?.order_id;
      const order = await Order.findOne({ orderNumber });
      if (!order) {
        return res.json({ error: { code: -31050, message: { uz: 'Buyurtma topilmadi' } }, id });
      }
      if (Number(params.amount) !== order.total * 100) {
        return res.json({ error: { code: -31001, message: { uz: 'Summa noto\'g\'ri' } }, id });
      }
      return res.json({ result: { allow: true }, id });
    }

    if (method === 'PerformTransaction') {
      const paymeTxId = params.id;
      // complete transaction
      return res.json({
        result: {
          transaction: paymeTxId,
          perform_time: Date.now(),
          state: 2,
        },
        id,
      });
    }

    return res.json({ result: { state: 1 }, id });
  } catch (err) {
    logger.error('Payme Webhook error:', err);
    return res.json({ error: { code: -32400, message: { uz: 'Tizim xatoligi' } }, id });
  }
}

module.exports = {
  checkout,
  testPay,
  handleClickWebhook,
  handlePaymeWebhook,
};
