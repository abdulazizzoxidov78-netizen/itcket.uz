const { Event, TicketType, Category, Order, Payment, Ticket, User, AuditLog } = require('../models');
const logger = require('../utils/logger');

/**
 * Overview KPIs and Sales Statistics
 */
async function getDashboardStats(req, res, next) {
  try {
    const [
      totalEvents,
      activeEvents,
      totalOrders,
      paidOrdersCount,
      revenueResult,
      totalTicketsSold,
      totalTicketsCount,
      totalUsersCount,
    ] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ status: 'published' }),
      Order.countDocuments(),
      Order.countDocuments({ paymentStatus: 'paid' }),
      Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Ticket.countDocuments({ status: { $in: ['active', 'used'] } }),
      TicketType.aggregate([
        { $group: { _id: null, totalQty: { $sum: '$totalQuantity' }, soldQty: { $sum: '$soldQuantity' } } },
      ]),
      User.countDocuments(),
    ]);

    const totalRevenue = revenueResult[0]?.total || 0;
    const ticketStats = totalTicketsCount[0] || { totalQty: 0, soldQty: 0 };

    // Recent 5 orders
    const recentOrders = await Order.find()
      .populate('user', 'firstName lastName username phone')
      .sort({ createdAt: -1 })
      .limit(5);

    // Top selling events
    const topEvents = await Event.find({ status: 'published' })
      .sort({ isPopular: -1, createdAt: -1 })
      .limit(4);

    res.json({
      success: true,
      stats: {
        totalRevenue,
        totalEvents,
        activeEvents,
        totalOrders,
        paidOrdersCount,
        totalTicketsSold,
        totalCapacity: ticketStats.totalQty,
        availableCapacity: Math.max(0, ticketStats.totalQty - ticketStats.soldQty),
        totalUsers: totalUsersCount,
      },
      recentOrders,
      topEvents,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Events Management
 */
async function adminGetEvents(req, res, next) {
  try {
    const events = await Event.find()
      .populate('category organizer', 'name slug firstName lastName')
      .sort({ createdAt: -1 });

    res.json({ success: true, events });
  } catch (error) {
    next(error);
  }
}

async function adminCreateEvent(req, res, next) {
  try {
    const {
      title,
      slug,
      description,
      poster,
      category,
      city,
      venue,
      address,
      mapUrl,
      startAt,
      endAt,
      ageRestriction,
      rules,
      status,
      isPopular,
    } = req.body;

    const eventSlug = slug || title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');

    const event = await Event.create({
      title,
      slug: eventSlug,
      description,
      poster: poster || 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200',
      category,
      city: city || 'Toshkent',
      venue,
      address,
      mapUrl: mapUrl || '',
      startAt: new Date(startAt),
      endAt: endAt ? new Date(endAt) : undefined,
      organizer: req.user._id,
      organizerName: req.user.organizationName || `${req.user.firstName} ${req.user.lastName || ''}`.trim() || 'Elite Tickets',
      ageRestriction: ageRestriction || '0+',
      rules: rules || 'Tadbirga kechikmasdan kelish tavsiya etiladi.',
      status: status || 'published',
      isPopular: !!isPopular,
    });

    res.status(201).json({ success: true, event });
  } catch (error) {
    next(error);
  }
}

async function adminUpdateEvent(req, res, next) {
  try {
    const { id } = req.params;
    const event = await Event.findByIdAndUpdate(id, req.body, { new: true });
    if (!event) return res.status(404).json({ success: false, message: 'Tadbir topilmadi' });
    res.json({ success: true, event });
  } catch (error) {
    next(error);
  }
}

async function adminDeleteEvent(req, res, next) {
  try {
    const { id } = req.params;
    const soldTickets = await Ticket.countDocuments({ event: id, status: { $in: ['active', 'used'] } });
    if (soldTickets > 0) {
      return res.status(400).json({
        success: false,
        message: `Ushbu tadbir uchun ${soldTickets} ta chipta sotilgan! O'chirish mumkin emas. Statusini "cancelled" yoki "completed" ga o'tkazing.`,
      });
    }

    await Event.findByIdAndDelete(id);
    await TicketType.deleteMany({ event: id });
    res.json({ success: true, message: 'Tadbir muvaffaqiyatli o\'chirildi.' });
  } catch (error) {
    next(error);
  }
}

/**
 * Ticket Types Management
 */
async function adminCreateTicketType(req, res, next) {
  try {
    const { eventId, name, price, totalQuantity, sector, description } = req.body;
    const ticketType = await TicketType.create({
      event: eventId,
      name,
      price: Number(price),
      totalQuantity: Number(totalQuantity),
      sector: sector || 'Erkin joylashuv',
      description: description || '',
      isActive: true,
    });

    res.status(201).json({ success: true, ticketType });
  } catch (error) {
    next(error);
  }
}

async function adminUpdateTicketType(req, res, next) {
  try {
    const { id } = req.params;
    const ticketType = await TicketType.findByIdAndUpdate(id, req.body, { new: true });
    if (!ticketType) return res.status(404).json({ success: false, message: 'Chipta turi topilmadi' });
    res.json({ success: true, ticketType });
  } catch (error) {
    next(error);
  }
}

/**
 * Orders & Payments
 */
async function adminGetOrders(req, res, next) {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.paymentStatus = status;
    if (search) {
      query.$or = [
        { orderNumber: new RegExp(search.trim(), 'i') },
        { 'customerInfo.phone': new RegExp(search.trim(), 'i') },
        { 'customerInfo.fullName': new RegExp(search.trim(), 'i') },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('user', 'firstName lastName username phone')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Order.countDocuments(query),
    ]);

    res.json({ success: true, orders, total, page: pageNum });
  } catch (error) {
    next(error);
  }
}

async function adminGetPayments(req, res, next) {
  try {
    const payments = await Payment.find()
      .populate('order user')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, payments });
  } catch (error) {
    next(error);
  }
}

