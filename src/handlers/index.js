



const { session } = require('telegraf');

const { handleStart } = require('./startHandler');

const {
  listEvents,
  listPopularEvents,
  showEventDetails,
} = require('./eventsHandler');

const {
  handleTicketSelection,
  handleAddToCart,
  handleViewCart,
  handleCartItemAction,
  handleClearCart,
} = require('./cartHandler');

const {
  handleCheckoutStart,
  handleProcessPayment,
  handleCheckPayment,
  handleCancelOrder,
} = require('./checkoutHandler');

const {
  handleMyTickets,
  handleViewSingleTicket,
  handleDownloadPDF,
} = require('./ticketsHandler');

const {
  handleProfile,
  handleMyOrders,
  handleToggleFavorite,
  handleMyFavorites,
} = require('./profileHandler');

const {
  handleCategories,
  handleCategoryEvents,
  handleSearchPrompt,
  handleSearchQuery,
  handleHelp,
} = require('./searchHandler');

const {
  registerAdminCreateHandlers,
} = require('./adminCreateHandler');

const { getMainMenu } = require('../utils/keyboards');
const logger = require('../utils/logger');

function registerBotHandlers(bot) {
  // 1. SESSION — barcha handlerlardan oldin
  bot.use(session());

  // 2. Sessiya himoyasi
  bot.use(async (ctx, next) => {
    if (!ctx.session) {
      ctx.session = {};
    }

    return next();
  });

  // 3. Xatolarni boshqarish
  bot.catch((err, ctx) => {
    logger.error(`Bot xatoligi (${ctx.updateType}):`, err);

    if (ctx && typeof ctx.reply === 'function') {
      ctx.reply(
        'Tizimda vaqtinchalik xatolik yuz berdi. Qaytadan urinib ko‘ring.'
      ).catch(() => {});
    }
  });

  // 4. Admin handlerlari
  registerAdminCreateHandlers(bot);

  // 5. /start
  bot.start(handleStart);

  // 6. Asosiy menyu
  bot.hears('🎫 Tadbirlar', (ctx) => listEvents(ctx, 1));
  bot.hears('🔥 Ommabop tadbirlar', (ctx) =>
    listPopularEvents(ctx)
  );
  bot.hears('🔎 Qidiruv', (ctx) =>
    handleSearchPrompt(ctx)
  );
  bot.hears('🗂 Kategoriyalar', (ctx) =>
    handleCategories(ctx)
  );
  bot.hears('❤️ Sevimlilar', (ctx) =>
    handleMyFavorites(ctx, 1)
  );
  bot.hears('🛒 Savatim', (ctx) =>
    handleViewCart(ctx)
  );
  bot.hears('📦 Buyurtmalarim', (ctx) =>
    handleMyOrders(ctx, 1)
  );
  bot.hears('🎟 Chiptalarim', (ctx) =>
    handleMyTickets(ctx, 1)
  );
  bot.hears('👤 Profil', (ctx) =>
    handleProfile(ctx)
  );
  bot.hears('ℹ️ Yordam', (ctx) =>
    handleHelp(ctx)
  );

  // 7. Bosh menyu
  bot.action('go_main_menu', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.reply('Bosh menyu:', getMainMenu());
  });

  // 8. Tadbirlar ro‘yxati
  bot.action(/^list_events:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    return listEvents(ctx, parseInt(ctx.match[1], 10) || 1);
  });

  // 9. Kategoriyalar
  bot.action(/^cat_events:([a-f0-9]+):(\d+)$/i, async (ctx) => {
    await ctx.answerCbQuery();

    return handleCategoryEvents(
      ctx,
      ctx.match[1],
      parseInt(ctx.match[2], 10) || 1
    );
  });

  // 10. Tadbir tafsilotlari
  bot.action(/^view_event:([a-f0-9]+)$/i, async (ctx) => {
    await ctx.answerCbQuery();
    return showEventDetails(ctx, ctx.match[1]);
  });

  // 11. Tadbir manzili
  bot.action(/^venue_info:([a-f0-9]+)$/i, async (ctx) => {
    await ctx.answerCbQuery();

    try {
      const { Event } = require('../models');
      const event = await Event.findById(ctx.match[1]);

      if (!event) {
        return ctx.reply('Tadbir topilmadi.');
      }

      return ctx.reply(
        `📍 <b>Manzil:</b> ${event.venue || ''}\n` +
        `${event.address || ''}, ${event.city || ''}`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      logger.error('Tadbir manzilini olish xatosi:', error);
      return ctx.reply('Manzilni olishda xatolik yuz berdi.');
    }
  });

  // 12. Sevimlilar
  bot.action(/^toggle_fav:([a-f0-9]+)$/i, async (ctx) => {
    await ctx.answerCbQuery();
    return handleToggleFavorite(ctx, ctx.match[1]);
  });

  // 13. Chipta tanlash
  bot.action(/^select_ticket:([a-f0-9]+)$/i, async (ctx) => {
    await ctx.answerCbQuery();
    return handleTicketSelection(ctx, ctx.match[1]);
  });

  bot.action(/^quick_add:([a-f0-9]+)$/i, async (ctx) => {
    await ctx.answerCbQuery();
    return handleTicketSelection(ctx, ctx.match[1]);
  });

  bot.action(
    /^choose_tt:([a-f0-9]+):([a-f0-9]+):(\d+)$/i,
    async (ctx) => {
      await ctx.answerCbQuery();

      return handleTicketSelection(
        ctx,
        ctx.match[1],
        ctx.match[2],
        parseInt(ctx.match[3], 10)
      );
    }
  );

  bot.action(
    /^qty_inc:([a-f0-9]+):([a-f0-9]+):(\d+)$/i,
    async (ctx) => {
      await ctx.answerCbQuery();

      return handleTicketSelection(
        ctx,
        ctx.match[1],
        ctx.match[2],
        parseInt(ctx.match[3], 10) + 1
      );
    }
  );

  bot.action(
    /^qty_dec:([a-f0-9]+):([a-f0-9]+):(\d+)$/i,
    async (ctx) => {
      await ctx.answerCbQuery();

      return handleTicketSelection(
        ctx,
        ctx.match[1],
        ctx.match[2],
        Math.max(1, parseInt(ctx.match[3], 10) - 1)
      );
    }
  );

  // 14. Savatga qo‘shish
  bot.action(/^add:([a-f0-9]+):([a-f0-9]+):(\d+)$/i, async (ctx) => {
    await ctx.answerCbQuery();

    return handleAddToCart(
      ctx,
      ctx.match[1],
      ctx.match[2],
      parseInt(ctx.match[3], 10)
    );
  });

  bot.action(
    /^confirm_add_cart:([a-f0-9]+):([a-f0-9]+):(\d+)$/i,
    async (ctx) => {
      await ctx.answerCbQuery();

      return handleAddToCart(
        ctx,
        ctx.match[1],
        ctx.match[2],
        parseInt(ctx.match[3], 10)
      );
    }
  );

  // 15. Savat amallari
  bot.action('view_cart', async (ctx) => {
    await ctx.answerCbQuery();
    return handleViewCart(ctx);
  });

  bot.action(/^cart_inc:([a-f0-9]+)$/i, async (ctx) => {
    await ctx.answerCbQuery();
    return handleCartItemAction(ctx, 'inc', ctx.match[1]);
  });

  bot.action(/^cart_dec:([a-f0-9]+)$/i, async (ctx) => {
    await ctx.answerCbQuery();
    return handleCartItemAction(ctx, 'dec', ctx.match[1]);
  });

  bot.action(/^cart_remove:([a-f0-9]+)$/i, async (ctx) => {
    await ctx.answerCbQuery();
    return handleCartItemAction(ctx, 'remove', ctx.match[1]);
  });

  bot.action('cart_clear', async (ctx) => {
    await ctx.answerCbQuery();
    return handleClearCart(ctx);
  });

  // 16. Buyurtma va to‘lov
  bot.action('checkout_start', async (ctx) => {
    await ctx.answerCbQuery();
    return handleCheckoutStart(ctx);
  });

  bot.action(/^pay_order:([a-f0-9]+):(\w+)$/i, async (ctx) => {
    await ctx.answerCbQuery();
    return handleProcessPayment(ctx, ctx.match[1], ctx.match[2]);
  });

  bot.action(/^check_payment:([a-f0-9]+)$/i, async (ctx) => {
    await ctx.answerCbQuery();
    return handleCheckPayment(ctx, ctx.match[1]);
  });

  bot.action(/^cancel_order:([a-f0-9]+)$/i, async (ctx) => {
    await ctx.answerCbQuery();
    return handleCancelOrder(ctx, ctx.match[1]);
  });

  // 17. Chiptalarim
  bot.action(/^my_tickets:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    return handleMyTickets(ctx, parseInt(ctx.match[1], 10) || 1);
  });

  bot.action(/^view_single_ticket:([a-f0-9]+)$/i, async (ctx) => {
    await ctx.answerCbQuery();
    return handleViewSingleTicket(ctx, ctx.match[1]);
  });

  bot.action(/^download_pdf:([a-f0-9]+)$/i, async (ctx) => {
    await ctx.answerCbQuery();
    return handleDownloadPDF(ctx, ctx.match[1]);
  });

  // 18. Buyurtmalarim
  bot.action(/^my_orders:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    return handleMyOrders(ctx, parseInt(ctx.match[1], 10) || 1);
  });

  // 19. Sevimlilarim
  bot.action(/^my_favorites:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    return handleMyFavorites(ctx, parseInt(ctx.match[1], 10) || 1);
  });

  bot.action('noop', (ctx) => ctx.answerCbQuery());

  bot.action('disabled_tt', (ctx) =>
    ctx.answerCbQuery('Ushbu chipta turi tugagan!')
  );

  // 20. Telefon raqamini saqlash
  bot.on('contact', async (ctx) => {
    try {
      const { User } = require('../models');
      const contact = ctx.message.contact;

      if (contact?.phone_number && ctx.from) {
        await User.findOneAndUpdate(
          { telegramId: ctx.from.id },
          { $set: { phone: contact.phone_number } }
        );

        await ctx.reply(
          `✅ <b>Telefon raqamingiz muvaffaqiyatli saqlandi:</b> ${contact.phone_number}`,
          {
            parse_mode: 'HTML',
            ...getMainMenu(),
          }
        );
      }
    } catch (error) {
      logger.error('Contact save error:', error);
    }
  });

  // 21. Umumiy qidiruv — eng oxirida
  bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;

    const isMenuText = [
      '🎫 Tadbirlar',
      '🔥 Ommabop tadbirlar',
      '🔎 Qidiruv',
      '🗂 Kategoriyalar',
      '❤️ Sevimlilar',
      '🛒 Savatim',
      '📦 Buyurtmalarim',
      '🎟 Chiptalarim',
      '👤 Profil',
      'ℹ️ Yordam',
      '➕ Tadbir qo‘shish',
      '🎟 Chipta qo‘shish',
      '❌ Bekor qilish',
    ].includes(text);

    if (text.startsWith('/') || isMenuText) {
      return next();
    }

    return handleSearchQuery(ctx, text);
  });
}

module.exports = {
  registerBotHandlers,
};
