const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 daqiqa
  max: 300, // IP boshiga 300 ta so'rov
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Juda ko\'p so\'rov yuborildi. Iltimos 15 daqiqadan so\'ng qayta urinib ko\'ring.',
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 login urinishi
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Juda ko\'p urinish. Iltimos 15 daqiqadan keyin qayta kiring.',
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
};
