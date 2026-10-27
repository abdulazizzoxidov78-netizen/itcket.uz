const { Ticket, Event, Order } = require('../models');
const { renderTicketImage, renderTicketPDF, renderTicketHTML } = require('../services/ticketRenderer');
const logger = require('../utils/logger');

/**
 * Get My Tickets
 */
async function getMyTickets(req, res, next) {
  try {
    const tickets = await Ticket.find({ owner: req.user._id })
      .populate('event ticketType order')
      .sort({ createdAt: -1 });

    res.json({ success: true, tickets });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Ticket by ID
 */
async function getTicketById(req, res, next) {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findById(id).populate('event ticketType order');
    if (!ticket) return res.status(404).json({ success: false, message: 'Chipta topilmadi' });

    res.json({ success: true, ticket });
  } catch (error) {
    next(error);
  }
}

/**
 * Stream Ticket Image (PNG)
 */
async function streamTicketImage(req, res, next) {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findById(id).populate('event ticketType order');
    if (!ticket) return res.status(404).send('Chipta topilmadi');

    const imageBuffer = await renderTicketImage(ticket, ticket.event, ticket.order);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="ticket_${ticket.ticketId}.png"`);
    res.send(imageBuffer);
  } catch (error) {
    next(error);
  }
}

/**
 * Stream Ticket Vector PDF
 */
async function streamTicketPDF(req, res, next) {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findById(id).populate('event ticketType order');
    if (!ticket) return res.status(404).send('Chipta topilmadi');

    const pdfDoc = renderTicketPDF(ticket, ticket.event, ticket.order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ticket_${ticket.ticketId}.pdf"`);
    pdfDoc.pipe(res);
  } catch (error) {
    next(error);
  }
}

/**
 * View Web Ticket Page (Identical Luxury HTML/CSS layout)
 */
async function viewTicketWeb(req, res, next) {
  try {
    const { id } = req.params;
    // Look up by _id or by ticketId
    const ticket = await Ticket.findOne({
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { ticketId: id }],
    }).populate('event ticketType order');

    if (!ticket) {
      return res.status(404).send(`
        <body style="background:#0F172A;color:#fff;font-family:sans-serif;text-align:center;padding:50px;">
          <h2>❌ Chipta topilmadi</h2>
          <p>Kiritilgan chipta identifikatori mavjud emas.</p>
        </body>
      `);
    }

    const html = await renderTicketHTML(ticket, ticket.event, ticket.order);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyTickets,
  getTicketById,
  streamTicketImage,
  streamTicketPDF,
  viewTicketWeb,
};
