const { createCanvas, loadImage } = require('@napi-rs/canvas');
const PDFDocument = require('pdfkit');
const { generateQRBuffer, generateQRDataURL } = require('./qrService');
const { formatMoney, formatDate } = require('../utils/formatters');
const config = require('../config');

/**
 * Render High-Resolution Ticket Image (PNG Buffer)
 */
async function renderTicketImage(ticket, event, order) {
  const width = 900;
  const height = 480;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background - Deep Graphite
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, width, height);

  // Luxury Card Container
  ctx.fillStyle = '#1E293B';
  roundRect(ctx, 20, 20, width - 40, height - 40, 16);
  ctx.fill();

  // Gold accent border
  ctx.strokeStyle = '#EAB308';
  ctx.lineWidth = 2;
  roundRect(ctx, 20, 20, width - 40, height - 40, 16);
  ctx.stroke();

  // Try to load event poster on the left side
  const stubX = 600;
  let posterLoaded = false;
  if (event && event.poster) {
    try {
      const img = await loadImage(event.poster);
      ctx.save();
      roundRect(ctx, 25, 25, stubX - 35, 140, 12);
      ctx.clip();
      ctx.drawImage(img, 25, 25, stubX - 35, 140);
      // Dark gradient overlay on poster
      const grad = ctx.createLinearGradient(0, 25, 0, 165);
      grad.addColorStop(0, 'rgba(15, 23, 42, 0.2)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0.9)');
      ctx.fillStyle = grad;
      ctx.fillRect(25, 25, stubX - 35, 140);
      ctx.restore();
      posterLoaded = true;
    } catch (e) {
      // Fallback banner
    }
  }

  if (!posterLoaded) {
    const bannerGrad = ctx.createLinearGradient(25, 25, stubX - 10, 165);
    bannerGrad.addColorStop(0, '#1E1B4B');
    bannerGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = bannerGrad;
    roundRect(ctx, 25, 25, stubX - 35, 140, 12);
    ctx.fill();
  }

  // Brand Name Badge
  ctx.fillStyle = '#EAB308';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(config.appName.toUpperCase(), 45, 55);

  // Event Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px sans-serif';
  const eventTitle = (event && event.title) ? (event.title.length > 32 ? event.title.slice(0, 32) + '...' : event.title) : 'Tadbir';
  ctx.fillText(eventTitle, 45, 95);

  // Category & City badge
  const catName = event && event.category && event.category.name ? event.category.name : 'Madaniyat';
  const city = event && event.city ? event.city : 'Toshkent';
  ctx.fillStyle = '#38BDF8';
  ctx.font = '600 14px sans-serif';
  ctx.fillText(`📍 ${city}  •  ${catName}`, 45, 125);

  // Perforated Divider Line between Ticket Body and Stub
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(stubX, 20);
  ctx.lineTo(stubX, height - 20);
  ctx.stroke();
  ctx.setLineDash([]); // Reset dash

  // Top and bottom cutout notches
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(stubX, 20, 14, 0, Math.PI * 2);
  ctx.arc(stubX, height - 20, 14, 0, Math.PI * 2);
  ctx.fill();

  // LEFT CONTENT: Details Grid
  const detailsY = 200;

  // Row 1: Date & Time | Venue
  drawLabel(ctx, 'SANA VA VAQT', 45, detailsY);
  drawValue(ctx, formatDate(event ? event.startAt : new Date()), 45, detailsY + 24);

  drawLabel(ctx, 'MANZIL VA JOY', 320, detailsY);
  const venueText = (event && event.venue) ? (event.venue.length > 25 ? event.venue.slice(0, 25) + '...' : event.venue) : 'Bosh zal';
  drawValue(ctx, venueText, 320, detailsY + 24);

  // Row 2: Ticket Holder | Order Number
  drawLabel(ctx, 'CHIPTA EGASI', 45, detailsY + 70);
  const holder = ticket.customerName ? (ticket.customerName.length > 22 ? ticket.customerName.slice(0, 22) + '...' : ticket.customerName) : 'Mijoz';
  drawValue(ctx, holder, 45, detailsY + 94);

  drawLabel(ctx, 'BUYURTMA RAQAMI', 320, detailsY + 70);
  drawValue(ctx, order ? order.orderNumber : 'ORD-DIRECT', 320, detailsY + 94);

  // Row 3: Sektor / O'rindiq | Status
  drawLabel(ctx, 'SEKTOR / JOY', 45, detailsY + 140);
  drawValue(ctx, ticket.sector || 'Erkin joylashuv', 45, detailsY + 164);

  drawLabel(ctx, 'CHIPTA HOLATI', 320, detailsY + 140);
  const statusColor = ticket.status === 'active' ? '#22C55E' : '#EF4444';
  const statusText = ticket.status === 'active' ? '● FAOL (KIRISHGA TAYYOR)' : `● ${ticket.status.toUpperCase()}`;
  ctx.fillStyle = statusColor;
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(statusText, 320, detailsY + 164);

  // RIGHT STUB: QR Code & Ticket Specs
  const qrBoxX = stubX + 45;
  const qrBoxY = 50;

  // Ticket Type Badge on stub
  const typeName = ticket.ticketType && ticket.ticketType.name ? ticket.ticketType.name.toUpperCase() : 'STANDARD';
  ctx.fillStyle = '#EAB308';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(typeName, stubX + 140, 45);
  ctx.textAlign = 'left';

  // Draw QR Code
  try {
    const qrBuffer = await generateQRBuffer(ticket.qrToken, { width: 190 });
    const qrImage = await loadImage(qrBuffer);
    ctx.drawImage(qrImage, qrBoxX, qrBoxY, 190, 190);
  } catch (e) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(qrBoxX, qrBoxY, 190, 190);
    ctx.fillStyle = '#000000';
    ctx.font = '14px sans-serif';
    ctx.fillText('QR KOD', qrBoxX + 60, qrBoxY + 95);
  }

  // Ticket ID
  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(ticket.ticketId, stubX + 140, qrBoxY + 215);

  // Price box
  ctx.fillStyle = '#0F172A';
  roundRect(ctx, stubX + 25, qrBoxY + 235, 230, 50, 8);
  ctx.fill();
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#94A3B8';
  ctx.font = '11px sans-serif';
  ctx.fillText('TO\'LANGAN NARX', stubX + 140, qrBoxY + 253);

  ctx.fillStyle = '#EAB308';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(formatMoney(ticket.priceSnapshot), stubX + 140, qrBoxY + 274);

  // Security warning
  ctx.fillStyle = '#64748B';
  ctx.font = '10px sans-serif';
  ctx.fillText('Kirishda ushbu QR-kodni skanerga ko\'rsating', stubX + 140, qrBoxY + 315);
  ctx.fillText('Bir martalik ruxsatnoma', stubX + 140, qrBoxY + 330);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}

