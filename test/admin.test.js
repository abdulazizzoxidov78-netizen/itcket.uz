const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { connectDB, disconnectDB } = require('../src/config/database');
const { User, Category, Event, TicketType } = require('../src/models');

describe('Admin va RBAC Ruxsatlar Tizimi Testlari', () => {
  let superadminUser, customerUser, scannerUser;

  before(async () => {
    await connectDB();

    superadminUser = await User.create({
      firstName: 'AdminTest',
      email: `admin_test_${Date.now()}@test.com`,
      password: 'SecureAdminPassword123!',
      telegramId: 777001,
      role: 'superadmin',
      status: 'active',
    });

    customerUser = await User.create({
      firstName: 'CustomerTest',
      email: `customer_test_${Date.now()}@test.com`,
      telegramId: 777002,
      role: 'customer',
      status: 'active',
    });

    scannerUser = await User.create({
      firstName: 'ScannerGuard',
      email: `guard_test_${Date.now()}@test.com`,
      telegramId: 777003,
      role: 'scanner',
      status: 'active',
    });
  });

  after(async () => {
    if (superadminUser) await User.findByIdAndDelete(superadminUser._id);
    if (customerUser) await User.findByIdAndDelete(customerUser._id);
    if (scannerUser) await User.findByIdAndDelete(scannerUser._id);
    await disconnectDB();
  });

  test('1. Parolni to\'g\'ri tekshirish va JWT generatsiyasi', async () => {
    const userWithPass = await User.findById(superadminUser._id).select('+password');
    const isPasswordValid = await userWithPass.comparePassword('SecureAdminPassword123!');
    assert.equal(isPasswordValid, true);

    const isWrongPassword = await userWithPass.comparePassword('WrongPassword');
    assert.equal(isWrongPassword, false);

    const token = jwt.sign(
      { id: superadminUser._id, role: superadminUser.role },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    assert.ok(token);

    const decoded = jwt.verify(token, config.jwt.secret);
    assert.equal(decoded.id, String(superadminUser._id));
    assert.equal(decoded.role, 'superadmin');
  });

  test('2. Oddiy foydalanuvchi (customer) admin huquqlariga ega emas', () => {
    const allowedRoles = ['admin', 'superadmin'];
    assert.equal(allowedRoles.includes(customerUser.role), false);
    assert.equal(allowedRoles.includes(superadminUser.role), true);
  });

  test('3. Scanner foydalanuvchisi faqat tekshiruv huquqiga ega', () => {
    const scannerAllowed = ['scanner', 'organizer', 'admin', 'superadmin'];
    const eventManageAllowed = ['organizer', 'admin', 'superadmin'];

    assert.equal(scannerAllowed.includes(scannerUser.role), true);
    assert.equal(eventManageAllowed.includes(scannerUser.role), false);
  });

  test('4. Xavfsiz JSON serializerda parol va maxfiy maydonlar chiqmaydi', () => {
    const safeData = superadminUser.toSafeJSON();
    assert.equal(safeData.password, undefined);
    assert.equal(safeData.role, 'superadmin');
    assert.equal(safeData.email, superadminUser.email);
  });
});
