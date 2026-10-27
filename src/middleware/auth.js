const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Avtorizatsiya talab qilinadi. Token topilmadi.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    const user = await User.findById(decoded.id);
    if (!user || user.status === 'blocked') {
      return res.status(401).json({
        success: false,
        message: 'Foydalanuvchi mavjud emas yoki bloklangan.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Yaroqsiz yoki muddati o\'tgan token.',
    });
  }
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Avtorizatsiya talab qilinadi.',
      });
    }

    if (req.user.role === 'superadmin') {
      return next(); // superadmin has full access to everything
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Ushbu amalni bajarish uchun sizda yetarli ruxsat yo\'q.',
      });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};