/**
 * Generate PDF Document Stream
 */
function renderTicketPDF(ticket, event, order) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  // Generate QR buffer synchronously or before
  generateQRBuffer(ticket.qrToken, { width: 160 }).then((qrBuf) => {
    // Header
    doc.rect(40, 40, 515, 60).fill('#0F172A');
    doc.fillColor('#EAB308').fontSize(18).text(config.appName, 60, 55, { align: 'left' });
    doc.fillColor('#94A3B8').fontSize(11).text('RASMIY ELEKTRON CHIPTA', 60, 78);

    // Event Info Card
    doc.rect(40, 110, 515, 140).fill('#1E293B');
    doc.fillColor('#FFFFFF').fontSize(20).text(event ? event.title : 'Tadbir', 60, 125, { width: 470 });
    doc.fillColor('#38BDF8').fontSize(12).text(`Sana: ${formatDate(event ? event.startAt : new Date())}`, 60, 160);
    doc.fillColor('#E2E8F0').fontSize(12).text(`Manzil: ${event ? event.venue : ''}, ${event ? event.city : ''}`, 60, 180);
    doc.fillColor('#94A3B8').fontSize(11).text(`Tashkilotchi: ${event ? event.organizerName : 'Elite Tickets'}`, 60, 205);

    // Details Grid & Stub
    doc.rect(40, 260, 320, 220).fill('#F8FAFC');
    doc.rect(360, 260, 195, 220).fill('#F1F5F9');

    // Left info
    doc.fillColor('#475569').fontSize(10).text('CHIPTA ID:', 60, 280);
    doc.fillColor('#0F172A').fontSize(14).text(ticket.ticketId, 60, 295);

    doc.fillColor('#475569').fontSize(10).text('BUYURTMA RAQAMI:', 60, 325);
    doc.fillColor('#0F172A').fontSize(13).text(order ? order.orderNumber : 'ORD-DIRECT', 60, 340);

    doc.fillColor('#475569').fontSize(10).text('CHIPTA EGASI:', 60, 370);
    doc.fillColor('#0F172A').fontSize(13).text(ticket.customerName || 'Mijoz', 60, 385);

    doc.fillColor('#475569').fontSize(10).text('CHIPTA TURI VA SEKTOR:', 60, 415);
    doc.fillColor('#0F172A').fontSize(13).text(`${ticket.ticketType?.name || 'Standard'} • ${ticket.sector || 'Erkin joy'}`, 60, 430);

    // Right stub with QR Code
    doc.image(qrBuf, 377, 275, { width: 160 });
    doc.fillColor('#0F172A').fontSize(14).text(formatMoney(ticket.priceSnapshot), 360, 445, { align: 'center', width: 195 });
    doc.fillColor('#16A34A').fontSize(10).text('● FAOL ELEKTRON CHIPTA', 360, 463, { align: 'center', width: 195 });

    // Rules & Terms
    doc.rect(40, 490, 515, 120).stroke('#CBD5E1');
    doc.fillColor('#334155').fontSize(10).text('TADBIR VA XAVFSIZLIK QOIDALARI:', 55, 505);
    doc.fillColor('#64748B').fontSize(9).text(
      '1. Ushbu chipta faqat bir kishi va bir martalik kirish uchun mo\'ljallangan.\n' +
      '2. QR-kodni begonalarga ko\'rsatmang yoki ijtimoiy tarmoqlarga joylamang.\n' +
      '3. Tadbirga kamida 30 daqiqa oldin shaxsni tasdiqlovchi hujjat bilan kelish tavsiya etiladi.\n' +
      '4. Chiptani skanerlashda telefon ekrani yorug\'ligi to\'liq ochilgan bo\'lishi lozim.\n' +
      '5. Savollar bo\'yicha qo\'llab-quvvatlash xizmatiga murojaat qiling.',
      55, 525, { width: 485, lineGap: 3 }
    );

    doc.end();
  }).catch((err) => {
    doc.text('QR kod yaratishda xatolik yuz berdi: ' + err.message);
    doc.end();
  });

  return doc;
}

