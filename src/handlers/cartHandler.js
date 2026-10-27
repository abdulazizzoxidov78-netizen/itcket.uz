const { Event, TicketType, Cart, User } = require('../models');
const { getTicketSelectionKeyboard, getCartKeyboard } = require('../utils/keyboards');
const { formatMoney, formatDate } = require('../utils/formatters');
const { Markup } = require('telegraf');
const logger = require('../utils/logger');

/**
 * Open interactive ticket type and quantity selection
 */
async function handleTicketSelection(ctx, eventId, selectedTypeId = null, quantity = 1) {
  try {
    const event = await Event.findById(eventId);
    if (!event) {
      if (ctx.callbackQuery) await ctx.answerCbQuery('Tadbir topilmadi!');
      return ctx.reply('Tadbir topilmadi.');
    }

    const ticketTypes = await TicketType.find({ event: eventId, isActive: true }).sort({ price: 1 });
    if (ticketTypes.length === 0) {
      if (ctx.callbackQuery) await ctx.answerCbQuery('Chiptalar mavjud emas!');
      return ctx.reply('Bu tadbir uchun hozircha chiptalar sotuvda mavjud emas.');
    }

    // Default select first available ticket type if none selected
    let currentTypeId = selectedTypeId;
    if (!currentTypeId) {
      const firstAvailable = ticketTypes.find(
        (tt) => (tt.totalQuantity - (tt.soldQuantity || 0) - (tt.reservedQuantity || 0)) > 0
      );
      currentTypeId = firstAvailable ? String(firstAvailable._id) : String(ticketTypes[0]._id);
    }

    const selectedType = ticketTypes.find((tt) => String(tt._id) === String(currentTypeId));
    const available = selectedType
      ? selectedType.totalQuantity - (selectedType.soldQuantity || 0) - (selectedType.reservedQuantity || 0)
      : 0;

    const validatedQty = Math.min(Math.max(1, quantity), Math.max(1, available));

    const totalCalculated = selectedType ? selectedType.price * validatedQty : 0;

    const message = `🎟 <b>Chipta turini va miqdorini tanlang:</b>\n\n` +
      `📌 <b>Tadbir:</b> ${event.title}\n` +
      `📅 <b>Sana:</b> ${formatDate(event.startAt)}\n\n` +
      (selectedType
        ? `🔘 <b>Tanlangan tur:</b> ${selectedType.name}\n` +
          `💵 <b>Dona narxi:</b> ${formatMoney(selectedType.price)}\n` +
          `🔢 <b>Miqdor:</b> ${validatedQty} dona\n` +
          `💰 <b>Jami hisoblangan:</b> <b>${formatMoney(totalCalculated)}</b>\n` +
          `📊 <i>Mavjud: ${available} ta</i>\n\n`
        : '') +
      `<i>Miqdorni ➖ va ➕ tugmalari yordamida o'zgartiring va "Savatga qo'shish" tugmasini bosing:</i>`;

    const keyboard = getTicketSelectionKeyboard(eventId, ticketTypes, currentTypeId, validatedQty);

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
      await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
    } else {
      await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
    }
  } catch (error) {
    logger.error('handleTicketSelection error:', error);
    await ctx.reply('Chipta tanlashda xatolik yuz berdi.');
  }
}

/**
 * Add chosen ticket to persistent MongoDB cart
 */
