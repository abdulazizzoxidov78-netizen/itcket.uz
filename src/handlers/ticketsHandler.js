const { Ticket, Event, Order, User } = require('../models');
const { renderTicketPDF } = require('../services/ticketRenderer');
const { sendTicketToUser } = require('../services/botService');
const { formatMoney, formatDate, formatTicketStatus } = require('../utils/formatters');
const { Markup } = require('telegraf');
const logger = require('../utils/logger');

const PAGE_SIZE = 5;

/**
 * List user's tickets with pagination
 */
async function handleMyTickets(ctx, page = 1) {
  try {
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });
    if (!user) return ctx.reply('Iltimos avval /start buyrug\'ini yuboring.');

    const skip = (page - 1) * PAGE_SIZE;

    const [tickets, total] = await Promise.all([
      Ticket.find({ owner: user._id })
        .populate('event ticketType order')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(PAGE_SIZE),
      Ticket.countDocuments({ owner: user._id }),
    ]);

    if (tickets.length === 0) {
      const emptyText = '🎟 <b>Sizda hozircha xarid qilingan chiptalar mavjud emas.</b>\n\n' +
        'Tadbirlar ro\'yxatiga o\'tib o\'zingizga yoqqan tadbirga chipta xarid qilishingiz mumkin.';

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

    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
    let message = `🎟 <b>SIZNING CHIPTALARINGIZ</b> (Sahifa ${page}/${totalPages}):\n\n`;

    const buttons = [];
    tickets.forEach((tkt, idx) => {
      const ev = tkt.event;
      const statusIcon = tkt.status === 'active' ? '🟢' : '🔴';
      message += `${statusIcon} <b>${skip + idx + 1}. ${ev ? ev.title : 'Tadbir'}</b>\n` +
        `📅 ${ev ? formatDate(ev.startAt) : ''}\n` +
        `🎫 <b>Turi:</b> ${tkt.ticketType?.name || 'Standard'} • <b>Holati:</b> ${formatTicketStatus(tkt.status)}\n` +
        `🔢 <b>ID:</b> <code>${tkt.ticketId}</code>\n\n`;

      buttons.push([
        Markup.button.callback(`🔍 Ko'rish: ${tkt.ticketId}`, `view_single_ticket:${tkt._id}`),
        Markup.button.callback(`📄 PDF`, `download_pdf:${tkt._id}`),
      ]);
    });

    const navRow = [];
    if (page > 1) navRow.push(Markup.button.callback('⬅️ Oldingi', `my_tickets:${page - 1}`));
    if (page < totalPages) navRow.push(Markup.button.callback('Keyingi ➡️', `my_tickets:${page + 1}`));
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
    logger.error('handleMyTickets error:', error);
    await ctx.reply('Chiptalarni yuklashda xatolik yuz berdi.');
  }
}

/**
 * View single ticket with QR code & image
 */
async function handleViewSingleTicket(ctx, ticketId) {
  try {
    const ticket = await Ticket.findById(ticketId).populate('event ticketType order');
    if (!ticket) {
      if (ctx.callbackQuery) await ctx.answerCbQuery('Chipta topilmadi!');
      return ctx.reply('Chipta topilmadi.');
    }

    if (ctx.callbackQuery) await ctx.answerCbQuery('Chipta tayyorlanmoqda...');
    await sendTicketToUser(ctx.from.id, ticket, ticket.event, ticket.order);
  } catch (error) {
    logger.error('handleViewSingleTicket error:', error);
    await ctx.reply('Chiptani ko\'rsatishda xatolik yuz berdi.');
  }
}

/**
 * Download Ticket as vector PDF
 */
async function handleDownloadPDF(ctx, ticketId) {
  try {
    const ticket = await Ticket.findById(ticketId).populate('event ticketType order');
    if (!ticket) {
      if (ctx.callbackQuery) await ctx.answerCbQuery('Chipta topilmadi!');
      return ctx.reply('Chipta topilmadi.');
    }

    if (ctx.callbackQuery) await ctx.answerCbQuery('PDF tayyorlanmoqda...');

    const pdfDoc = renderTicketPDF(ticket, ticket.event, ticket.order);

    // Collect buffer from stream
    const buffers = [];
    pdfDoc.on('data', (chunk) => buffers.push(chunk));
    pdfDoc.on('end', async () => {
      const pdfBuffer = Buffer.concat(buffers);
      await ctx.replyWithDocument(
        {
          source: pdfBuffer,
          filename: `chipta_${ticket.ticketId}.pdf`,
        },
        {
          caption: `📄 <b>${ticket.event?.title || 'Tadbir'}</b> chiptasi\nChipta ID: <code>${ticket.ticketId}</code>`,
          parse_mode: 'HTML',
        }
      );
    });
  } catch (error) {
    logger.error('handleDownloadPDF error:', error);
    await ctx.reply('PDF chiptani yaratishda xatolik yuz berdi.');
  }
}

module.exports = {
  handleMyTickets,
  handleViewSingleTicket,
  handleDownloadPDF,
};
