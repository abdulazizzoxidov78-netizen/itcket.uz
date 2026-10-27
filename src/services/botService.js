const { Telegraf } = require('telegraf');
const config = require('../config');
const logger = require('../utils/logger');
const { renderTicketImage } = require('./ticketRenderer');
const { getTicketActionsKeyboard } = require('../utils/keyboards');
const { formatDate, formatMoney } = require('../utils/formatters');

let bot = null;

function getBotInstance() {
  if (!bot) {
    if (!config.telegram.botToken) {
      throw new Error('Telegram BOT_TOKEN sozlanmagan!');
    }
    bot = new Telegraf(config.telegram.botToken);
  }
  return bot;
}

/**
 * Send rendered ticket image directly to Telegram user
 */
async function sendTicketToUser(telegramId, ticket, event, order) {
  if (!telegramId) return;

  try {
    const botInstance = getBotInstance();
    const imageBuffer = await renderTicketImage(ticket, event, order);

    const caption = `🎟 <b>CHIPTANGIZ TAYYOR!</b>\n\n` +
      `📌 <b>Tadbir:</b> ${event.title}\n` +
      `📅 <b>Sana:</b> ${formatDate(event.startAt)}\n` +
      `📍 <b>Manzil:</b> ${event.venue}, ${event.city}\n` +
      `🎫 <b>Turi:</b> ${ticket.ticketType?.name || 'Standard'}\n` +
      `💰 <b>Narx:</b> ${formatMoney(ticket.priceSnapshot)}\n` +
      `🔢 <b>Chipta ID:</b> <code>${ticket.ticketId}</code>\n\n` +
      `<i>Tadbirga kirishda ushbu rasmdagi QR-kodni ko'rsatishingiz kifoya.</i>`;

    await botInstance.telegram.sendPhoto(
      telegramId,
      { source: imageBuffer },
      {
        caption,
        parse_mode: 'HTML',
        ...getTicketActionsKeyboard(ticket._id),
      }
    );
  } catch (err) {
    logger.error(`Chipta rasmini Telegramga yuborishda xatolik (${telegramId}):`, err);
  }
}

/**
 * Notify user about successful order confirmation
 */
async function notifyOrderSuccess(telegramId, order, tickets) {
  if (!telegramId) return;

  try {
    const botInstance = getBotInstance();
    const message = `✅ <b>TO'LOV MUVAFFAQIYATLI TASDIQLANDI!</b>\n\n` +
      `📦 <b>Buyurtma raqami:</b> <code>${order.orderNumber}</code>\n` +
      `💵 <b>Jami to'landi:</b> ${formatMoney(order.total)}\n` +
      `🎟 <b>Chiptalar soni:</b> ${tickets.length} ta\n\n` +
      `Chiptalaringiz quyida alohida QR-kod bilan yuborilmoqda:`;

    await botInstance.telegram.sendMessage(telegramId, message, { parse_mode: 'HTML' });
  } catch (err) {
    logger.error(`Buyurtma xabarini Telegramga yuborishda xatolik:`, err);
  }
}

module.exports = {
  getBotInstance,
  sendTicketToUser,
  notifyOrderSuccess,
};
