const { User, Order, Ticket, Favorite, Event } = require('../models');
const { formatMoney, formatDate, formatOrderStatus } = require('../utils/formatters');
const { Markup } = require('telegraf');
const logger = require('../utils/logger');

/**
 * Show User Profile
 */
async function handleProfile(ctx) {
  try {
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });
    if (!user) return ctx.reply('Iltimos avval /start buyrug\'ini yuboring.');

    const [ordersCount, ticketsCount, favCount] = await Promise.all([
      Order.countDocuments({ user: user._id }),
      Ticket.countDocuments({ owner: user._id }),
      Favorite.countDocuments({ user: user._id }),
    ]);

    const profileText = `👤 <b>FOYDALANUVCHI PROFILI:</b>\n\n` +
      `🆔 <b>Telegram ID:</b> <code>${user.telegramId}</code>\n` +
      `👤 <b>Ism:</b> ${user.firstName} ${user.lastName || ''}\n` +
      `📱 <b>Username:</b> ${user.username ? '@' + user.username : 'Mavjud emas'}\n` +
      `📞 <b>Telefon:</b> ${user.phone || 'Kiritilmagan'}\n` +
      `📅 <b>Ro'yxatdan o'tgan:</b> ${formatDate(user.createdAt)}\n` +
      `🎖 <b>Tizimdagi rol:</b> <code>${user.role}</code>\n\n` +
      `📊 <b>FAOLIYAT STATISTIKASI:</b>\n` +
      `📦 <b>Buyurtmalar:</b> ${ordersCount} ta\n` +
      `🎟 <b>Sotib olingan chiptalar:</b> ${ticketsCount} ta\n` +
      `❤️ <b>Sevimlilar:</b> ${favCount} ta tadbir`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('🎟 Chiptalarim', 'my_tickets:1'),
        Markup.button.callback('📦 Buyurtmalarim', 'my_orders:1'),
      ],
      [
        Markup.button.callback('❤️ Sevimlilarim', 'my_favorites:1'),
        Markup.button.callback('🏠 Asosiy menyu', 'go_main_menu'),
      ],
    ]);

    await ctx.reply(profileText, { parse_mode: 'HTML', ...keyboard });
  } catch (error) {
    logger.error('handleProfile error:', error);
    await ctx.reply('Profilni yuklashda xatolik yuz berdi.');
  }
}

/**
 * List Past Orders
 */
async function handleMyOrders(ctx, page = 1) {
  try {
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });
    if (!user) return ctx.reply('Iltimos avval /start buyrug\'ini yuboring.');

    const PAGE_SIZE = 5;
    const skip = (page - 1) * PAGE_SIZE;

    const [orders, total] = await Promise.all([
      Order.find({ user: user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE),
      Order.countDocuments({ user: user._id }),
    ]);

    if (orders.length === 0) {
      const emptyText = '📦 <b>Sizda hozircha buyurtmalar mavjud emas.</b>';
      const emptyKb = Markup.inlineKeyboard([
        [Markup.button.callback('🎫 Tadbirlarni ko\'rish', 'list_events:1')],
        [Markup.button.callback('🏠 Asosiy menyu', 'go_main_menu')],
      ]);
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
        return ctx.reply(emptyText, { parse_mode: 'HTML', ...emptyKb });
      }
      return ctx.reply(emptyText, { parse_mode: 'HTML', ...emptyKb });
    }

    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
    let message = `📦 <b>BUYURTMALAR TARIXI</b> (Sahifa ${page}/${totalPages}):\n\n`;

    orders.forEach((ord, idx) => {
      message += `<b>${skip + idx + 1}. Buyurtma:</b> <code>${ord.orderNumber}</code>\n` +
        `📅 <b>Sana:</b> ${formatDate(ord.createdAt)}\n` +
        `💰 <b>Summa:</b> ${formatMoney(ord.total)}\n` +
        `📊 <b>Holat:</b> ${formatOrderStatus(ord.paymentStatus)}\n` +
        `🎟 <b>Chiptalar soni:</b> ${ord.items.reduce((acc, it) => acc + it.quantity, 0)} ta\n\n`;
    });

    const buttons = [];
    const navRow = [];
    if (page > 1) navRow.push(Markup.button.callback('⬅️ Oldingi', `my_orders:${page - 1}`));
    if (page < totalPages) navRow.push(Markup.button.callback('Keyingi ➡️', `my_orders:${page + 1}`));
    if (navRow.length > 0) buttons.push(navRow);
    buttons.push([Markup.button.callback('🏠 Asosiy menyu', 'go_main_menu')]);

    const keyboard = Markup.inlineKeyboard(buttons);

    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
      await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
    } else {
      await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
    }
  } catch (error) {
    logger.error('handleMyOrders error:', error);
    await ctx.reply('Buyurtmalar tarixini yuklashda xatolik yuz berdi.');
  }
}

/**
 * Handle Favorite Events toggle
 */
async function handleToggleFavorite(ctx, eventId) {
  try {
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });
    if (!user) return;

    const existing = await Favorite.findOne({ user: user._id, event: eventId });
    if (existing) {
      await Favorite.findByIdAndDelete(existing._id);
      if (ctx.callbackQuery) await ctx.answerCbQuery('Sevimlilardan olib tashlandi 🤍');
    } else {
      await Favorite.create({ user: user._id, event: eventId });
      if (ctx.callbackQuery) await ctx.answerCbQuery('Sevimlilarga qo\'shildi ❤️');
    }

    const { showEventDetails } = require('./eventsHandler');
    return showEventDetails(ctx, eventId);
  } catch (error) {
    logger.error('handleToggleFavorite error:', error);
  }
}

/**
 * List User's Favorites
 */
async function handleMyFavorites(ctx, page = 1) {
  try {
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });
    if (!user) return ctx.reply('Iltimos avval /start buyrug\'ini yuboring.');

    const favorites = await Favorite.find({ user: user._id }).populate({
      path: 'event',
      populate: { path: 'category' },
    });

    const validFavs = favorites.filter((f) => f.event && f.event.status === 'published');

    if (validFavs.length === 0) {
      const emptyText = '❤️ <b>Sevimlilar ro\'yxatingiz bo\'sh.</b>\n\n' +
        'O\'zingizga yoqqan tadbirlarni "❤️ Sevimlilarga qo\'shish" tugmasi orqali saqlab qo\'yishingiz mumkin.';
      const emptyKb = Markup.inlineKeyboard([
        [Markup.button.callback('🎫 Tadbirlarni ko\'rish', 'list_events:1')],
        [Markup.button.callback('🏠 Asosiy menyu', 'go_main_menu')],
      ]);
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
        return ctx.reply(emptyText, { parse_mode: 'HTML', ...emptyKb });
      }
      return ctx.reply(emptyText, { parse_mode: 'HTML', ...emptyKb });
    }

    let message = `❤️ <b>SIZNING SEVIMLI TADBIRLARINGIZ:</b>\n\n`;
    const buttons = [];

    validFavs.forEach((fav, idx) => {
      const ev = fav.event;
      message += `<b>${idx + 1}. ${ev.title}</b>\n` +
        `📅 ${formatDate(ev.startAt)}\n` +
        `📍 ${ev.venue}, ${ev.city}\n\n`;

      buttons.push([
        Markup.button.callback(`🎟 ${ev.title}`, `view_event:${ev._id}`),
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
    logger.error('handleMyFavorites error:', error);
    await ctx.reply('Sevimlilarni yuklashda xatolik yuz berdi.');
  }
}

module.exports = {
  handleProfile,
  handleMyOrders,
  handleToggleFavorite,
  handleMyFavorites,
};
