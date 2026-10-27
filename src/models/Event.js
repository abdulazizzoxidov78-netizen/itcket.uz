const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    poster: {
      type: String,
      default: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200',
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      default: 'Toshkent',
      index: true,
    },
    venue: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    mapUrl: {
      type: String,
      trim: true,
      default: '',
    },
    startAt: {
      type: Date,
      required: true,
      index: true,
    },
    endAt: {
      type: Date,
    },
    timezone: {
      type: String,
      default: 'Asia/Tashkent',
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    organizerName: {
      type: String,
      default: 'Elite Tickets Team',
    },
    ageRestriction: {
      type: String,
      default: '0+',
    },
    rules: {
      type: String,
      default: "Tadbir boshlanishidan 30 daqiqa oldin yetib kelish tavsiya etiladi. Chipta QR-kodini begonalarga bermang.",
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'sold_out', 'cancelled', 'completed'],
      default: 'published',
      index: true,
    },
    isPopular: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

eventSchema.index({ title: 'text', description: 'text', venue: 'text', city: 'text' });

const Event = mongoose.model('Event', eventSchema);
module.exports = Event;
