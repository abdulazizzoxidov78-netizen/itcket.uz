const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/database');
const { Event, TicketType, Category } = require('../src/models');
const { reserveTickets, releaseReservedTickets } = require('../src/services/inventoryService');

describe('Inventar va Bir Vaqtda Sotib Olish (Concurrency) Testlari', () => {
  let testEvent, limitedTicketType;

  before(async () => {
    await connectDB();

    let cat = await Category.findOne();
    if (!cat) cat = await Category.create({ name: 'TestCat2', slug: 'test-cat-2' });

    testEvent = await Event.create({
      title: 'Limited Event ' + Date.now(),
      slug: 'limited-event-' + Date.now(),
      description: 'Limited seats event',
      category: cat._id,
      city: 'Toshkent',
      venue: 'Limited Arena',
      address: 'Afrosiyob',
      startAt: new Date(Date.now() + 86400000),
    });

    // Create a ticket type with EXACTLY 2 available seats!
    limitedTicketType = await TicketType.create({
      event: testEvent._id,
      name: 'Super Rare Front Row',
      price: 500000,
      totalQuantity: 2,
      soldQuantity: 0,
      reservedQuantity: 0,
      isActive: true,
    });
  });

  after(async () => {
    if (testEvent) await Event.findByIdAndDelete(testEvent._id);
    if (limitedTicketType) await TicketType.findByIdAndDelete(limitedTicketType._id);
    await disconnectDB();
  });

  test('1. Mavjud miqdor doirasida band qilish muvaffaqiyatli o\'tadi', async () => {
    const res = await reserveTickets([{ ticketType: limitedTicketType._id, quantity: 2 }]);
    assert.equal(res.success, true);

    const updated = await TicketType.findById(limitedTicketType._id);
    assert.equal(updated.reservedQuantity, 2);
    assert.equal(updated.availableQuantity, 0);
  });

  test('2. Chiptalar tugaganidan keyin ortiqcha xarid urinishi rad etiladi', async () => {
    await assert.rejects(
      async () => {
        await reserveTickets([{ ticketType: limitedTicketType._id, quantity: 1 }]);
      },
      /yetarli emas/
    );

    // Quantity should still be 2, not overbooked
    const updated = await TicketType.findById(limitedTicketType._id);
    assert.equal(updated.reservedQuantity, 2);
  });

  test('3. Bekor qilinganda band qilingan chiptalar qayta bo\'shatiladi', async () => {
    await releaseReservedTickets([{ ticketType: limitedTicketType._id, quantity: 2 }]);

    const updated = await TicketType.findById(limitedTicketType._id);
    assert.equal(updated.reservedQuantity, 0);
    assert.equal(updated.availableQuantity, 2);
  });
});