/**
 * Render Complete Responsive Web Ticket HTML (Identical luxury styling)
 */
async function renderTicketHTML(ticket, event, order) {
  const qrDataUrl = await generateQRDataURL(ticket.qrToken, { width: 220 });
  const eventTitle = event ? event.title : 'Tadbir';
  const eventDate = formatDate(event ? event.startAt : new Date());
  const venue = event ? `${event.venue}, ${event.city}` : 'Toshkent';
  const typeName = ticket.ticketType?.name || 'Standard';
  const price = formatMoney(ticket.priceSnapshot);
  const statusBadge = ticket.status === 'active'
    ? '<span class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold">● FAOL CHIPTA</span>'
    : `<span class="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-full text-xs font-semibold">● ${ticket.status.toUpperCase()}</span>`;

  return `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${ticket.ticketId} - ${config.appName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #0B0F19; color: #F8FAFC; }
    .ticket-notch-top { position: absolute; right: 260px; top: -14px; width: 28px; height: 28px; background-color: #0B0F19; border-radius: 50%; z-index: 10; }
    .ticket-notch-bottom { position: absolute; right: 260px; bottom: -14px; width: 28px; height: 28px; background-color: #0B0F19; border-radius: 50%; z-index: 10; }
    @media (max-width: 768px) {
      .ticket-notch-top, .ticket-notch-bottom { display: none; }
    }
  </style>
</head>
<body class="min-h-screen flex flex-col items-center justify-center p-4">
  <div class="w-full max-w-3xl">
    <!-- Header Brand -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xl">
          🎫
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-wider text-amber-400">${config.appName}</h1>
          <p class="text-xs text-slate-400">Rasmiy elektron chipta tekshiruvi</p>
        </div>
      </div>
      <div>${statusBadge}</div>
    </div>

    <!-- Ticket Card -->
    <div class="relative bg-slate-900 border border-amber-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
      <div class="ticket-notch-top"></div>
      <div class="ticket-notch-bottom"></div>

      <!-- Left Body -->
      <div class="flex-1 p-6 md:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-dashed border-slate-700">
        <div>
          ${event && event.poster ? `<img src="${event.poster}" alt="Poster" class="w-full h-44 object-cover rounded-2xl mb-5 shadow-lg border border-slate-800" />` : ''}
          <div class="text-xs uppercase tracking-wider font-semibold text-sky-400 mb-1">${event?.category?.name || 'Tadbir'} • ${event?.city || 'Toshkent'}</div>
          <h2 class="text-2xl font-extrabold text-white mb-4 leading-tight">${eventTitle}</h2>

          <div class="grid grid-cols-2 gap-4 text-sm mt-4">
            <div>
              <div class="text-xs text-slate-400 uppercase tracking-wider font-medium">Sana va vaqt</div>
              <div class="text-white font-semibold mt-1">${eventDate}</div>
            </div>
            <div>
              <div class="text-xs text-slate-400 uppercase tracking-wider font-medium">Joy / Manzil</div>
              <div class="text-white font-semibold mt-1">${venue}</div>
            </div>
            <div>
              <div class="text-xs text-slate-400 uppercase tracking-wider font-medium">Chipta egasi</div>
              <div class="text-white font-semibold mt-1">${ticket.customerName || 'Mijoz'}</div>
            </div>
            <div>
              <div class="text-xs text-slate-400 uppercase tracking-wider font-medium">Buyurtma ID</div>
              <div class="text-slate-300 font-mono mt-1">${order?.orderNumber || 'ORD-DIRECT'}</div>
            </div>
          </div>
        </div>

        <div class="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Sektor: <strong class="text-slate-200">${ticket.sector || 'Erkin joylashuv'}</strong></span>
          <span>Chipta ID: <strong class="text-amber-400 font-mono">${ticket.ticketId}</strong></span>
        </div>
      </div>

      <!-- Right Stub -->
      <div class="w-full md:w-64 p-6 md:p-8 bg-slate-950 flex flex-col items-center justify-between text-center">
        <div>
          <div class="text-amber-400 font-bold tracking-widest text-lg uppercase">${typeName}</div>
          <div class="text-xs text-slate-400 mt-1 mb-4">Elektron kirish kodi</div>

          <!-- QR Code -->
          <div class="bg-white p-3 rounded-2xl shadow-xl inline-block">
            <img src="${qrDataUrl}" alt="Ticket QR" class="w-40 h-40 object-contain" />
          </div>
          <div class="text-xs font-mono text-slate-400 mt-2">${ticket.ticketId}</div>
        </div>

        <div class="w-full mt-6 bg-slate-900 border border-slate-800 p-3 rounded-xl">
          <div class="text-[10px] uppercase tracking-wider text-slate-400">To'langan narx</div>
          <div class="text-lg font-bold text-amber-400 mt-0.5">${price}</div>
        </div>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="flex flex-wrap gap-4 mt-6 justify-center">
      <a href="/api/tickets/${ticket._id}/pdf" class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-xl shadow-lg transition flex items-center space-x-2">
        <span>📄 PDF chiptani yuklab olish</span>
      </a>
      <a href="/api/tickets/${ticket._id}/image" target="_blank" class="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-6 py-3 rounded-xl transition flex items-center space-x-2 border border-slate-700">
        <span>🖼 Rasm sifatida ochish</span>
      </a>
      <button onclick="window.print()" class="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-6 py-3 rounded-xl transition border border-slate-700">
        🖨 Chop etish
      </button>
    </div>

    <div class="text-center text-xs text-slate-500 mt-6">
      © ${new Date().getFullYear()} ${config.appName}. Barcha huquqlar himoyalangan.
    </div>
  </div>
</body>
</html>`;
}

// Helper: draw rounded rectangles on Canvas
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawLabel(ctx, text, x, y) {
  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 11px sans-serif';
  ctx.fillText(text, x, y);
}

function drawValue(ctx, text, x, y) {
  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(text, x, y);
}

module.exports = {
  renderTicketImage,
  renderTicketPDF,
  renderTicketHTML,
};
