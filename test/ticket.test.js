const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/database');
const { User, Category, Event, TicketType, Order, Ticket } = require('../src/models');
const { renderTicketImage } = require('../src/services/ticketRenderer');
const { generateTicketId, generateSecureToken, generateOrderNumber } = require('../src/utils/token');

describe('Chipta Tekshiruvi (QR Validation) va Rendering Testlari', () => {
  let user, testEvent, ticketType, order, testTicket;

  before(async () => {
    await connectDB();

    user = await User.create({
      firstName: 'ScannerTester',
      email: `scanner_tester_${Date.now()}@test.com`,
      role: 'scanner',
    });

    let cat = await Category.findOne();
    if (!cat) cat = await Category.create({ name: 'ScanCat', slug: 'scan-cat' });

    testEvent = await Event.create({
      title: 'Scan Event ' + Date.now(),
      slug: 'scan-event-' + Date.now(),
      description: 'Scan event description',
      category: cat._id,
      city: 'Toshkent',
      venue: 'Humo Arena',
      address: 'Afrosiyob',
      startAt: new Date(Date.now() + 86400000),
    });

    ticketType = await TicketType.create({
      event: testEvent._id,
      name: 'VIP',
      price: 350000,
      totalQuantity: 10,
    });

    order = await Order.create({
      orderNumber: generateOrderNumber(),
      user: user._id,
      customerInfo: { fullName: 'Mehmonjon', phone: '+998909998877' },
      items: [{
        event: testEvent._id,
        ticketType: ticketType._id,
        eventTitle: testEvent.title,
        ticketTypeName: ticketType.name,
        quantity: 1,
        unitPrice: 350000,
        subtotal: 350000,
      }],
      subtotal: 350000,
      total: 350000,
      paymentStatus: 'paid',
      orderStatus: 'confirmed',
      expiresAt: new Date(Date.now() + 86400000),
    });

    testTicket = await Ticket.create({
      ticketId: generateTicketId(),
      order: order._id,
      event: testEvent._id,
      ticketType: ticketType._id,
      owner: user._id,
      customerName: 'Mehmonjon',
      customerPhone: '+998909998877',
      priceSnapshot: 350000,
      currency: 'UZS',
      qrToken: generateSecureToken(24),
      status: 'active',
      sector: 'VIP A',
    });
  });

  after(async () => {
    if (testTicket) await Ticket.findByIdAndDelete(testTicket._id);
    if (order) await Order.findByIdAndDelete(order._id);
    if (user) await User.findByIdAndDelete(user._id);
    if (testEvent) await Event.findByIdAndDelete(testEvent._id);
    if (ticketType) await TicketType.findByIdAndDelete(ticketType._id);
    await disconnectDB();
  });

  test('1. Chipta QR-kodini birinchi marta tekshirganda muvaffaqiyatli kirish beriladi', async () => {
    // Simulate scanner check
    const ticket = await Ticket.findOne({ qrToken: testTicket.qrToken });
    assert.ok(ticket);
    assert.equal(ticket.status, 'active');

    // Atomically mark used
    const updated = await Ticket.findOneAndUpdate(
      { _id: ticket._id, status: 'active' },
      { $set: { status: 'used', usedAt: new Date() } },
      { new: true }
    );

    assert.equal(updated.status, 'used');
    assert.ok(updated.usedAt instanceof Date);
  });

  test('2. Ishlatilgan chiptani ikkinchi marta tekshirganda rad etiladi', async () => {
    const ticket = await Ticket.findOne({ qrToken: testTicket.qrToken });
    assert.equal(ticket.status, 'used');

    // Attempt atomic update again - MUST return null because status is already used!
    const failedAttempt = await Ticket.findOneAndUpdate(
      { _id: ticket._id, status: 'active' },
      { $set: { status: 'used', usedAt: new Date() } }
    );

    assert.equal(failedAttempt, null);
  });

  test('3. Chipta tasviri (PNG Image Buffer) muvaffaqiyatli render qilinadi', async () => {
    const pngBuffer = await renderTicketImage(testTicket, testEvent, order);
    assert.ok(Buffer.isBuffer(pngBuffer));
    assert.ok(pngBuffer.length > 5000); // realistic high-res PNG image size
  });
});
