const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/database');
const { User, Category, Event, TicketType, Order, Ticket } = require('../src/models');
const { completePayment } = require('../src/services/paymentService');
const { generateOrderNumber } = require('../src/utils/token');

describe('Buyurtma va To\'lov Testlari', () => {
  let user, testEvent, ticketType, order;

  before(async () => {
    await connectDB();

    user = await User.create({
      firstName: 'OrderTester',
      email: `order_tester_${Date.now()}@test.com`,
      phone: '+998901112233',
      telegramId: 888801,
      role: 'customer',
    });

    let cat = await Category.findOne();
    if (!cat) cat = await Category.create({ name: 'OrderCat', slug: 'order-cat' });

    testEvent = await Event.create({
      title: 'Order Event ' + Date.now(),
      slug: 'order-event-' + Date.now(),
      description: 'Order event description',
      category: cat._id,
      city: 'Toshkent',
      venue: 'Humo Arena',
      address: 'Afrosiyob',
      startAt: new Date(Date.now() + 86400000),
    });

    ticketType = await TicketType.create({
      event: testEvent._id,
      name: 'Fan Zone',
      price: 250000,
      totalQuantity: 100,
      soldQuantity: 0,
      reservedQuantity: 2,
    });

    order = await Order.create({
      orderNumber: generateOrderNumber(),
      user: user._id,
      customerInfo: {
        fullName: 'OrderTester',
        phone: '+998901112233',
        telegramId: 888801,
      },
      items: [{
        event: testEvent._id,
        ticketType: ticketType._id,
        eventTitle: testEvent.title,
        ticketTypeName: ticketType.name,
        quantity: 2,
        unitPrice: 250000,
        subtotal: 500000,
      }],
      subtotal: 500000,
      total: 500000,
      currency: 'UZS',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      expiresAt: new Date(Date.now() + 900000),
    });
  });

  after(async () => {
    if (order) {
      await Ticket.deleteMany({ order: order._id });
      await Order.findByIdAndDelete(order._id);
    }
    if (user) await User.findByIdAndDelete(user._id);
    if (testEvent) await Event.findByIdAndDelete(testEvent._id);
    if (ticketType) await TicketType.findByIdAndDelete(ticketType._id);
    await disconnectDB();
  });

  test('1. Yangi buyurtma "pending" holatida bo\'ladi va chipta chiqarilmaydi', async () => {
    const tickets = await Ticket.find({ order: order._id });
    assert.equal(tickets.length, 0);
    assert.equal(order.paymentStatus, 'pending');
  });

  test('2. To\'lov tasdiqlangandan so\'ng chiptalar avtomatik chiqariladi', async () => {
    const result = await completePayment(order._id, 'TEST-TRANS-123', { provider: 'test' });
    assert.equal(result.order.paymentStatus, 'paid');
    assert.equal(result.order.orderStatus, 'confirmed');
    assert.equal(result.tickets.length, 2);

    // Each ticket must have a unique unguessable qrToken and ticketId
    assert.notEqual(result.tickets[0].ticketId, result.tickets[1].ticketId);
    assert.notEqual(result.tickets[0].qrToken, result.tickets[1].qrToken);
    assert.equal(result.tickets[0].status, 'active');
  });

  test('3. Takroriy to\'lov so\'rovi (Idempotency) dublikat chipta yaratmaydi', async () => {
    const result2 = await completePayment(order._id, 'DUPLICATE-HOOK-123', {});
    assert.equal(result2.alreadyPaid, true);

    const totalTicketsInDb = await Ticket.countDocuments({ order: order._id });
    assert.equal(totalTicketsInDb, 2); // Still exactly 2 tickets!
  });
});
