const { Cart, Order, User, TicketType } = require('../models');
const { reserveTickets, releaseReservedTickets } = require('../services/inventoryService');
const { createPaymentSession, completePayment } = require('../services/paymentService');
const { sendTicketToUser, notifyOrderSuccess } = require('../services/botService');
const { getPaymentSelectionKeyboard } = require('../utils/keyboards');
const { generateOrderNumber } = require('../utils/token');
const { formatMoney, formatDate } = require('../utils/formatters');
const config = require('../config');
const logger = require('../utils/logger');
const { Markup } = require('telegraf');

/**
 * Start checkout process
 */
async function handleCheckoutStart(ctx) {
  try {
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });
    if (!user) return ctx.reply('Iltimos avval /start buyrug\'ini yuboring.');

    const cart = await Cart.findOne({ user: user._id }).populate({
      path: 'items.event items.ticketType',
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      if (ctx.callbackQuery) await ctx.answerCbQuery('Savatingiz bo\'sh!');
      return ctx.reply('🛒 Savatingiz bo\'sh. Rasmiylashtirish uchun avval chipta qo\'shing.');
    }

    // Verify events are published and re-check prices
    let subtotal = 0;
    const orderItems = [];

    for (const item of cart.items) {
      if (!item.event || item.event.status !== 'published') {
        return ctx.reply(`⚠️ "${item.event?.title || 'Tadbir'}" sotuvdan olingan. Iltimos savatni yangilang.`);
      }
      if (!item.ticketType || !item.ticketType.isActive) {
        return ctx.reply(`⚠️ "${item.ticketType?.name || 'Chipta'}" sotuvda mavjud emas.`);
      }

      const currentPrice = item.ticketType.price;
      const itemSubtotal = currentPrice * item.quantity;
      subtotal += itemSubtotal;

      orderItems.push({
        event: item.event._id,
        ticketType: item.ticketType._id,
        eventTitle: item.event.title,
        ticketTypeName: item.ticketType.name,
        quantity: item.quantity,
        unitPrice: currentPrice,
        subtotal: itemSubtotal,
        sector: item.sector || item.ticketType.sector || 'Erkin joylashuv',
        eventDate: item.event.startAt,
        venue: item.event.venue,
        poster: item.event.poster,
      });
    }

    // Reserve inventory atomically
    try {
      await reserveTickets(cart.items);
    } catch (invErr) {
      if (ctx.callbackQuery) await ctx.answerCbQuery('Chipta yetarli emas!');
      return ctx.reply(`⚠️ ${invErr.message}`);
    }

    // Create Order with 15 min expiration
    const orderNumber = generateOrderNumber();
    const expiresAt = new Date(Date.now() + config.ticket.reservationExpiryMinutes * 60 * 1000);

    const customerName = [user.firstName, user.lastName].filter(Boolean).join(' ') || ctx.from.first_name || 'Mijoz';
    const customerPhone = user.phone || 'Kiritilmagan';

    const order = await Order.create({
      orderNumber,
      user: user._id,
      customerInfo: {
        fullName: customerName,
        phone: customerPhone,
        email: user.email || '',
        telegramId,
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

    if (ctx.callbackQuery) await ctx.answerCbQuery();

    let summaryText = `📋 <b>BUYURTMANI TASDIQLASH VA TO'LOV</b>\n\n` +
      `📦 <b>Buyurtma raqami:</b> <code>${order.orderNumber}</code>\n` +
      `👤 <b>Mijoz:</b> ${customerName}\n` +
      `📱 <b>Aloqa:</b> ${customerPhone}\n\n` +
      `<b>Chiptalar tarkibi:</b>\n`;

    orderItems.forEach((it, idx) => {
      summaryText += `${idx + 1}. <b>${it.eventTitle}</b>\n` +
        `   ${it.ticketTypeName} • ${it.quantity} dona × ${formatMoney(it.unitPrice)} = ${formatMoney(it.subtotal)}\n`;
    });

    summaryText += `───────────────────\n` +
      `💰 <b>Jami to'lov summasi:</b> <b>${formatMoney(order.total)}</b>\n` +
      `⏳ <i>Chiptalar siz uchun 15 daqiqaga band qilindi.</i>\n\n` +
      `Iltimos, qulay to'lov tizimini tanlang:`;

    const paymentKb = getPaymentSelectionKeyboard(order._id);
    await ctx.reply(summaryText, { parse_mode: 'HTML', ...paymentKb });
  } catch (error) {
    logger.error('handleCheckoutStart error:', error);
    await ctx.reply('Buyurtmani rasmiylashtirishda xatolik yuz berdi.');
  }
}

/**
 * Handle Payment Selection (Click, Payme, Uzum, Test)
 */
async function handleProcessPayment(ctx, orderId, provider) {
  try {
    const order = await Order.findById(orderId).populate('items.event items.ticketType');
    if (!order) {
      if (ctx.callbackQuery) await ctx.answerCbQuery('Buyurtma topilmadi!');
      return ctx.reply('Buyurtma topilmadi.');
    }

    if (order.paymentStatus === 'paid') {
      if (ctx.callbackQuery) await ctx.answerCbQuery('Buyurtma allaqachon to\'langan!');
      return ctx.reply('Ushbu buyurtma allaqachon muvaffaqiyatli to\'langan.');
    }

    if (order.paymentStatus === 'expired' || new Date() > order.expiresAt) {
      if (ctx.callbackQuery) await ctx.answerCbQuery('Muddati o\'tgan!');
      return ctx.reply('⚠️ To\'lov muddati tugagan. Chiptalar yana umumiy sotuvga chiqarildi. Iltimos qaytadan savatga qo\'shing.');
    }

    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });

    if (ctx.callbackQuery) await ctx.answerCbQuery('To\'lov jarayoni boshlanmoqda...');

    // If Test mode selected, process immediately and issue tickets
    if (provider === 'test') {
      const waitMsg = await ctx.reply('⏳ To\'lov tasdiqlanmoqda va QR-kodli chiptalar tayyorlanmoqda...');

      const result = await completePayment(order._id, `TEST-TX-${Date.now()}`, {
        testMode: true,
        telegramId,
      });

      try {
        await ctx.deleteMessage(waitMsg.message_id).catch(() => {});
      } catch (e) {}

      // Notify success
      await notifyOrderSuccess(telegramId, result.order, result.tickets);

      // Render & Send each ticket PNG with QR code
      for (const tkt of result.tickets) {
        const itemInfo = order.items.find(
          (it) => String(it.ticketType?._id || it.ticketType) === String(tkt.ticketType?._id || tkt.ticketType)
        );
        const eventObj = itemInfo?.event || order.items[0]?.event;
        await sendTicketToUser(telegramId, tkt, eventObj, result.order);
      }

      return;
    }

    // Real Payment provider (Click / Payme / Uzum)
    const payment = await createPaymentSession(order, provider, user._id);

    const payMessage = `💳 <b>${provider.toUpperCase()} ORQALI TO'LOV</b>\n\n` +
      `📦 <b>Buyurtma:</b> <code>${order.orderNumber}</code>\n` +
      `💰 <b>Summa:</b> <b>${formatMoney(order.total)}</b>\n\n` +
      `To'lovni amalga oshirish uchun quyidagi tugma orqali o'ting:\n` +
      `<i>To'lov tasdiqlangandan so'ng chiptalaringiz avtomatik tarzda botda paydo bo'ladi.</i>`;

    const payButton = Markup.inlineKeyboard([
      [Markup.button.url(`🔗 ${provider.toUpperCase()} to'lov sahifasi`, payment.paymentUrl)],
      [Markup.button.callback('🔄 To\'lov holatini tekshirish', `check_payment:${payment._id}`)],
      [Markup.button.callback('⬅️ Orqaga', 'view_cart')],
    ]);

    await ctx.reply(payMessage, { parse_mode: 'HTML', ...payButton });
  } catch (error) {
    logger.error('handleProcessPayment error:', error);
    await ctx.reply('To\'lovni boshlashda xatolik yuz berdi.');
  }
}

