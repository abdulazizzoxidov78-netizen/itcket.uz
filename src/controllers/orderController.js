const { Order, Cart, Event, TicketType } = require('../models');
const { reserveTickets, releaseReservedTickets } = require('../services/inventoryService');
const { generateOrderNumber } = require('../utils/token');
const config = require('../config');

/**
 * Create Order from current Cart
 */
async function createOrder(req, res, next) {
  try {
    const user = req.user;
    const { fullName, phone, email } = req.body;

    const cart = await Cart.findOne({ user: user._id }).populate({
      path: 'items.event items.ticketType',
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Savatingiz bo\'sh.' });
    }

    const orderItems = [];
    let subtotal = 0;

    for (const item of cart.items) {
      if (!item.event || item.event.status !== 'published') {
        return res.status(400).json({ success: false, message: `"${item.event?.title || 'Tadbir'}" sotuvda mavjud emas.` });
      }
      if (!item.ticketType || !item.ticketType.isActive) {
        return res.status(400).json({ success: false, message: `"${item.ticketType?.name || 'Chipta'}" sotuvda mavjud emas.` });
      }

      const price = item.ticketType.price;
      const itemSubtotal = price * item.quantity;
      subtotal += itemSubtotal;

      orderItems.push({
        event: item.event._id,
        ticketType: item.ticketType._id,
        eventTitle: item.event.title,
        ticketTypeName: item.ticketType.name,
        quantity: item.quantity,
        unitPrice: price,
        subtotal: itemSubtotal,
        sector: item.sector || item.ticketType.sector || 'Erkin joylashuv',
        eventDate: item.event.startAt,
        venue: item.event.venue,
        poster: item.event.poster,
      });
    }

    // Reserve stock atomically
    await reserveTickets(cart.items);

    const orderNumber = generateOrderNumber();
    const expiresAt = new Date(Date.now() + config.ticket.reservationExpiryMinutes * 60 * 1000);

    const order = await Order.create({
      orderNumber,
      user: user._id,
      customerInfo: {
        fullName: fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Mijoz',
        phone: phone || user.phone || 'Kiritilmagan',
        email: email || user.email || '',
        telegramId: user.telegramId,
      },
      items: orderItems,
      subtotal,
      discount: 0,
      serviceFee: 0,
      total: subtotal,
      currency: config.currency,
      paymentStatus: 'pending',
      orderStatus: 'pending',
      expiresAt,
    });

    res.status(201).json({
      success: true,
      order,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get My Orders
 */
async function getMyOrders(req, res, next) {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Order Details by ID
 */
async function getOrderById(req, res, next) {
  try {
    const { id } = req.params;
    const order = await Order.findById(id).populate('items.event items.ticketType');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });
    }

    // Check ownership or admin
    if (String(order.user) !== String(req.user._id) && !['superadmin', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Ruxsat berilmadi' });
    }

    res.json({ success: true, order });
  } catch (error) {
    next(error);
  }
}

/**
 * Cancel Order
 */
async function cancelOrder(req, res, next) {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });

    if (String(order.user) !== String(req.user._id) && !['superadmin', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Ruxsat berilmadi' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'To\'langan buyurtmani bekor qilib bo\'lmaydi.' });
    }

    order.paymentStatus = 'cancelled';
    order.orderStatus = 'cancelled';
    await order.save();

    await releaseReservedTickets(order.items);

    res.json({ success: true, message: 'Buyurtma bekor qilindi va inventar bo\'shatildi.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
};