async function handleAddToCart(ctx, eventId, ticketTypeId, quantity = 1) {
  try {
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });
    if (!user) return ctx.reply('Iltimos avval /start buyrug\'ini yuboring.');

    const [event, ticketType] = await Promise.all([
      Event.findById(eventId),
      TicketType.findById(ticketTypeId),
    ]);

    if (!event || event.status !== 'published') {
      if (ctx.callbackQuery) await ctx.answerCbQuery('Tadbir mavjud emas!');
      return ctx.reply('Kechirasiz, ushbu tadbir sotuvdan olingan.');
    }

    if (!ticketType || !ticketType.isActive) {
      if (ctx.callbackQuery) await ctx.answerCbQuery('Chipta turi mavjud emas!');
      return ctx.reply('Kechirasiz, ushbu chipta turi mavjud emas.');
    }

    // Check availability
    const available = ticketType.totalQuantity - (ticketType.soldQuantity || 0) - (ticketType.reservedQuantity || 0);
    const qtyToAdd = Math.max(1, parseInt(quantity, 10));

    if (available < qtyToAdd) {
      if (ctx.callbackQuery) await ctx.answerCbQuery('Yetarli chipta yo\'q!');
      return ctx.reply(`⚠️ Bu turdagi chiptadan faqat ${available} ta mavjud.`);
    }

    // Find or create MongoDB Cart
    let cart = await Cart.findOne({ user: user._id });
    if (!cart) {
      cart = new Cart({ user: user._id, items: [] });
    }

    // Check if same item already in cart
    const existingIndex = cart.items.findIndex(
      (item) => String(item.ticketType) === String(ticketTypeId)
    );

    if (existingIndex > -1) {
      const newTotal = cart.items[existingIndex].quantity + qtyToAdd;
      if (newTotal > available) {
        if (ctx.callbackQuery) await ctx.answerCbQuery('Mavjud limitdan oshdi!');
        return ctx.reply(`⚠️ Savatingizdagi chiptalar soni bilan birga mavjud limit (${available} ta) dan oshib ketadi.`);
      }
      cart.items[existingIndex].quantity = newTotal;
      cart.items[existingIndex].priceSnapshot = ticketType.price; // fresh price
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

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('Savatga qo\'shildi! ✅');
    }

    const confirmText = `✅ <b>Chipta savatingizga muvaffaqiyatli qo'shildi!</b>\n\n` +
      `📌 <b>Tadbir:</b> ${event.title}\n` +
      `🎟 <b>Chipta turi:</b> ${ticketType.name}\n` +
      `🔢 <b>Miqdori:</b> ${qtyToAdd} dona\n` +
      `💰 <b>Summa:</b> ${formatMoney(ticketType.price * qtyToAdd)}\n\n` +
      `Xaridni davom ettirishingiz yoki darhol buyurtmani rasmiylashtirishingiz mumkin:`;

    const confirmKeyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🛒 Savatni ko\'rish', 'view_cart'),
        Markup.button.callback('💳 Buyurtmani rasmiylashtirish', 'checkout_start'),
      ],
      [
        Markup.button.callback('🎫 Tadbirlarni davom ettirish', 'list_events:1'),
        Markup.button.callback('🏠 Asosiy menyu', 'go_main_menu'),
      ],
    ]);

    await ctx.reply(confirmText, { parse_mode: 'HTML', ...confirmKeyboard });
  } catch (error) {
    logger.error('handleAddToCart error:', error);
    await ctx.reply('Chiptani savatga qo\'shishda xatolik yuz berdi.');
  }
}

/**
 * Display User's full persistent MongoDB Cart
 */
