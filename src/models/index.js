const User = require('./User');
const Category = require('./Category');
const Event = require('./Event');
const TicketType = require('./TicketType');
const Cart = require('./Cart');
const Order = require('./Order');
const Payment = require('./Payment');
const Ticket = require('./Ticket');
const Favorite = require('./Favorite');
const AuditLog = require('./AuditLog');
const { connectDB, disconnectDB } = require('../config/database');

module.exports = {
  User,
  Category,
  Event,
  TicketType,
  Cart,
  Order,
  Payment,
  Ticket,
  Favorite,
  AuditLog,
  connect: connectDB,
  disconnect: disconnectDB,
};
