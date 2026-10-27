

const { Markup } = require('telegraf');
const config = require('../config');

/**
 * Asosiy menyu
 */
function getMainMenu() {
  return Markup.keyboard([
    ['🎫 Tadbirlar', '🔥 Ommabop tadbirlar'],
    ['🔎 Qidiruv', '🗂 Kategoriyalar'],
    ['🛒 Savatim', '❤️ Sevimlilar'],
    ['🎟 Chiptalarim', '📦 Buyurtmalarim'],
    ['👤 Profil', 'ℹ️ Yordam'],
  ]).resize();
}

/**
 * Tadbir kartasi tugmalari
 */
function getEventActionsKeyboard(eventId, isFavorite = false, mapUrl = null) {
  const favIcon = isFavorite
    ? '❤️ Sevimlilardan olish'
    : "🤍 Sevimlilarga qo'shish";

  const shareUrl =
    `https://t.me/${config.telegram.botUsername}?start=ev_${eventId}`;

  const rows = [
    [
      Markup.button.callback(
        '🎟 Chipta tanlash',
        `select_ticket:${eventId}`
      ),
      Markup.button.callback(
        "🛒 Savatga qo'shish",
        `quick_add:${eventId}`
      ),
    ],
    [
      Markup.button.callback(
        favIcon,
        `toggle_fav:${eventId}`
      ),
    ],
  ];

  const middleRow = [];

  if (mapUrl) {
    middleRow.push(
      Markup.button.url('📍 Xaritada ochish', mapUrl)
    );
  } else {
    middleRow.push(
      Markup.button.callback(
        "📍 Manzil ma'lumoti",
        `venue_info:${eventId}`
      )
    );
  }

  middleRow.push(
    Markup.button.url(
      '🔗 Ulashish',
      `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Ushbu ajoyib tadbirga chipta oling!')}`
    )
  );

  rows.push(middleRow);

  rows.push([
    Markup.button.callback(
      '⬅️ Tadbirlarga qaytish',
      'list_events:1'
    ),
    Markup.button.callback(
      '🏠 Asosiy menyu',
      'go_main_menu'
    ),
  ]);

  return Markup.inlineKeyboard(rows);
}

/**
 * Chipta turi va miqdorini tanlash
 */
function getTicketSelectionKeyboard(
  eventId,
  ticketTypes,
  selectedTypeId,
  quantity = 1
) {
  const rows = [];

  ticketTypes.forEach((tt) => {
    const isSelected =
      String(tt._id) === String(selectedTypeId);

    const prefix = isSelected ? '🔘 ' : '⚪ ';

    const available =
      tt.totalQuantity -
      (tt.soldQuantity || 0) -
      (tt.reservedQuantity || 0);

    const isAvailable = available > 0 && tt.isActive;

    const price = Number(tt.price || 0).toLocaleString('en-US');

    const label =
      `${prefix}${tt.name} — ${price} so'm ${
        isAvailable ? `(${available} ta)` : '(Tugagan)'
      }`;

    if (isAvailable) {
      rows.push([
        Markup.button.callback(
          label,
          `choose_tt:${eventId}:${tt._id}:${quantity}`
        ),
      ]);
    } else {
      rows.push([
        Markup.button.callback(
          `🚫 ${tt.name} — Tugagan`,
          'disabled_tt'
        ),
      ]);
    }
  });

  if (selectedTypeId) {
    rows.push([
      Markup.button.callback(
        '➖',
        `qty_dec:${eventId}:${selectedTypeId}:${quantity}`
      ),
      Markup.button.callback(
        `Soni: ${quantity} ta`,
        'noop'
      ),
      Markup.button.callback(
        '➕',
        `qty_inc:${eventId}:${selectedTypeId}:${quantity}`
      ),
    ]);

    rows.push([
      Markup.button.callback(
        `🛒 Savatga qo'shish (${quantity} ta)`,
        `add:${eventId}:${selectedTypeId}:${quantity}`
      ),
    ]);
  }

  rows.push([
    Markup.button.callback(
      '⬅️ Tadbirga qaytish',
      `view_event:${eventId}`
    ),
    Markup.button.callback(
      '🛒 Savatni ko\'rish',
      'view_cart'
    ),
  ]);

  return Markup.inlineKeyboard(rows);
}

/**
 * Savat tugmalari
 */
function getCartKeyboard(cartItems = []) {
  const rows = [];

  cartItems.forEach((item, index) => {
    const eventId = item.event?._id || item.event;

    const title = item.event?.title
      ? (
          item.event.title.length > 18
            ? item.event.title.slice(0, 18) + '...'
            : item.event.title
        )
      : 'Tadbir';

    const type = item.ticketType?.name || 'Chipta';

    rows.push([
      Markup.button.callback(
        `${index + 1}. ${title} (${type})`,
        `view_event:${eventId}`
      ),
    ]);

    rows.push([
      Markup.button.callback(
        '➖',
        `cart_dec:${item._id}`
      ),
      Markup.button.callback(
        `${item.quantity} dona`,
        'noop'
      ),
      Markup.button.callback(
        '➕',
        `cart_inc:${item._id}`
      ),
      Markup.button.callback(
        "🗑 O'chirish",
        `cart_remove:${item._id}`
      ),
    ]);
  });

  if (cartItems.length > 0) {
    rows.push([
      Markup.button.callback(
        '💳 Buyurtmani rasmiylashtirish',
        'checkout_start'
      ),
    ]);

    rows.push([
      Markup.button.callback(
        '🎫 Xaridni davom ettirish',
        'list_events:1'
      ),
      Markup.button.callback(
        '🗑 Savatni tozalash',
        'cart_clear'
      ),
    ]);
  } else {
    rows.push([
      Markup.button.callback(
        "🎫 Tadbirlarni ko'rish",
        'list_events:1'
      ),
    ]);
  }

  rows.push([
    Markup.button.callback(
      '🏠 Asosiy menyu',
      'go_main_menu'
    ),
  ]);

  return Markup.inlineKeyboard(rows);
}

/**
 * To'lov usulini tanlash
 */
function getPaymentSelectionKeyboard(orderId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "🔹 Click orqali to'lash",
        `pay_order:${orderId}:click`
      ),
      Markup.button.callback(
        "🔸 Payme orqali to'lash",
        `pay_order:${orderId}:payme`
      ),
    ],
    [
      Markup.button.callback(
        '🟣 Uzum Bank orqali',
        `pay_order:${orderId}:uzum`
      ),
      Markup.button.callback(
        "🧪 Test to'lov (Tezkor)",
        `pay_order:${orderId}:test`
      ),
    ],
    [
      Markup.button.callback(
        '❌ Buyurtmani bekor qilish',
        `cancel_order:${orderId}`
      ),
      Markup.button.callback(
        '🛒 Savatga qaytish',
        'view_cart'
      ),
    ],
  ]);
}

/**
 * Xarid qilingan chipta tugmalari
 * Hozircha localhost URL ishlatilmaydi.
 */
function getTicketActionsKeyboard(ticketId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '📄 PDF chipta yuklash',
        `download_pdf:${ticketId}`
      ),
    ],
    [
      Markup.button.callback(
        '🎟 Barcha chiptalarim',
        'my_tickets:1'
      ),
      Markup.button.callback(
        '🏠 Asosiy menyu',
        'go_main_menu'
      ),
    ],
  ]);
}

module.exports = {
  getMainMenu,
  getEventActionsKeyboard,
  getTicketSelectionKeyboard,
  getCartKeyboard,
  getPaymentSelectionKeyboard,
  getTicketActionsKeyboard,
};