async function adminGetTickets(req, res, next) {
  try {
    const { eventId, status } = req.query;
    const query = {};
    if (eventId) query.event = eventId;
    if (status) query.status = status;

    const tickets = await Ticket.find(query)
      .populate('event ticketType order owner', 'title venue name price orderNumber firstName lastName phone')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, tickets });
  } catch (error) {
    next(error);
  }
}

async function adminGetUsers(req, res, next) {
  try {
    const users = await User.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, users: users.map((u) => u.toSafeJSON()) });
  } catch (error) {
    next(error);
  }
}

async function adminUpdateUserRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role, status } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });

    if (role) user.role = role;
    if (status) user.status = status;
    await user.save();

    res.json({ success: true, user: user.toSafeJSON() });
  } catch (error) {
    next(error);
  }
}

/**
 * Export Sales Report to CSV
 */
async function adminExportReportsCSV(req, res, next) {
  try {
    const orders = await Order.find({ paymentStatus: 'paid' }).sort({ createdAt: -1 });

    let csv = 'Buyurtma raqami,Mijoz,Telefon,Summa (UZS),Holati,Sana\n';
    orders.forEach((o) => {
      const dateStr = o.createdAt.toISOString().slice(0, 10);
      const name = (o.customerInfo.fullName || '').replace(/,/g, ' ');
      csv += `"${o.orderNumber}","${name}","${o.customerInfo.phone || ''}",${o.total},"${o.paymentStatus}","${dateStr}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="hisobot_sotuvlar.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboardStats,
  adminGetEvents,
  adminCreateEvent,
  adminUpdateEvent,
  adminDeleteEvent,
  adminCreateTicketType,
  adminUpdateTicketType,
  adminGetOrders,
  adminGetPayments,
  adminGetTickets,
  adminGetUsers,
  adminUpdateUserRole,
  adminExportReportsCSV,
};
