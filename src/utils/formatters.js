const UZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
];

/**
 * Format currency amount into clean Uzbek format: 150 000 so'm
 */
function formatMoney(amount, currency = 'so\'m') {
  if (amount === undefined || amount === null || isNaN(amount)) return `0 ${currency}`;
  const formatted = Math.round(Number(amount))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} ${currency}`;
}

/**
 * Format Date into Uzbek readable format: "12-Noyabr, 2026, 19:00"
 */
function formatDate(dateInput) {
  if (!dateInput) return 'Noma\'lum sana';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Noma\'lum sana';

  const day = d.getDate();
  const month = UZ_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day}-${month}, ${year} ${hours}:${minutes}`;
}

/**
 * Format Short Date: "12-Noyabr, 19:00"
 */
function formatShortDate(dateInput) {
  if (!dateInput) return 'Noma\'lum sana';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Noma\'lum sana';

  const day = d.getDate();
  const month = UZ_MONTHS[d.getMonth()];
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day}-${month}, ${hours}:${minutes}`;
}

/**
 * Format order status in Uzbek
 */
function formatOrderStatus(status) {
  const map = {
    pending: '⏳ Kutilmoqda',
    awaiting_payment: '💳 To\'lov kutilmoqda',
    paid: '✅ To\'landi',
    confirmed: '✅ Tasdiqlandi',
    completed: '🎉 Yakunlandi',
    cancelled: '❌ Bekor qilingan',
    expired: '⏰ Muddati o\'tgan',
    refunded: '↩️ Qaytarilgan'
  };
  return map[status] || status;
}

/**
 * Format ticket status in Uzbek
 */
function formatTicketStatus(status) {
  const map = {
    active: '🟢 Faol (Amalda)',
    used: '🔴 Ishlatilgan',
    cancelled: '⚪ Bekor qilingan',
    refunded: '↩️ Qaytarilgan',
    expired: '⏰ Muddati o\'tgan'
  };
  return map[status] || status;
}

module.exports = {
  formatMoney,
  formatDate,
  formatShortDate,
  formatOrderStatus,
  formatTicketStatus,
};
