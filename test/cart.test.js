const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/database');
const { User, Category, Event, TicketType, Cart } = require('../src/models');

describe('Savat (Cart) Tizimi Testlari', () => {
  let user1, user2, testEvent, testTicketType;

  before(async () => {
    await connectDB();

    // Clean test data
    await User.deleteMany({ email: /test_cart_/ });
    await Event.deleteMany({ title: /Test Cart Event/ });

    user1 = await User.create({
      firstName: 'CartUser1',
      email: `test_cart_u1_${Date.now()}@test.com`,
      telegramId: 999901,
      role: 'customer',
    });

    user2 = await User.create({
      firstName: 'CartUser2',
      email: `test_cart_u2_${Date.now()}@test.com`,
      telegramId: 999902,
      role: 'customer',
    });

    let cat = await Category.findOne();
    if (!cat) {
      cat = await Category.create({ name: 'TestCat', slug: 'test-cat' });
    }

    testEvent = await Event.create({
      title: 'Test Cart Event ' + Date.now(),
      slug: 'test-cart-event-' + Date.now(),
      description: 'Test description',
      category: cat._id,
      city: 'Toshkent',
      venue: 'Test Arena',
      address: 'Test ko\'chasi',
      startAt: new Date(Date.now() + 86400000),
    });

    testTicketType = await TicketType.create({
      event: testEvent._id,
      name: 'Standard VIP',
      price: 200000,
      totalQuantity: 50,
      sector: 'Sector A',
    });
  });

  after(async () => {
    if (user1) await Cart.deleteMany({ user: { $in: [user1._id, user2._id] } });
    if (user1) await User.deleteMany({ _id: { $in: [user1._id, user2._id] } });
    if (testEvent) await Event.findByIdAndDelete(testEvent._id);
    if (testTicketType) await TicketType.findByIdAndDelete(testTicketType._id);
    await disconnectDB();
  });

  test('1. Chiptani savatga muvaffaqiyatli qo\'shish', async () => {
    const cart = await Cart.create({
      user: user1._id,
      items: [{
        event: testEvent._id,
        ticketType: testTicketType._id,
        quantity: 2,
        priceSnapshot: testTicketType.price,
      }],
    });

    assert.equal(cart.items.length, 1);
    assert.equal(cart.items[0].quantity, 2);
    assert.equal(cart.items[0].priceSnapshot, 200000);

    const totals = cart.calculateTotals();
    assert.equal(totals.itemCount, 2);
    assert.equal(totals.totalAmount, 400000);
  });

  test('2. Bir xil chiptani qayta qo\'shganda miqdor oshishi', async () => {
    let cart = await Cart.findOne({ user: user1._id });
    const existingIndex = cart.items.findIndex(it => String(it.ticketType) === String(testTicketType._id));
    assert.ok(existingIndex > -1);

    cart.items[existingIndex].quantity += 1;
    await cart.save();

    cart = await Cart.findOne({ user: user1._id });
    assert.equal(cart.items[0].quantity, 3);
    const totals = cart.calculateTotals();
    assert.equal(totals.itemCount, 3);
    assert.equal(totals.totalAmount, 600000);
  });

  test('3. Ikki xil foydalanuvchi savati bir-biriga aralashmasligi', async () => {
    const cart2 = await Cart.create({
      user: user2._id,
      items: [{
        event: testEvent._id,
        ticketType: testTicketType._id,
        quantity: 1,
        priceSnapshot: testTicketType.price,
      }],
    });

    const user1Cart = await Cart.findOne({ user: user1._id });
    const user2Cart = await Cart.findOne({ user: user2._id });

    assert.equal(user1Cart.items[0].quantity, 3);
    assert.equal(user2Cart.items[0].quantity, 1);
    assert.notEqual(String(user1Cart._id), String(user2Cart._id));
  });

  test('4. Savatdagi chiptani o\'chirish va savatni tozalash', async () => {
    let cart = await Cart.findOne({ user: user1._id });
    cart.items = [];
    await cart.save();

    cart = await Cart.findOne({ user: user1._id });
    assert.equal(cart.items.length, 0);
    const totals = cart.calculateTotals();
    assert.equal(totals.itemCount, 0);
    assert.equal(totals.totalAmount, 0);
  });
});
