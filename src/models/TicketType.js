const mongoose = require('mongoose');

const ticketTypeSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'UZS',
    },
    totalQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    soldQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    salesStartAt: {
      type: Date,
    },
    salesEndAt: {
      type: Date,
    },
    sector: {
      type: String,
      default: 'Erkin joylashuv',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for available seats
ticketTypeSchema.virtual('availableQuantity').get(function () {
  const available = this.totalQuantity - (this.soldQuantity || 0) - (this.reservedQuantity || 0);
  return Math.max(0, available);
});

const TicketType = mongoose.model('TicketType', ticketTypeSchema);
module.exports = TicketType;
