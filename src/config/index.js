require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  appName: process.env.APP_NAME || 'ELITE TICKETS',
  currency: process.env.CURRENCY || 'UZS',
  baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`,

  telegram: {
    botToken: process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN,
    botUsername: process.env.BOT_USERNAME || 'EliteTicketBot',
    adminId: process.env.ADMIN_ID ? String(process.env.ADMIN_ID) : null,
    contactText: process.env.CONTACT_TEXT || 'Savollar va yordam uchun: @support',
  },

  db: {
    uri: process.env.MONGO_URI || process.env.MONGODB_URI,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'elite_default_jwt_secret_dev_only',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  ticket: {
    signingSecret: process.env.TICKET_SIGNING_SECRET || 'elite_ticket_secret_key_2026',
    reservationExpiryMinutes: 15,
  },

  imagekit: {
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || '',
    folder: process.env.IMAGEKIT_FOLDER || '/tickets',
  },

  admin: {
    initialEmail: process.env.INITIAL_ADMIN_EMAIL || 'admin@elitetickets.uz',
    initialPassword: process.env.INITIAL_ADMIN_PASSWORD || 'AdminElite2026!',
    initialName: process.env.INITIAL_ADMIN_NAME || 'Platform Administrator',
  },

  payment: {
    mode: process.env.PAYMENT_MODE || 'test',
    click: {
      merchantId: process.env.CLICK_MERCHANT_ID || '',
      serviceId: process.env.CLICK_SERVICE_ID || '',
      secretKey: process.env.CLICK_SECRET_KEY || '',
    },
    payme: {
      merchantId: process.env.PAYME_MERCHANT_ID || '',
      secretKey: process.env.PAYME_SECRET_KEY || '',
    },
    uzum: {
      merchantId: process.env.UZUM_MERCHANT_ID || '',
      secretKey: process.env.UZUM_SECRET_KEY || '',
    },
  },
};

module.exports = config;
