const { TicketType, Order } = require('../models');
const logger = require('../utils/logger');

/**
 * Atomically reserve tickets for checkout.
 * If any ticket type does not have sufficient capacity, rolls back all previous reservations.
 */
async function reserveTickets(items) {
  const reservedSuccessfully = [];

  try {
    for (const item of items) {
      const typeId = item.ticketType._id || item.ticketType;
      const qty = Number(item.quantity);

      // Atomic find and update: only succeed if availableQuantity >= qty
      const updated = await TicketType.findOneAndUpdate(
        {
          _id: typeId,
          isActive: true,
          $expr: {
            $gte: [
              { $subtract: ['$totalQuantity', { $add: ['$soldQuantity', '$reservedQuantity'] }] },
              qty,
            ],
          },
        },
        {
          $inc: { reservedQuantity: qty },
        },
        { new: true }
      );

      if (!updated) {
        throw new Error(`Kechirasiz, tanlangan chiptalar soni tugagan yoki yetarli emas.`);
      }

      reservedSuccessfully.push({ ticketTypeId: typeId, quantity: qty });
    }

    return { success: true };
  } catch (error) {
    // Rollback any reserved items in this failed transaction batch
    for (const resItem of reservedSuccessfully) {
      await TicketType.findByIdAndUpdate(resItem.ticketTypeId, {
        $inc: { reservedQuantity: -resItem.quantity },
      }).catch((e) => logger.error('Rollback reservation error:', e));
    }
    throw error;
  }
}

/**
 * Release reserved tickets back to available inventory (e.g. order cancelled or expired)
 */
async function releaseReservedTickets(items) {
  for (const item of items) {
    const typeId = item.ticketType?._id || item.ticketType;
    const qty = Number(item.quantity);
    if (!typeId || !qty) continue;

    await TicketType.findByIdAndUpdate(typeId, {
      $inc: { reservedQuantity: -qty },
    }).catch((e) => logger.error('Release reserved tickets error:', e));
  }
}

/**
 * Finalize tickets upon verified payment:
 * Subtracts from reservedQuantity and adds to soldQuantity
 */
async function finalizePurchasedTickets(items) {
  for (const item of items) {
    const typeId = item.ticketType?._id || item.ticketType;
    const qty = Number(item.quantity);
    if (!typeId || !qty) continue;

    await TicketType.findByIdAndUpdate(typeId, {
      $inc: {
        reservedQuantity: -qty,
        soldQuantity: qty,
      },
    }).catch((e) => logger.error('Finalize purchased tickets error:', e));
  }
}

/**
 * Check and release expired pending orders
 */
async function sweepExpiredOrders() {
  try {
    const expiredOrders = await Order.find({
      paymentStatus: 'pending',
      expiresAt: { $lt: new Date() },
    });

    for (const order of expiredOrders) {
      order.paymentStatus = 'expired';
      order.orderStatus = 'cancelled';
      await order.save();

      // Release reserved stock
      await releaseReservedTickets(order.items);
      logger.info(`Muddati o'tgan buyurtma bekor qilindi va inventar bo'shatildi: ${order.orderNumber}`);
    }
  } catch (err) {
    logger.error('Error in sweepExpiredOrders:', err);
  }
}

module.exports = {
  reserveTickets,
  releaseReservedTickets,
  finalizePurchasedTickets,
  sweepExpiredOrders,
};