async function handleViewCart(ctx) {
  try {
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });
    if (!user) return ctx.reply('Iltimos avval /start buyrug\'ini yuboring.');

    const cart = await Cart.findOne({ user: user._id }).populate({
      path: 'items.event items.ticketType',
      populate: { 
        path: 'category',
        strictPopulate: false // <--- XATOLIK TO'G'RILANDI
      },
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      const emptyText = `🛒 <b>Savatingiz hozircha bo'sh.</b>\n\n` +
        `O'zingizga yoqqan tadbirlarni tanlang va chiptalarni savatga qo'shing.`;

      const emptyKb = Markup.inlineKeyboard([
        [Markup.button.callback('🎫 Tadbirlarni ko\'rish', 'list_events:1')],
        [Markup.button.callback('🏠 Asosiy menyu', 'go_main_menu')],
      ]);

      if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
        return await ctx.reply(emptyText, { parse_mode: 'HTML', ...emptyKb });
      }
      return await ctx.reply(emptyText, { parse_mode: 'HTML', ...emptyKb });
    }

    let message = `🛒 <b>SIZNING SAVATINGIZ:</b>\n\n`;
    let totalSum = 0;
    let totalCount = 0;

    cart.items.forEach((item, idx) => {
      const ev = item.event;
      const tt = item.ticketType;
      const itemPrice = tt ? tt.price : item.priceSnapshot;
      const itemSubtotal = itemPrice * item.quantity;
      totalSum += itemSubtotal;
      totalCount += item.quantity;

      message += `<b>${idx + 1}. ${ev ? ev.title : 'Tadbir'}</b>\n` +
        `📅 ${ev ? formatDate(ev.startAt) : ''}\n` +
        `🎟 <b>Turi:</b> ${tt ? tt.name : 'Standard'} (${item.sector || 'Erkin joy'})\n` +
        `💰 <b>Dona:</b> ${formatMoney(itemPrice)} × ${item.quantity} = <b>${formatMoney(itemSubtotal)}</b>\n\n`;
    });

    message += `───────────────────\n` +
      `📊 <b>Jami chiptalar soni:</b> ${totalCount} dona\n` +
      `💳 <b>Umumiy to'lov summasi:</b> <b>${formatMoney(totalSum)}</b>\n\n` +
      `<i>Miqdorni ➖ va ➕ orqali o'zgartirishingiz yoki rasmiylashtirishga o'tishingiz mumkin:</i>`;

    const keyboard = getCartKeyboard(cart.items);

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
      await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
    } else {
      await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
    }
  } catch (error) {
    logger.error('handleViewCart error:', error);
    await ctx.reply('Savatni yuklashda xatolik yuz berdi.');
  }
}

/**
 * Increment / Decrement / Remove Item from Cart
 */
async function handleCartItemAction(ctx, action, itemId) {
  try {
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });
    if (!user) return;

    const cart = await Cart.findOne({ user: user._id });
    if (!cart) return ctx.reply('Savat topilmadi.');

    const item = cart.items.id(itemId);
    if (!item) {
      if (ctx.callbackQuery) await ctx.answerCbQuery('Chipta savatda topilmadi!');
      return handleViewCart(ctx);
    }

    if (action === 'inc') {
      const tt = await TicketType.findById(item.ticketType);
      const available = tt ? tt.totalQuantity - (tt.soldQuantity || 0) - (tt.reservedQuantity || 0) : 0;
      if (item.quantity + 1 > available) {
        if (ctx.callbackQuery) await ctx.answerCbQuery('Mavjud limitdan oshdi!');
        return;
      }
      item.quantity += 1;
    } else if (action === 'dec') {
      if (item.quantity > 1) {
        item.quantity -= 1;
      } else {
        cart.items.pull(itemId);
      }
    } else if (action === 'remove') {
      cart.items.pull(itemId);
    }

    await cart.save();
    if (ctx.callbackQuery) await ctx.answerCbQuery('Savat yangilandi ✅');
    return handleViewCart(ctx);
  } catch (error) {
    logger.error('handleCartItemAction error:', error);
    await ctx.reply('Savatni yangilashda xatolik yuz berdi.');
  }
}

/**
 * Clear full cart
 */
async function handleClearCart(ctx) {
  try {
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });
    if (user) {
      await Cart.findOneAndUpdate({ user: user._id }, { $set: { items: [] } });
    }
    if (ctx.callbackQuery) await ctx.answerCbQuery('Savat tozalandi!');
    await ctx.reply('🗑 Savatingiz muvaffaqiyatli tozalandi.');
  } catch (error) {
    logger.error('handleClearCart error:', error);
  }
}

module.exports = {
  handleTicketSelection,
  handleAddToCart,
  handleViewCart,
  handleCartItemAction,
  handleClearCart,
};