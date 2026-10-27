const config = require('../config');
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(`API Error on ${req.method} ${req.originalUrl}:`, err);

  let statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message || 'Serverda ichki xatolik yuz berdi.';

  // Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Noto'g'ri identifikator formati: ${err.value}`;
  }

  // Mongoose ValidationError
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors).map((e) => e.message);
    message = `Ma'lumotlar to'g'ri kiritilmadi: ${errors.join(', ')}`;
  }

  // Duplicate Key error (11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'qiymat';
    message = `Bunday ${field} bilan ma'lumot allaqachon mavjud.`;
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(config.isDev ? { stack: err.stack } : {}),
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Sahifa yoki endpoint topilmadi: ${req.method} ${req.originalUrl}`,
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
