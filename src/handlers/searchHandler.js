const { Category, Event } = require('../models');
const { formatDate } = require('../utils/formatters');
const config = require('../config');
const { Markup } = require('telegraf');
const logger = require('../utils/logger');

/**
 * Show Categories List
 */
async function handleCategories(ctx) {
  try {
    const categories = await Category.find({ isActive: true }).sort({ order: 1 });

    if (categories.length === 0) {
      return ctx.reply('Hozircha kategoriyalar mavjud emas.');
    }

    let message = `🗂 <b>TADBIR KATEGORIYALARI:</b>\n\n` +
      `Quyidagi bo'limlardan birini tanlang va o'zingizga yoqqan yo'nalishdagi tadbirlarni ko'ring:`;

    const buttons = [];
    categories.forEach((cat) => {
      buttons.push([
        Markup.button.callback(`${cat.icon || '🎫'} ${cat.name}`, `cat_events:${cat._id}:1`),
      ]);
    });

    buttons.push([Markup.button.callback('🏠 Asosiy menyu', 'go_main_menu')]);

    const keyboard = Markup.inlineKeyboard(buttons);

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
      await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
    } else {
      await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
    }
  } catch (error) {
    logger.error('handleCategories error:', error);
    await ctx.reply('Kategoriyalarni yuklashda xatolik yuz berdi.');
  }
}

/**
 * Show Events of a specific Category
 */
async function handleCategoryEvents(ctx, categoryId, page = 1) {
  try {
    const { listEvents } = require('./eventsHandler');
    return listEvents(ctx, page, { category: categoryId });
  } catch (error) {
    logger.error('handleCategoryEvents error:', error);
  }
}

/**
 * Handle Search Prompt or Query
 */
async function handleSearchPrompt(ctx) {
  const message = `🔎 <b>TADBIRLARNI QIDIRISH:</b>\n\n` +
    `Qidirmoqchi bo'lgan tadbir nomi, shahar yoki san'atkor ismini yozib yuboring.\n` +
    `<i>Misol uchun: Humo Arena, Konsert, Stand-up, Toshkent</i>`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🎫 Barcha tadbirlar', 'list_events:1')],
    [Markup.button.callback('🏠 Asosiy menyu', 'go_main_menu')],
  ]);

  await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
}

/**
 * Perform Search with User Input Text
 */
async function handleSearchQuery(ctx, text) {
  try {
    const regex = new RegExp(text.trim(), 'i');
    const events = await Event.find({
      status: 'published',
      $or: [
        { title: regex },
        { description: regex },
        { venue: regex },
        { city: regex },
        { organizerName: regex },
      ],
    }).limit(6);

    if (events.length === 0) {
      return ctx.reply(`❌ "<b>${text}</b>" bo'yicha hech qanday tadbir topilmadi.\nBoshqa so'z bilan qidirib ko'ring yoki barcha tadbirlarni ko'ring.`, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [Markup.button.callback('🎫 Barcha tadbirlar', 'list_events:1')],
            [Markup.button.callback('🏠 Asosiy menyu', 'go_main_menu')],
          ],
        },
      });
    }

    let message = `🔎 "<b>${text}</b>" bo'yicha topilgan tadbirlar:\n\n`;
    const buttons = [];

    events.forEach((ev, idx) => {
      message += `<b>${idx + 1}. ${ev.title}</b>\n` +
        `📅 ${formatDate(ev.startAt)}\n` +
        `📍 ${ev.venue}, ${ev.city}\n\n`;

      buttons.push([Markup.button.callback(`🎟 ${ev.title}`, `view_event:${ev._id}`)]);
    });

    buttons.push([Markup.button.callback('🏠 Asosiy menyu', 'go_main_menu')]);

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    });
  } catch (error) {
    logger.error('handleSearchQuery error:', error);
    await ctx.reply('Qidiruvda xatolik yuz berdi.');
  }
}

/**
 * Help & Information
 */
async function handleHelp(ctx) {
  const helpText = `ℹ️ <b>YORDAM VA PLATFORMA MA'LUMOTLARI:</b>\n\n` +
    `<b>${config.appName}</b> orqali siz O'zbekistondagi eng nufuzli tadbirlarga rasmiy elektron chiptalarni onlayn xarid qilishingiz mumkin.\n\n` +
    `❓ <b>Qanday chipta sotib olaman?</b>\n` +
    `1. "🎫 Tadbirlar" bo'limidan tadbirni tanlang.\n` +
    `2. Chipta turini va sonini tanlab "Savatga qo'shish" tugmasini bosing.\n` +
    `3. "🛒 Savatim" orqali buyurtmani tasdiqlang va to'lov usulini tanlang.\n` +
    `4. To'lov tasdiqlangach, chipta QR-kod ko'rinishida chatga yuboriladi.\n\n` +
    `❓ <b>Tadbirga kirish qanday bo'ladi?</b>\n` +
    `Tadbirga kirish joyidagi nazoratchiga botdan olgan QR-kodli chiptangizni telefoningiz orqali ko'rsatasiz.\n\n` +
    `📞 <b>Qo'llab-quvvatlash xizmati:</b>\n` +
    `${config.telegram.contactText}\n\n` +
    `⚡️ <i>Xavfsiz, tezkor va ishonchli elektron chiptalar!</i>`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🎫 Tadbirlarni ko\'rish', 'list_events:1')],
    [Markup.button.callback('🏠 Asosiy menyu', 'go_main_menu')],
  ]);

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery();
    await ctx.reply(helpText, { parse_mode: 'HTML', ...keyboard });
  } else {
    await ctx.reply(helpText, { parse_mode: 'HTML', ...keyboard });
  }
}

module.exports = {
  handleCategories,
  handleCategoryEvents,
  handleSearchPrompt,
  handleSearchQuery,
  handleHelp,
};
