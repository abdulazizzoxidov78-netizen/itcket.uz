const jwt = require('jsonwebtoken');
const { User, AuditLog } = require('../models');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Admin / Staff Login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email va parol kiritilishi shart.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email yoki parol noto\'g\'ri.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email yoki parol noto\'g\'ri.' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ success: false, message: 'Ushbu profil bloklangan.' });
    }

    if (!['superadmin', 'admin', 'organizer', 'scanner'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Admin panelga kirish huquqingiz yo\'q.' });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    // Audit log
    await AuditLog.create({
      actor: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'ADMIN_LOGIN',
      entityType: 'User',
      entityId: String(user._id),
      ipAddress: req.ip || '',
    }).catch(() => {});

    res.json({
      success: true,
      token,
      user: user.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Current Authenticated User Profile
 */
async function getMe(req, res, next) {
  try {
    res.json({
      success: true,
      user: req.user.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  getMe,
};
