const { Ticket, Event, AuditLog } = require('../models');
const { formatDate } = require('../utils/formatters');
const logger = require('../utils/logger');

/**
 * Validate Entrance Ticket QR Code (Atomic single-use check)
 */
async function validateTicket(req, res, next) {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'QR-kod ma\'lumoti kiritilmadi.',
      });
    }

    const cleanToken = token.trim();

    // Find ticket by qrToken or ticketId
    const ticket = await Ticket.findOne({
      $or: [{ qrToken: cleanToken }, { ticketId: cleanToken }],
    }).populate('event ticketType order');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        valid: false,
        status: 'not_found',
        message: '❌ BAZADA BUNDAY CHIPTA TOPILMADI! Qalbaki yoki noto\'g\'ri QR-kod.',
      });
    }

    // Check if cancelled or refunded
    if (ticket.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        valid: false,
        status: 'cancelled',
        message: '❌ Ushbu chipta bekor qilingan! Kirish taqiqlanadi.',
        ticket,
      });
    }

    if (ticket.status === 'refunded') {
      return res.status(400).json({
        success: false,
        valid: false,
        status: 'refunded',
        message: '❌ Ushbu chipta puli qaytarilgan! Kirish taqiqlanadi.',
        ticket,
      });
    }

    // Check if already used
    if (ticket.status === 'used') {
      return res.status(400).json({
        success: false,
        valid: false,
        status: 'already_used',
        message: `❌ BU CHIPTA AVVAL ISHLATILGAN!\nIshlatilgan vaqti: ${formatDate(ticket.usedAt)}`,
        ticket,
      });
    }

    // Atomic update to prevent race conditions (double entry)
    const updatedTicket = await Ticket.findOneAndUpdate(
      { _id: ticket._id, status: 'active' },
      {
        $set: {
          status: 'used',
          usedAt: new Date(),
          usedBy: req.user ? req.user._id : null,
        },
      },
      { new: true }
    ).populate('event ticketType');

    if (!updatedTicket) {
      return res.status(400).json({
        success: false,
        valid: false,
        status: 'already_used',
        message: '❌ Chipta hozirgina boshqa turniketda ishlatildi!',
      });
    }

    // Audit log entrance check
    await AuditLog.create({
      actor: req.user ? req.user._id : null,
      actorEmail: req.user ? req.user.email : 'scanner',
      action: 'TICKET_CHECKIN',
      entityType: 'Ticket',
      entityId: String(updatedTicket._id),
      metadata: {
        ticketId: updatedTicket.ticketId,
        eventTitle: updatedTicket.event?.title,
        customerName: updatedTicket.customerName,
      },
    }).catch(() => {});

    logger.info(`Chipta muvaffaqiyatli tekshirildi va kirishga ruxsat berildi: ${updatedTicket.ticketId} (${updatedTicket.customerName})`);

    return res.json({
      success: true,
      valid: true,
      status: 'success',
      message: '✅ CHIPTA HAQIQIY! KIRISHGA RUXSAT BERILDI.',
      ticket: {
        ticketId: updatedTicket.ticketId,
        customerName: updatedTicket.customerName,
        customerPhone: updatedTicket.customerPhone,
        eventTitle: updatedTicket.event?.title,
        venue: updatedTicket.event?.venue,
        ticketType: updatedTicket.ticketType?.name,
        sector: updatedTicket.sector,
        usedAt: updatedTicket.usedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  validateTicket,
};