/**
 * Handle Checking Payment Status (Called by user on 'To'lov holatini tekshirish' button)
 */
async function handleCheckPayment(ctx, paymentId) {
  try {
    const { Payment, Ticket } = require('../models');
    const payment = await Payment.findById(paymentId).populate('order');
    if (!payment) {
      if (ctx.callbackQuery) await ctx.answerCbQuery('To\'lov ma\'lumoti topilmadi!');
      return ctx.reply('To\'lov ma\'lumoti topilmadi.');
    }

    const order = await Order.findById(payment.order).populate('items.event items.ticketType');
    if (!order) {
      if (ctx.callbackQuery) await ctx.answerCbQuery('Buyurtma topilmadi!');
      return ctx.reply('Buyurtma topilmadi.');
    }

    if (order.paymentStatus === 'paid') {
      if (ctx.callbackQuery) await ctx.answerCbQuery('To\'lov tasdiqlangan! ✅');
      const tickets = await Ticket.find({ order: order._id }).populate('event ticketType');
      await notifyOrderSuccess(ctx.from.id, order, tickets);
      for (const tkt of tickets) {
        const itemInfo = order.items.find(
          (it) => String(it.ticketType?._id || it.ticketType) === String(tkt.ticketType?._id || tkt.ticketType)
        );
        const eventObj = itemInfo?.event || order.items[0]?.event;
        await sendTicketToUser(ctx.from.id, tkt, eventObj, order);
      }
      return;
    }

    if (ctx.callbackQuery) await ctx.answerCbQuery('To\'lov kutilmoqda ⏳');
    await ctx.reply(
      `⏳ <b>To'lov holati:</b> Kutilmoqda (Pending)\n\n` +
      `📦 Buyurtma raqami: <code>${order.orderNumber}</code>\n` +
      `💰 Summa: <b>${formatMoney(order.total)}</b>\n\n` +
      `To'lov amalga oshirilgach, ushbu tugma orqali qayta tekshirishingiz mumkin:`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            payment.paymentUrl ? [Markup.button.url('🔗 To\'lov sahifasi', payment.paymentUrl)] : [],
            [Markup.button.callback('🔄 Qayta tekshirish', `check_payment:${payment._id}`)],
            [Markup.button.callback('🏠 Asosiy menyu', 'go_main_menu')],
          ].filter((r) => r.length > 0),
        },
      }
    );
  } catch (error) {
    logger.error('handleCheckPayment error:', error);
    if (ctx.callbackQuery) await ctx.answerCbQuery('Xatolik yuz berdi');
  }
}

/**
 * Handle Order Cancellation by user
 */
async function handleCancelOrder(ctx, orderId) {
  try {
    const order = await Order.findById(orderId);
    if (!order || order.paymentStatus === 'paid') {
      if (ctx.callbackQuery) await ctx.answerCbQuery('Amal bajarib bo\'lmaydi!');
      return;
    }

    order.paymentStatus = 'cancelled';
    order.orderStatus = 'cancelled';
    await order.save();

    await releaseReservedTickets(order.items);

    if (ctx.callbackQuery) await ctx.answerCbQuery('Buyurtma bekor qilindi');
    await ctx.reply(`❌ <b>${order.orderNumber}</b> raqamli buyurtma bekor qilindi va band qilingan chiptalar bo'shatildi.`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [Markup.button.callback('🎫 Tadbirlarni ko\'rish', 'list_events:1')],
          [Markup.button.callback('🏠 Asosiy menyu', 'go_main_menu')],
        ],
      },
    });
  } catch (error) {
    logger.error('handleCancelOrder error:', error);
  }
}

module.exports = {
  handleCheckoutStart,
  handleProcessPayment,
  handleCheckPayment,
  handleCancelOrder,
};
