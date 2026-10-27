

const { Markup } = require('telegraf');
const config = require('../config');
const { Event, TicketType, Category } = require('../models');

const ADMIN_ID = String(config.telegram.adminId || '');

function isAdmin(ctx) {
  return Boolean(
    ADMIN_ID &&
    ctx.from &&
    String(ctx.from.id) === ADMIN_ID
  );
}

// Sessiya mavjudligini tekshirish
function ensureSession(ctx) {
  if (!ctx.session) {
    ctx.session = {};
  }

  return ctx.session;
}

function adminKeyboard() {
  return Markup.keyboard([
    ['➕ Tadbir qo‘shish', '🎟 Chipta qo‘shish'],
    ['❌ Bekor qilish'],
  ]).resize();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeSlug(value) {
  const transliteration = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd',
    е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i',
    й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
    о: 'o', п: 'p', р: 'r', с: 's', т: 't',
    у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch',
    ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '',
    э: 'e', ю: 'yu', я: 'ya',
  };

  return value
    .toLowerCase()
    .replace(/[а-яё]/g, (char) => transliteration[char] || char)
    .replace(/o[‘'ʻʼ`] |g[‘'ʻʼ`]/g, (match) =>
      match.trim().startsWith('o') ? 'o' : 'g'
    )
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'tadbir';
}

async function uniqueSlug(title) {
  const base = makeSlug(title);
  let slug = base;
  let number = 2;

  while (await Event.exists({ slug })) {
    slug = `${base}-${number++}`;
  }

  return slug;
}

async function startEventCreation(ctx) {
  const session = ensureSession(ctx);

  session.adminCreate = {
    type: 'event',
    step: 'title',
    data: {},
  };

  return ctx.reply(
    '➕ Yangi tadbir yaratamiz.\n\n1/8. Tadbir nomini yozing:',
    Markup.keyboard([['❌ Bekor qilish']]).resize()
  );
}

async function startTicketCreation(ctx) {
  const events = await Event.find({
    status: { $in: ['published', 'draft'] },
  })
    .select('title startAt')
    .sort({ startAt: 1 })
    .limit(50)
    .lean();

  if (!events.length) {
    return ctx.reply(
      'Hozircha tadbir yo‘q. Avval «➕ Tadbir qo‘shish» orqali tadbir yarating.',
      adminKeyboard()
    );
  }

  ensureSession(ctx).adminCreate = {
    type: 'ticket',
    step: 'event',
    data: {},
  };

  const buttons = events.map((event) => [
    Markup.button.callback(
      String(event.title || 'Tadbir').slice(0, 55),
      `admin_ticket_event:${event._id}`
    ),
  ]);

  buttons.push([
    Markup.button.callback('❌ Bekor qilish', 'admin_create_cancel'),
  ]);

  return ctx.reply(
    '🎟 Chipta qo‘shiladigan tadbirni tanlang:',
    Markup.inlineKeyboard(buttons)
  );
}

async function handleEventText(ctx, flow, value) {
  const data = flow.data;

  switch (flow.step) {
    case 'title': {
      if (value.length < 2 || value.length > 150) {
        return ctx.reply('Tadbir nomi 2–150 ta belgidan iborat bo‘lsin.');
      }

      data.title = value;
      flow.step = 'description';

      return ctx.reply('2/8. Tadbir tavsifini yozing:');
    }

    case 'description': {
      if (value.length > 3000) {
        return ctx.reply('Tavsif juda uzun. 3000 belgigacha yozing.');
      }

      data.description = value;
      flow.step = 'category';

      const categories = await Category.find()
        .select('name')
        .limit(50)
        .lean();

      if (!categories.length) {
        delete ensureSession(ctx).adminCreate;

        return ctx.reply(
          '❌ Kategoriyalar topilmadi. Avval MongoDB bazasiga Category qo‘shing.',
          adminKeyboard()
        );
      }

      const buttons = categories.map((category) => [
        Markup.button.callback(
          String(category.name || 'Kategoriya').slice(0, 55),
          `admin_event_category:${category._id}`
        ),
      ]);

      buttons.push([
        Markup.button.callback('❌ Bekor qilish', 'admin_create_cancel'),
      ]);

      return ctx.reply(
        '3/8. Tadbir kategoriyasini tanlang:',
        Markup.inlineKeyboard(buttons)
      );
    }

    case 'city': {
      if (value.length > 100) {
        return ctx.reply('Shahar nomi juda uzun.');
      }

      data.city = value;
      flow.step = 'venue';

      return ctx.reply('4/8. Tadbir o‘tkaziladigan joy nomini yozing:');
    }

    case 'venue': {
      data.venue = value;
      flow.step = 'address';

      return ctx.reply('5/8. Tadbir manzilini yozing:');
    }

    case 'address': {
      data.address = value;
      flow.step = 'startAt';

      return ctx.reply(
        '6/8. Boshlanish sanasi va vaqtini yozing.\n' +
        'Format: YYYY-MM-DD HH:mm\n' +
        'Masalan: 2026-12-25 18:30'
      );
    }

    case 'startAt': {
      const match = value.match(
        /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/
      );

      if (!match) {
        return ctx.reply(
          'Format noto‘g‘ri. Masalan: 2026-12-25 18:30'
        );
      }

      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const hour = Number(match[4]);
      const minute = Number(match[5]);

      if (
        month < 1 || month > 12 ||
        day < 1 || day > 31 ||
        hour > 23 || minute > 59
      ) {
        return ctx.reply('Sana yoki vaqt noto‘g‘ri. Qayta kiriting.');
      }

      // O‘zbekiston vaqti UTC+5
      const date = new Date(
        Date.UTC(year, month - 1, day, hour - 5, minute)
      );

      if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day ||
        date <= new Date()
      ) {
        return ctx.reply(
          'Sana yoki vaqt noto‘g‘ri, yoxud o‘tib ketgan. Qayta kiriting.'
        );
      }

      data.startAt = date;
      flow.step = 'poster';

      return ctx.reply(
        '7/8. Tadbir posterining to‘g‘ridan-to‘g‘ri rasm URL manzilini yuboring.\n' +
        'Rasm qo‘shmaslik uchun «O‘tkazib yuborish» deb yozing.'
      );
    }

    case 'poster': {
      const skip = [
        'o‘tkazib yuborish',
        "o'tkazib yuborish",
      ].includes(value.toLowerCase());

      if (!skip) {
        try {
          const url = new URL(value);

          if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error('URL noto‘g‘ri');
          }

          data.poster = url.toString();
        } catch {
          return ctx.reply(
            'Rasm URL manzili noto‘g‘ri. HTTPS URL yuboring yoki «O‘tkazib yuborish» deb yozing.'
          );
        }
      }

      flow.step = 'mapUrl';

      return ctx.reply(
        '8/8. Xarita URL manzilini yuboring yoki «O‘tkazib yuborish» deb yozing:'
      );
    }

    case 'mapUrl': {
      const skip = [
        'o‘tkazib yuborish',
        "o'tkazib yuborish",
      ].includes(value.toLowerCase());

      if (!skip) {
        try {
          const url = new URL(value);

          if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error('URL noto‘g‘ri');
          }

          data.mapUrl = url.toString();
        } catch {
          return ctx.reply(
            'Xarita URL manzili noto‘g‘ri. HTTPS URL yuboring yoki «O‘tkazib yuborish» deb yozing.'
          );
        }
      }

      data.slug = await uniqueSlug(data.title);

      try {
        const event = await Event.create({
          title: data.title,
          slug: data.slug,
          description: data.description,
          category: data.category,
          city: data.city,
          venue: data.venue,
          address: data.address,
          startAt: data.startAt,
          poster: data.poster || '',
          mapUrl: data.mapUrl || '',
          status: 'published',
          publishedAt: new Date(),
        });

        delete ensureSession(ctx).adminCreate;

        return ctx.reply(
          '✅ Tadbir muvaffaqiyatli qo‘shildi!\n\n' +
          `📌 Nomi: ${event.title}\n` +
          `🆔 ID: ${event._id}\n` +
          `🔗 Slug: ${event.slug}\n` +
          `📍 Manzil: ${event.venue}, ${event.city}\n` +
          `🗓 Sana: ${event.startAt.toLocaleString('uz-UZ', {
            timeZone: 'Asia/Tashkent',
          })}`,
          adminKeyboard()
        );
      } catch (error) {
        console.error('Event yaratish xatosi:', error);

        return ctx.reply(
          '❌ Tadbir saqlanmadi. Kategoriya mavjudligini va Event modelini tekshiring.'
        );
      }
    }

    default:
      return ctx.reply(
        'Jarayon holati topilmadi. /admin buyrug‘ini qayta yuboring.'
      );
  }
}

async function handleTicketText(ctx, flow, value) {
  const data = flow.data;

  switch (flow.step) {
    case 'name': {
      if (value.length < 2 || value.length > 100) {
        return ctx.reply('Chipta nomi 2–100 ta belgidan iborat bo‘lsin.');
      }

      data.name = value;
      flow.step = 'description';

      return ctx.reply(
        'Chipta tavsifini yozing yoki «O‘tkazib yuborish» deb yozing:'
      );
    }

    case 'description': {
      data.description = [
        'o‘tkazib yuborish',
        "o'tkazib yuborish",
      ].includes(value.toLowerCase()) ? '' : value;

      flow.step = 'price';

      return ctx.reply('Chipta narxini so‘mda kiriting. Masalan: 150000');
    }

    case 'price': {
      const price = Number(value);

      if (!Number.isFinite(price) || price < 0) {
        return ctx.reply('Narx 0 yoki undan katta raqam bo‘lishi kerak.');
      }

      data.price = price;
      flow.step = 'quantity';

      return ctx.reply('Jami nechta chipta bor? Masalan: 100');
    }

    case 'quantity': {
      const quantity = Number(value);

      if (!Number.isInteger(quantity) || quantity < 1) {
        return ctx.reply(
          'Chipta soni 1 yoki undan katta butun son bo‘lishi kerak.'
        );
      }

      data.totalQuantity = quantity;
      flow.step = 'sector';

      return ctx.reply(
        'Sektor yoki joylashuv nomini yozing.\n' +
        'Masalan: VIP, Fan-zone, Erkin joylashuv'
      );
    }

    case 'sector': {
      data.sector = value;

      try {
        const ticket = await TicketType.create({
          event: data.event,
          name: data.name,
          description: data.description || '',
          price: data.price,
          currency: 'UZS',
          totalQuantity: data.totalQuantity,
          sector: data.sector,
          isActive: true,
        });

        delete ensureSession(ctx).adminCreate;

        return ctx.reply(
          '✅ Chipta turi muvaffaqiyatli qo‘shildi!\n\n' +
          `🎫 Nomi: ${ticket.name}\n` +
          `💵 Narxi: ${ticket.price.toLocaleString('uz-UZ')} so‘m\n` +
          `🔢 Jami: ${ticket.totalQuantity} ta\n` +
          `📍 Sektor: ${ticket.sector}\n` +
          `🆔 ID: ${ticket._id}`,
          adminKeyboard()
        );
      } catch (error) {
        console.error('TicketType yaratish xatosi:', error);

        return ctx.reply(
          '❌ Chipta saqlanmadi. Tadbir mavjudligini va TicketType modelini tekshiring.'
        );
      }
    }

    default:
      return ctx.reply(
        'Jarayon holati topilmadi. /admin buyrug‘ini qayta yuboring.'
      );
  }
}

function registerAdminCreateHandlers(bot) {
  bot.command('admin', async (ctx) => {
    if (!isAdmin(ctx)) {
      return ctx.reply('⛔ Bu buyruq faqat admin uchun.');
    }

    ensureSession(ctx);

    return ctx.reply(
      '🛠 ELITE TICKETS — Admin panel\n\nKerakli amalni tanlang:',
      adminKeyboard()
    );
  });

  bot.hears('➕ Tadbir qo‘shish', async (ctx) => {
    if (!isAdmin(ctx)) {
      return ctx.reply('⛔ Ruxsat yo‘q.');
    }

    return startEventCreation(ctx);
  });

  bot.hears('🎟 Chipta qo‘shish', async (ctx) => {
    if (!isAdmin(ctx)) {
      return ctx.reply('⛔ Ruxsat yo‘q.');
    }

    try {
      return await startTicketCreation(ctx);
    } catch (error) {
      console.error('Chipta yaratish jarayoni xatosi:', error);

      return ctx.reply(
        '❌ Tadbirlar ro‘yxatini olishda xatolik yuz berdi.'
      );
    }
  });

  bot.hears('❌ Bekor qilish', async (ctx) => {
    if (!isAdmin(ctx)) {
      return ctx.reply('⛔ Ruxsat yo‘q.');
    }

    delete ensureSession(ctx).adminCreate;

    return ctx.reply('Jarayon bekor qilindi.', adminKeyboard());
  });

  bot.action('admin_create_cancel', async (ctx) => {
    await ctx.answerCbQuery();

    if (!isAdmin(ctx)) {
      return ctx.reply('⛔ Ruxsat yo‘q.');
    }

    delete ensureSession(ctx).adminCreate;

    return ctx.reply('Jarayon bekor qilindi.', adminKeyboard());
  });

  bot.action(/^admin_event_category:([a-f0-9]{24})$/i, async (ctx) => {
    await ctx.answerCbQuery();

    if (!isAdmin(ctx)) {
      return ctx.reply('⛔ Ruxsat yo‘q.');
    }

    const session = ensureSession(ctx);
    const flow = session.adminCreate;

    if (!flow || flow.type !== 'event' || flow.step !== 'category') {
      return ctx.reply(
        'Bu jarayon eskirgan. /admin buyrug‘ini qayta yuboring.'
      );
    }

    const category = await Category.findById(ctx.match[1]);

    if (!category) {
      return ctx.reply('Kategoriya topilmadi. Qaytadan tanlang.');
    }

    flow.data.category = category._id;
    flow.step = 'city';

    return ctx.reply(
      '3/8. Shahar nomini yozing:',
      Markup.removeKeyboard()
    );
  });

  bot.action(/^admin_ticket_event:([a-f0-9]{24})$/i, async (ctx) => {
    await ctx.answerCbQuery();

    if (!isAdmin(ctx)) {
      return ctx.reply('⛔ Ruxsat yo‘q.');
    }

    const session = ensureSession(ctx);
    const flow = session.adminCreate;

    if (!flow || flow.type !== 'ticket' || flow.step !== 'event') {
      return ctx.reply(
        'Bu jarayon eskirgan. /admin buyrug‘ini qayta yuboring.'
      );
    }

    const event = await Event.findById(ctx.match[1]);

    if (!event) {
      return ctx.reply('Tadbir topilmadi. Qaytadan urinib ko‘ring.');
    }

    flow.data.event = event._id;
    flow.step = 'name';

    return ctx.reply(
      `🎫 Tanlangan tadbir: ${event.title}\n\n1/5. Chipta turining nomini yozing:`,
      Markup.keyboard([['❌ Bekor qilish']]).resize()
    );
  });

  // Admin kiritgan matnlarni qayta ishlash
  bot.on('text', async (ctx, next) => {
    const session = ensureSession(ctx);
    const flow = session.adminCreate;

    if (!flow) {
      return next();
    }

    if (!isAdmin(ctx)) {
      delete session.adminCreate;

      return ctx.reply(
        '⛔ Admin jarayonini davom ettirishga ruxsat yo‘q.'
      );
    }

    const value = ctx.message.text.trim();

    if (value.startsWith('/')) {
      return next();
    }

    try {
      if (flow.type === 'event') {
        return await handleEventText(ctx, flow, value);
      }

      if (flow.type === 'ticket') {
        return await handleTicketText(ctx, flow, value);
      }

      delete session.adminCreate;

      return ctx.reply(
        'Jarayon bekor qilindi. /admin buyrug‘ini yuboring.'
      );
    } catch (error) {
      console.error('Admin kiritish xatosi:', error);

      return ctx.reply(
        '❌ Xatolik yuz berdi. «❌ Bekor qilish» tugmasini bosing.'
      );
    }
  });
}

module.exports = {
  registerAdminCreateHandlers,
};
