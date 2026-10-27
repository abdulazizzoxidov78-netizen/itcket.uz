const { Event, TicketType, Favorite, User } = require('../models');
const { getEventActionsKeyboard } = require('../utils/keyboards');
const { formatDate, formatMoney } = require('../utils/formatters');
const { Markup } = require('telegraf');
const logger = require('../utils/logger');

const PAGE_SIZE = 4;

/**
 * List events with pagination and optional filters
 */
async function listEvents(ctx, page = 1, filter = {}) {
  try {
    const query = { status: 'published', ...filter };
    const skip = (page - 1) * PAGE_SIZE;

    const [events, total] = await Promise.all([
      Event.find(query)
        .populate('category')
        .sort({ isPopular: -1, startAt: 1 })
        .skip(skip)
        .limit(PAGE_SIZE),
      Event.countDocuments(query),
    ]);

    if (events.length === 0) {
      const emptyMsg = 'Hozircha faol tadbirlar mavjud emas.';
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
        return await ctx.editMessageText(emptyMsg, {
          reply_markup: {
            inline_keyboard: [[Markup.button.callback('🏠 Asosiy menyu', 'go_main_menu')]],
          },
        });
      }
      return await ctx.reply(emptyMsg);
    }

    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
    let message = `🎫 <b>Barcha faol tadbirlar</b> (Sahifa ${page}/${totalPages}):\n\n`;

    const buttons = [];
    events.forEach((ev, idx) => {
      const dateStr = formatDate(ev.startAt);
      message += `<b>${skip + idx + 1}. ${ev.title}</b>\n` +
        `📅 ${dateStr}\n` +
        `📍 ${ev.venue}, ${ev.city}\n\n`;

      buttons.push([Markup.button.callback(`🎟 ${ev.title}`, `view_event:${ev._id}`)]);
    });

    // Pagination row
    const navRow = [];
    if (page > 1) {
      navRow.push(Markup.button.callback('⬅️ Oldingi', `list_events:${page - 1}`));
    }
    if (page < totalPages) {
      navRow.push(Markup.button.callback('Keyingi ➡️', `list_events:${page + 1}`));
    }
    if (navRow.length > 0) {
      buttons.push(navRow);
    }

    buttons.push([Markup.button.callback('🏠 Asosiy menyu', 'go_main_menu')]);

    const keyboard = Markup.inlineKeyboard(buttons);

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
      // If previous message had photo, we send a new message or edit text if it was text
      if (ctx.callbackQuery.message.photo) {
        await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
      } else {
        await ctx.editMessageText(message, { parse_mode: 'HTML', ...keyboard });
      }
    } else {
      await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
    }
  } catch (error) {
    logger.error('listEvents error:', error);
    await ctx.reply('Tadbirlarni yuklashda xatolik yuz berdi.');
  }
}

/**
 * List popular events
 */
async function listPopularEvents(ctx) {
  return listEvents(ctx, 1, { isPopular: true });
}

/**
 * Show comprehensive event details with high-res poster and actions
 */
async function showEventDetails(ctx, eventId) {
  try {
    const event = await Event.findById(eventId).populate('category organizer');
    if (!event || event.status === 'cancelled') {
      const notFoundMsg = '❌ Kechirasiz, ushbu tadbir topilmadi yoki bekor qilingan.';
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery('Tadbir topilmadi!');
        return await ctx.editMessageText(notFoundMsg);
      }
      return await ctx.reply(notFoundMsg);
    }

    // Load ticket types
    const ticketTypes = await TicketType.find({ event: event._id, isActive: true }).sort({ price: 1 });

    // Check if user has this event in favorites
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });
    let isFavorite = false;
    if (user) {
      const fav = await Favorite.findOne({ user: user._id, event: event._id });
      isFavorite = !!fav;
    }

    // Format ticket types breakdown
    let ticketTypesText = '';
    if (ticketTypes.length > 0) {
      ticketTypes.forEach((tt) => {
        const available = tt.totalQuantity - (tt.soldQuantity || 0) - (tt.reservedQuantity || 0);
        const availText = available > 0 ? `(Mavjud: ${available} ta)` : '🔴 <i>(Chiptalar tugagan)</i>';
        ticketTypesText += `  • <b>${tt.name}:</b> ${formatMoney(tt.price)} ${availText}\n`;
      });
    } else {
      ticketTypesText = '  <i>Hozircha chipta turlari belgilanmagan</i>\n';
    }

    const caption = `🌟 <b>${event.title.toUpperCase()}</b>\n\n` +
      `📌 <b>Kategoriya:</b> ${event.category?.name || 'Madaniyat'}\n` +
      `📅 <b>Sana:</b> ${formatDate(event.startAt)}\n` +
      `🕒 <b>Boshlanish vaqti:</b> ${new Date(event.startAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}\n` +
      (event.endAt ? `🏁 <b>Tugash vaqti:</b> ${new Date(event.endAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}\n` : '') +
      `📍 <b>Shahar va Manzil:</b> ${event.venue}, ${event.address}, ${event.city}\n` +
      `🏛 <b>Tashkilotchi:</b> ${event.organizerName || 'Elite Tickets'}\n` +
      `🔞 <b>Yosh chegarasi:</b> ${event.ageRestriction || '0+'}\n\n` +
      `🎟 <b>CHIPTA TURLARI VA NARXLARI:</b>\n${ticketTypesText}\n` +
      `📝 <b>Tadbir tavsifi:</b>\n${event.description}\n\n` +
      `⚠️ <b>Qoidalar:</b>\n<i>${event.rules || 'Tadbirga kechikmasdan kelishingiz so\'raladi. Chipta qaytarilmaydi.'}</i>`;

    const keyboard = getEventActionsKeyboard(event._id, isFavorite, event.mapUrl);

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }

    // Send high-res photo with caption and action buttons
    const posterUrl = event.poster || 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200';
    try {
      await ctx.replyWithPhoto(posterUrl, {
        caption,
        parse_mode: 'HTML',
        ...keyboard,
      });
    } catch (err) {
      // If photo failed, send clean text fallback
      await ctx.reply(caption, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    }
  } catch (error) {
    logger.error('showEventDetails error:', error);
    await ctx.reply('Tadbir ma\'lumotlarini yuklashda xatolik yuz berdi.');
  }
}

module.exports = {
  listEvents,
  listPopularEvents,
  showEventDetails,
};
