const { Event, TicketType, Category } = require('../models');

/**
 * Get Public Published Events with Filtering and Pagination
 */
async function getEvents(req, res, next) {
  try {
    const { category, city, search, popular, page = 1, limit = 10 } = req.query;
    const query = { status: 'published' };

    if (category) query.category = category;
    if (city) query.city = new RegExp(city, 'i');
    if (popular === 'true') query.isPopular = true;

    if (search) {
      const reg = new RegExp(search.trim(), 'i');
      query.$or = [{ title: reg }, { description: reg }, { venue: reg }, { city: reg }];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const [events, total] = await Promise.all([
      Event.find(query)
        .populate('category', 'name slug icon')
        .sort({ isPopular: -1, startAt: 1 })
        .skip(skip)
        .limit(limitNum),
      Event.countDocuments(query),
    ]);

    res.json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      events,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Single Event details with Ticket Types
 */
async function getEventById(req, res, next) {
  try {
    const { id } = req.params;
    const event = await Event.findById(id).populate('category organizer', 'name slug icon firstName lastName organizationName');
    if (!event) {
      return res.status(404).json({ success: false, message: 'Tadbir topilmadi' });
    }

    const ticketTypes = await TicketType.find({ event: event._id, isActive: true }).sort({ price: 1 });

    res.json({
      success: true,
      event,
      ticketTypes,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Categories
 */
async function getCategories(req, res, next) {
  try {
    const categories = await Category.find({ isActive: true }).sort({ order: 1 });
    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getEvents,
  getEventById,
  getCategories,
};
