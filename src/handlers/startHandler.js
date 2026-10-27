
const { User } = require('../models');
const { getMainMenu } = require('../utils/keyboards');
const config = require('../config');
const logger = require('../utils/logger');
const { Markup } = require('telegraf');

async function handleStart(ctx) {
  try {
    const telegramId = ctx.from.id;
    const firstName = ctx.from.first_name || '';
    const lastName = ctx.from.last_name || '';
    const username = ctx.from.username || '';

    const isAdmin =
      String(telegramId) === String(config.telegram.adminId);

    let user = await User.findOne({ telegramId });

    if (!user) {
      user = await User.create({
        telegramId,
        firstName,
        lastName,
        username,
        role: isAdmin ? 'superadmin' : 'customer',
      });
    } else {
      user.firstName = firstName;
      user.lastName = lastName;
      user.username = username;
      user.lastActiveAt = new Date();

      if (isAdmin) {
        user.role = 'superadmin';
      }

      await user.save();
    }

    const payload = ctx.message?.text?.split(' ')[1];

    if (payload?.startsWith('ev_')) {
      const { showEventDetails } = require('./eventsHandler');
      return await showEventDetails(ctx, payload.slice(3));
    }

    const welcomeText =
      `👋 <b>Assalomu alaykum, ${firstName}!</b>\n\n` +
      `<b>${config.appName}</b> — onlayn chiptalar platformasiga xush kelibsiz!\n\n` +
      `🎭 Konsertlar, teatr, stand-up va boshqa tadbirlar uchun ` +
      `elektron chiptalarni shu yerdan xarid qilishingiz mumkin.\n\n` +
      `Quyidagi menyudan kerakli bo‘limni tanlang:`;

    if (isAdmin) {
      return await ctx.reply(
        welcomeText +
          '\n\n🛠 <b>Admin paneli</b>\nTadbir yoki chipta qo‘shishingiz mumkin.',
        {
          parse_mode: 'HTML',
          ...Markup.keyboard([
            ['➕ Tadbir qo‘shish', '🎟 Chipta qo‘shish'],
            ['🎫 Tadbirlar', '🔥 Ommabop tadbirlar'],
            ['🔎 Qidiruv', '🗂 Kategoriyalar'],
            ['❤️ Sevimlilar', '🛒 Savatim'],
            ['📦 Buyurtmalarim', '🎟 Chiptalarim'],
            ['👤 Profil', 'ℹ️ Yordam'],
          ]).resize(),
        }
      );
    }

    return await ctx.reply(welcomeText, {
      parse_mode: 'HTML',
      ...getMainMenu(),
    });
  } catch (error) {
    logger.error('handleStart error:', error);

    return ctx.reply(
      'Tizimda vaqtinchalik xatolik yuz berdi. Qayta /start yuboring.'
    );
  }
}

module.exports = { handleStart };
