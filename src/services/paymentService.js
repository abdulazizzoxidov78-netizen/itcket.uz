const crypto = require('crypto');
const config = require('../config');
const { Order, Payment, Ticket, Cart, AuditLog, Event } = require('../models');
const { finalizePurchasedTickets } = require('./inventoryService');
const { generateTicketId, generateSecureToken } = require('../utils/token');
const logger = require('../utils/logger');

/**
 * Initialize a Payment entry for an order
 */
async function createPaymentSession(order, provider = 'test', userId) {
  const idempotencyKey = `${order._id}_${provider}_${Date.now()}`;

  let paymentUrl = '';
  if (provider === 'click' && config.payment.click.serviceId) {
    paymentUrl = `https://my.click.uz/services/pay?service_id=${config.payment.click.serviceId}&merchant_id=${config.payment.click.merchantId}&amount=${order.total}&transaction_param=${order.orderNumber}`;
  } else if (provider === 'payme' && config.payment.payme.merchantId) {
    const paymeParams = Buffer.from(`m=${config.payment.payme.merchantId};ac.order_id=${order.orderNumber};a=${order.total * 100}`).toString('base64');
    paymentUrl = `https://checkout.paycom.uz/${paymeParams}`;
  } else if (provider === 'uzum' && config.payment.uzum.merchantId) {
    paymentUrl = `https://www.uzumbank.uz/pay?merchant_id=${config.payment.uzum.merchantId}&order_id=${order.orderNumber}&amount=${order.total}`;
  } else {
    paymentUrl = `${config.baseUrl}/api/payments/test-pay/${order._id}`;
  }

  const payment = await Payment.create({
    order: order._id,
    user: userId,
    provider,
    amount: order.total,
    currency: order.currency || 'UZS',
    status: 'pending',
    idempotencyKey,
    paymentUrl,
  });

  return payment;
}

/**
 * Process successful payment confirmation (Called by webhooks or test payment)
 */
async function completePayment(paymentIdOrOrderNumber, providerTxId = null, metadata = {}) {
  let payment = null;
  let order = null;

  if (typeof paymentIdOrOrderNumber === 'string' && paymentIdOrOrderNumber.startsWith('ORD-')) {
    order = await Order.findOne({ orderNumber: paymentIdOrOrderNumber }).populate('items.event items.ticketType');
  } else {
    // Check if it's an Order ID
    try {
      order = await Order.findById(paymentIdOrOrderNumber).populate('items.event items.ticketType');
    } catch (e) {}

    // If not found as Order, check if it's a Payment ID
    if (!order) {
      try {
        payment = await Payment.findById(paymentIdOrOrderNumber);
        if (payment) {
          order = await Order.findById(payment.order).populate('items.event items.ticketType');
        }
      } catch (e) {}
    }
  }

  if (order && !payment) {
    payment = await Payment.findOne({ order: order._id }).sort({ createdAt: -1 });
  }

  if (!order) {
    throw new Error('Buyurtma topilmadi');
  }

  // Idempotency check: if order is already paid, do not generate tickets again!
  if (order.paymentStatus === 'paid') {
    logger.warn(`Takroriy to'lov so'rovi rad etildi. Buyurtma allaqachon to'langan: ${order.orderNumber}`);
    const existingTickets = await Ticket.find({ order: order._id }).populate('event ticketType');
    return { order, tickets: existingTickets, alreadyPaid: true };
  }

  // Update payment
  if (payment) {
    payment.status = 'paid';
    payment.paidAt = new Date();
    payment.providerTransactionId = providerTxId || `TX-${Date.now()}`;
    payment.webhookMetadata = metadata;
    await payment.save();
  }

  // Update order
  order.paymentStatus = 'paid';
  order.orderStatus = 'confirmed';
  order.paidAt = new Date();
  await order.save();

  // Finalize inventory
  await finalizePurchasedTickets(order.items);

  // Generate individual electronic tickets
  const createdTickets = [];
  for (const item of order.items) {
    for (let i = 0; i < item.quantity; i++) {
      const ticketId = generateTicketId();
      const qrToken = generateSecureToken(24);

      const ticket = await Ticket.create({
        ticketId,
        order: order._id,
        event: item.event?._id || item.event,
        ticketType: item.ticketType?._id || item.ticketType,
        owner: order.user,
        customerName: order.customerInfo.fullName,
        customerPhone: order.customerInfo.phone,
        priceSnapshot: item.unitPrice,
        currency: order.currency || 'UZS',
        qrToken,
        status: 'active',
        sector: item.sector || 'Erkin joylashuv',
        issuedAt: new Date(),
      });

      createdTickets.push(ticket);
    }
  }

  // Clear user's cart
  await Cart.findOneAndUpdate(
    { user: order.user },
    { $set: { items: [], status: 'checked_out' } }
  ).catch((e) => logger.error('Cart clear error:', e));

  // Audit log
  await AuditLog.create({
    actor: order.user,
    actorEmail: order.customerInfo.email || '',
    action: 'ORDER_PAID',
    entityType: 'Order',
    entityId: String(order._id),
    metadata: {
      orderNumber: order.orderNumber,
      total: order.total,
      ticketsCount: createdTickets.length,
      provider: payment ? payment.provider : 'test',
    },
  }).catch(() => {});

  logger.info(`To'lov muvaffaqiyatli qabul qilindi: ${order.orderNumber}. ${createdTickets.length} ta chipta yaratildi ✅`);

  return { order, tickets: createdTickets, alreadyPaid: false };
}

module.exports = {
  createPaymentSession,
  completePayment,
};
