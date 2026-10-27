const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    ticketType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TicketType',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerPhone: {
      type: String,
      required: true,
    },
    priceSnapshot: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'UZS',
    },
    qrToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'used', 'cancelled', 'refunded', 'expired'],
      default: 'active',
      index: true,
    },
    sector: {
      type: String,
      default: 'Erkin joylashuv',
    },
    seat: {
      type: String,
      default: '',
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    usedAt: {
      type: Date,
    },
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    ticketImageUrl: {
      type: String,
      default: '',
    },
    pdfUrl: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const Ticket = mongoose.model('Ticket', ticketSchema);
module.exports = Ticket;
