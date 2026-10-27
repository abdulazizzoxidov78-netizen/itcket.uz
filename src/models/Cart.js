const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    ticketType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TicketType',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    priceSnapshot: {
      type: Number,
      required: true,
      min: 0,
    },
    sector: {
      type: String,
      default: '',
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    items: [cartItemSchema],
    status: {
      type: String,
      enum: ['active', 'checked_out'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Method to calculate total sum of items in cart
cartSchema.methods.calculateTotals = function () {
  const itemCount = this.items.reduce((acc, item) => acc + item.quantity, 0);
  const totalAmount = this.items.reduce((acc, item) => acc + (item.quantity * item.priceSnapshot), 0);
  return {
    itemCount,
    totalAmount,
  };
};

const Cart = mongoose.model('Cart', cartSchema);
module.exports = Cart;
