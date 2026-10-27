const { Cart, Event, TicketType } = require('../models');

/**
 * Get User Cart
 */
async function getCart(req, res, next) {
  try {
    const userId = req.user._id;
    let cart = await Cart.findOne({ user: userId }).populate({
      path: 'items.event items.ticketType',
      populate: { path: 'category', select: 'name slug icon' },
    });

    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

    const totals = cart.calculateTotals();

    res.json({
      success: true,
      cart,
      totals,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Add Item to Cart
 */
async function addToCart(req, res, next) {
  try {
    const userId = req.user._id;
    const { eventId, ticketTypeId, quantity = 1 } = req.body;

    if (!eventId || !ticketTypeId) {
      return res.status(400).json({ success: false, message: 'eventId va ticketTypeId kiritilishi shart.' });
    }

    const [event, ticketType] = await Promise.all([
      Event.findById(eventId),
      TicketType.findById(ticketTypeId),
    ]);

    if (!event || event.status !== 'published') {
      return res.status(400).json({ success: false, message: 'Tadbir topilmadi yoki sotuvda emas.' });
    }

    if (!ticketType || !ticketType.isActive) {
      return res.status(400).json({ success: false, message: 'Chipta turi topilmadi yoki faol emas.' });
    }

    const available = ticketType.totalQuantity - (ticketType.soldQuantity || 0) - (ticketType.reservedQuantity || 0);
    const qtyToAdd = Math.max(1, parseInt(quantity, 10));

    if (available < qtyToAdd) {
      return res.status(400).json({ success: false, message: `Yetarli chipta mavjud emas. Qolgan soni: ${available}` });
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const existingIndex = cart.items.findIndex((it) => String(it.ticketType) === String(ticketTypeId));
    if (existingIndex > -1) {
      const newQty = cart.items[existingIndex].quantity + qtyToAdd;
      if (newQty > available) {
        return res.status(400).json({ success: false, message: `Mavjud limitdan oshib ketadi. Qolgan soni: ${available}` });
      }
      cart.items[existingIndex].quantity = newQty;
      cart.items[existingIndex].priceSnapshot = ticketType.price;
    } else {
      cart.items.push({
        event: event._id,
        ticketType: ticketType._id,
        quantity: qtyToAdd,
        priceSnapshot: ticketType.price,
        sector: ticketType.sector || 'Erkin joylashuv',
      });
    }

    cart.status = 'active';
    await cart.save();

    res.json({
      success: true,
      message: 'Chipta savatga qo\'shildi',
      cart,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update Cart Item Quantity
 */
async function updateCartItem(req, res, next) {
  try {
    const userId = req.user._id;
    const { itemId } = req.params;
    const { quantity } = req.body;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Savat topilmadi' });

    const item = cart.items.id(itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Chipta savatda topilmadi' });

    const newQty = parseInt(quantity, 10);
    if (newQty <= 0) {
      cart.items.pull(itemId);
    } else {
      const ticketType = await TicketType.findById(item.ticketType);
      const available = ticketType ? ticketType.totalQuantity - (ticketType.soldQuantity || 0) - (ticketType.reservedQuantity || 0) : 0;
      if (newQty > available) {
        return res.status(400).json({ success: false, message: `Mavjud limitdan oshib ketadi: ${available} ta` });
      }
      item.quantity = newQty;
    }

    await cart.save();
    res.json({ success: true, cart });
  } catch (error) {
    next(error);
  }
}

/**
 * Remove Item from Cart
 */
async function removeCartItem(req, res, next) {
  try {
    const userId = req.user._id;
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Savat topilmadi' });

    cart.items.pull(itemId);
    await cart.save();

    res.json({ success: true, message: 'Chipta savatdan o\'chirildi', cart });
  } catch (error) {
    next(error);
  }
}

/**
 * Clear Entire Cart
 */
async function clearCart(req, res, next) {
  try {
    const userId = req.user._id;
    await Cart.findOneAndUpdate({ user: userId }, { $set: { items: [] } });
    res.json({ success: true, message: 'Savat tozalandi' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
};
