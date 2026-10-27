const crypto = require('crypto');

/**
 * Generate a random unguessable token
 */
function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate a clean Order Number like: ORD-20261026-A8F3
 */
function generateOrderNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `ORD-${dateStr}-${randomSuffix}`;
}

/**
 * Generate a clean Ticket ID like: TKT-20261026-X9K2
 */
function generateTicketId() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TKT-${dateStr}-${randomSuffix}`;
}

/**
 * Hash a token using SHA-256
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  generateSecureToken,
  generateOrderNumber,
  generateTicketId,
  hashToken,
};
