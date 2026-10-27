# 🎫 ELITE GLOBAL TICKETING PLATFORM

**Node.js • Express.js • Telegraf • MongoDB Atlas • Canvas • PDFKit • Tailwind CSS**

O'zbekistondagi konsertlar, teatr tomoshalari, stand-up shoular, festivallar, sport musobaqalari va ko'rgazmalar uchun mo'ljallangan professional, yuqori xavfsizlikka ega va real ishlaydigan **onlayn elektron chiptalar platformasi**.

Ushbu platforma mijozlarga **Telegram boti** orqali to'liq qulaylik bilan tadbirlarni ko'rish, afishasini ochish, chipta turini va miqdorini tanlash, shaxsiy savatga qo'shish, buyurtma berish, to'lovni amalga oshirish va **noyob QR-kodli elektron chiptani** olish imkonini beradi. Shuningdek, tadbir tashkilotchilari va nazoratchilar uchun **Admin Dashboard** hamda jonli kamera orqali ishlaydigan **QR Turniket Skaneri** mavjud.

---

## 🏛 1. TIZIMNING ASOSIY ARXITEKTURASI

Platforma 8 ta o'zaro integratsiyalashgan arxitektura qismidan tashkil topgan:

```
                  ┌───────────────────────────────────────────────┐
                  │                 TELEGRAM BOT                  │
                  │   (Mijozlar uchun to'liq interaktiv interfeys)│
                  └───────────────────────┬───────────────────────┘
                                          │
                  ┌───────────────────────▼───────────────────────┐
                  │           EXPRESS REST API SERVER             │
                  │  - Auth (JWT, bcrypt)    - Savat & Buyurtma   │
                  │  - Inventar nazorati     - To'lov adapterlari │
                  │  - QR & Ticket Service   - Turniket Skaneri   │
                  └──────┬────────────────┬───────────────┬───────┘
                         │                │               │
    ┌────────────────────▼─────┐ ┌────────▼────────┐ ┌────▼────────────────────┐
    │     MONGODB ATLAS        │ │ TICKET RENDERER │ │     ADMIN DASHBOARD      │
    │  - Foydalanuvchilar      │ │ - High-Res PNG  │ │ - KPI Analitika          │
    │  - Tadbirlar & Chiptalar │ │ - Vektorli PDF  │ │ - Tadbirlar & Narxlar    │
    │  - Savat & Buyurtmalar   │ │ - Web Chipta    │ │ - Turniket QR Skaneri    │
    │  - Audit loglar          │ │ - QR Shifrlash  │ │ - Rollar & CSV Hisobot   │
    └──────────────────────────┘ └─────────────────┘ └──────────────────────────┘
```

1. **Telegram Bot (`src/handlers/`):** Bosh menyu, katalog, sifatli afishalar, chipta tanlash, doimiy MongoDB savati, buyurtma, to'lov va QR chipta yuborish.
2. **Backend REST API (`src/controllers/`, `src/routes/`):** Barcha biznes logikasi, narx tekshiruvi, xavfsizlik filtrlari, rate limiting va CORS.
3. **MongoDB Atlas:** Barcha ma'lumotlar, savat holati, inventar va buyurtmalar bulutli bazada doimiy saqlanadi.
4. **Admin Dashboard (`src/public/admin.html`):** Brauzer orqali ochiladigan premium veb-panel (CRUD, statistika, buyurtmalar, chiptalar, foydalanuvchilar).
5. **QR Validation & Scanner (`src/controllers/scannerController.js`):** Tadbirga kirishda kamera orqali bir martalik atomik kirish nazorati.
6. **Ticket Rendering Service (`src/services/ticketRenderer.js`):** Sayt, PNG rasm va PDF formatlarida **bir xil premium dizaynga ega** chipta generatsiyasi.
7. **To'lov Tizimi (`src/services/paymentService.js`):** Click, Payme, Uzum Bank va Tezkor Test rejimi.
8. **Inventar Konkurentligi (`src/services/inventoryService.js`):** Bir vaqtda bir nechta mijoz so'nggi chiptani sotib olishga uringanda ortiqcha chipta sotilishini (overbooking) oldini oluvchi atomik mexanizm.

---

## 💎 2. SAYT VA TELEGRAMDA BIR XIL CHIPTA DIZAYNI

Telegramda yuboriladigan chipta rasmi, veb-saytdagi chipta (`/t/:id`) va yuklab olinadigan PDF fayli **bir xil ma'lumotlar va vizual shablon** asosida shakllanadi:

- 🎨 **Ranglar gammasi:** Qora, grafit (`#090D16`), oltin-sariq (`#F59E0B`) va zumrad yashil (`#22C55E`).
- 🎟 **Perforatsiya chizig'i va kesiklar (Notches):** Haqiqiy qimmatbaho chiptalardagi kabi ikkita tomonga ajratilgan karta va yirtma kupon (stub).
- 🖼 **Afisha va Tadbir Tafsilotlari:** Katta tadbir rasmi, sana, vaqt, shahar, arena va chipta egasining to'liq ismi.
- 📱 **Noyob QR-Kod:** Serverda tekshiriladigan, taxmin qilib topib bo'lmaydigan 24-belgili xavfsiz token.
- 📁 **Universal Shablon:** `shared/ticket-template/ticket.html` va `ticket.css`.

---

## 📂 3. LOYIHA PAPKALARI TUZILMASI

```
book-bot/
├── src/
│   ├── config/
│   │   ├── database.js          # MongoDB Atlas ulanishi va DNS sozlamasi
│   │   └── index.js             # Barcha konfiguratsiyalar (.env)
│   ├── controllers/
│   │   ├── adminController.js   # Admin CRUD, hisobotlar, foydalanuvchilar
│   │   ├── authController.js    # Login, JWT autentifikatsiya
│   │   ├── cartController.js    # REST API Savat amallari
│   │   ├── eventController.js   # Tadbirlar va kategoriyalar
│   │   ├── orderController.js   # Buyurtmalar boshqaruvi
│   │   ├── paymentController.js # To'lovlar va Click/Payme webhooklari
│   │   ├── scannerController.js # Turniket QR tekshiruvi (Check-in)
│   │   └── ticketController.js  # Chipta ko'rinishlari (Web, PNG, PDF)
│   ├── handlers/
│   │   ├── cartHandler.js       # Bot savat interaktiv boshqaruvi (+/-)
│   │   ├── checkoutHandler.js   # Buyurtma, to'lov tanlash va status tekshiruvi
│   │   ├── eventsHandler.js     # Tadbirlar katalogi, pagination, afisha
│   │   ├── index.js             # Bot handlerlarini ro'yxatga olish
│   │   ├── profileHandler.js    # Profil, sevimli tadbirlar, buyurtmalar tarixi
│   │   ├── searchHandler.js     # Qidiruv, kategoriyalar, yordam bo'limi
│   │   ├── startHandler.js      # /start va deep-link bilan ochish
│   │   └── ticketsHandler.js    # Mening chiptalarim, PDF yuklash
│   ├── middleware/
│   │   ├── auth.js              # JWT va rollarni tekshirish (RBAC)
│   │   ├── errorHandler.js      # Markaziy xatoliklar menejeri
│   │   ├── rateLimiter.js       # DDoS va brute-force himoyasi
│   │   └── validate.js          # Kiruvchi ma'lumotlar validatsiyasi
│   ├── models/
│   │   ├── AuditLog.js          # Moliyaviy va turniket amallari logi
│   │   ├── Cart.js              # Doimiy MongoDB savati
│   │   ├── Category.js          # Konsert, teatr, sport, festivallar
│   │   ├── Event.js             # Tadbirlar sxemasi
│   │   ├── Favorite.js          # Sevimli tadbirlar
│   │   ├── Order.js             # Buyurtmalar tarixi
│   │   ├── Payment.js           # To'lov yozuvlari va tranzaksiyalar
│   │   ├── Ticket.js            # Har bir xarid qilingan elektron chipta
│   │   ├── TicketType.js        # Standard, VIP, Fan-zone, narxlar va qoldiq
│   │   └── User.js              # Mijozlar va adminlar
│   ├── public/
│   │   ├── admin.html           # Professional Admin Dashboard & Turniket Skaneri
│   │   └── index.html           # Ochiq veb landing sahifa
│   ├── routes/                  # Express REST API marshrutlari
│   ├── scripts/
│   │   └── seed.js              # Boshlang'ich tadbirlar va admin yaratish
│   ├── services/
│   │   ├── botService.js        # Telegram bot orqali rasm/xabar jo'natish
│   │   ├── imagekitService.js   # Rasmlarni bulutda saqlash
│   │   ├── inventoryService.js  # Atomik inventar band qilish va bo'shatish
│   │   ├── paymentService.js    # To'lovni tasdiqlash va chipta generatsiyasi
│   │   ├── qrService.js         # QR-kod Buffer va DataURL generatsiyasi
│   │   └── ticketRenderer.js    # Canvas PNG, PDFKit va HTML generatorlari
│   ├── utils/
│   │   ├── formatters.js        # Narx (UZS) va sanalarni chiroyli formatlash
│   │   ├── keyboards.js         # Inline va Reply tugmalar shablonlari
│   │   ├── logger.js            # Xavfsiz log yozish vositasi
│   │   └── token.js             # Tasodifiy unikal ID va tokenlar
│   ├── app.js                   # Express server sozlamasi
│   └── index.js                 # Asosiy kirish nuqtasi (Server + Bot + Sweeper)
├── shared/
│   └── ticket-template/
│       ├── ticket.html          # Universal chipta veb shabloni
│       └── ticket.css           # Luxury Graphite & Gold stillar
├── test/
│   ├── admin.test.js            # Admin kirishi va RBAC huquqlar testi
│   ├── cart.test.js             # Savat tizimi, miqdor va izolyatsiya testi
│   ├── inventory.test.js        # Concurrency, ortiqcha sotishdan himoya testi
│   ├── order.test.js            # Buyurtma yaratish va to'lov testi
│   └── ticket.test.js           # QR validation va PNG render testi
├── .env.example                 # Barcha maxfiy kalitlar namunasi
├── package.json
└── README.md
```

---

## ⚙️ 4. O'RNATISH VA ISHGA TUSHIRISH

### Talablar
- **Node.js** >= 18.x
- **npm** >= 9.x
- **MongoDB Atlas** hisobi yoki lokal MongoDB

### 1-qadam: Paketlarni o'rnatish
```bash
npm install
```

### 2-qadam: Sozlamalar (.env)
Loyihaning asosiy papkasida `.env` faylini tekshiring:
```ini
PORT=5000
NODE_ENV=development
APP_NAME=ELITE TICKETS
CURRENCY=UZS
BASE_URL=http://localhost:5000

# Telegram Bot
BOT_TOKEN=8920780935:AAFrPTK_By4wuKO6AWN0S4g1UREUdkG7wAM
TELEGRAM_BOT_TOKEN=8920780935:AAFrPTK_By4wuKO6AWN0S4g1UREUdkG7wAM
BOT_USERNAME=book_arenda3122_bot
ADMIN_ID=8129086266
CONTACT_TEXT=Savollar va yordam uchun: @abdulqaziz

# MongoDB Atlas
MONGO_URI=mongodb+srv://abdulazizzoxidov78_db_user:jTH5a9iJFlvactZV@cluster0.mhxp9xu.mongodb.net/bookbot?retryWrites=true&w=majority

# Xavfsizlik
JWT_SECRET=elite_ticket_super_secure_jwt_secret_key_2026_xyz987
TICKET_SIGNING_SECRET=elite_secret_ticket_sign_key_987654321

# Boshlang'ich Admin
INITIAL_ADMIN_EMAIL=admin@elitetickets.uz
INITIAL_ADMIN_PASSWORD=AdminElite2026!
```

### 3-qadam: Bazani to'ldirish (Seed)
Barcha dastlabki kategoriyalar, mashhur tadbirlar, chipta turlari va Superadmin akkauntini yaratish uchun:
```bash
npm run seed
```

### 4-qadam: Testlarni ishga tushirish
Tizimning barcha 5 ta asosiy test to'plamini (17 ta alohida test) tekshirish:
```bash
npm test
```

### 5-qadam: Server va Botni ishga tushirish
```bash
npm start
```
Ishga tushgandan so'ng terminalda quyidagi yozuvlar chiqadi:
```
[Database] MongoDB Atlas muvaffaqiyatli ulandi: bookbot ✅
[Express API] Server is running on port 5000 (http://localhost:5000) ✅
[Admin Panel] Dashboard mavjud: http://localhost:5000/admin
[Health Check] Health endpoint: http://localhost:5000/health
[Telegram Bot] @book_arenda3122_bot muvaffaqiyatli ishga tushmoqda... ✅
[Telegram Bot] Polling faollashtirildi va xabarlarni qabul qilmoqda ✅
```

---

## 🤖 5. TELEGRAM BOT BO'YICHA FOYDALANUVCHI YO'RIQNOMASI

1. Telegramda botingizga `/start` yuboring:
   - Bot sizni samimiy salomlaydi va doimiy menyuni ochadi.
2. `🎫 Tadbirlar` tugmasini bosing:
   - Barcha faol tadbirlar sahifalab ko'rsatiladi.
3. Tadbirni tanlang:
   - Sifatli afisha, to'liq tavsif, manzil, boshlanish vaqti va chipta turlari chiqadi.
4. `🎟 Chipta tanlash`:
   - Chipta turini (VIP, Standard, Fan Zone) va `➖` / `➕` orqali kerakli miqdorni tanlang.
5. `🛒 Savatga qo'shish`:
   - Chipta sizning MongoDB dagi doimiy savatingizga qo'shiladi.
   - Bir necha turdagi tadbirlardan istalgancha chipta qo'shish mumkin.
6. `🛒 Savatim`:
   - Har bir tadbir bo'yicha chiptalar sonini oshirish, kamaytirish yoki o'chirish mumkin.
7. `💳 Buyurtmani rasmiylashtirish`:
   - Inventar 15 daqiqaga siz uchun band qilinadi.
   - To'lov tizimi (Test / Click / Payme / Uzum) tanlanadi.
8. `Test to'lov (Tezkor)`:
   - To'lov tasdiqlanadi va bot chatga darhol chiroyli **QR-kodli Chipta Rasmi (PNG)** hamda vektorli **PDF chiptani** yuboradi!
9. `🎟 Chiptalarim`:
   - Istalgan vaqtda barcha xarid qilingan chiptalarni ko'rish, ochish yoki PDF yuklab olish mumkin.

---

## 🛡 6. ADMIN DASHBOARD VA TURNIKET SKANERI

Admin Dashboard brauzerda quyidagi manzilda ochiladi:
👉 **`http://localhost:5000/admin`**

**Standart Admin kirish ma'lumotlari:**
- **Email:** `admin@elitetickets.uz`
- **Parol:** `AdminElite2026!`

### Dashboard Bo'limlari:
1. **Asosiy panel (Overview):** Jami tasdiqlangan tushum (so'm), sotilgan chiptalar soni, mavjud zaxira, buyurtmalar statistikasi va oxirgi savdolar jadvali.
2. **Tadbirlar (Events):** Yangi tadbir yaratish (nom, afisha URL, sana, manzil, tavsif), tahrirlash va o'chirish.
3. **Chipta turlari (Ticket Types):** Har bir tadbir uchun Standard, VIP, Fan-zone turlarini, ularning narxi va mavjud miqdorini belgilash.
4. **Buyurtmalar (Orders):** Barcha buyurtmalarni ID, mijoz ismi va telefoni bo'yicha qidirish, holatini kuzatish.
5. **Chiptalar (Tickets):** Chiqarilgan har bir chiptani ko'rish, veb havolasini ochish yoki PDF yuklab olish.
6. **QR Skaner (Turniket Nazoratchisi):**
   - Kompyuter yoki telefon kamerasini yoqib, mehmon ko'rsatgan QR-kodni skanerlash.
   - Chipta birinchi marta ko'rsatilganda: `✅ KIRISHGA RUXSAT BERILDI!` yashil rangda chiqadi va status `used` ga o'tadi.
   - Agar bir xil chipta ikkinchi marta ko'rsatilsa: `❌ BU CHIPTA AVVAL ISHLATILGAN!` qizil ogohlantirish beradi va kirish taqiqlanadi.
7. **Foydalanuvchilar va Rollar:** Foydalanuvchilarning rollarini (`superadmin`, `admin`, `organizer`, `scanner`, `customer`) boshqarish.
8. **Hisobotlar (CSV Export):** `📥 Hisobot CSV` tugmasi orqali barcha tasdiqlangan savdolar hisobotini Excel/CSV formatida yuklab olish.

---

## 🌐 7. BULUTGA DEPLOY QILISH (RENDER / VPS)

### Render.com orqali deploy qilish:
1. Loyihani o'zingizning GitHub repozitoriysiga yuklang (`git push origin main`).
2. [Render.com](https://render.com) ga kiring va **New Web Service** ni tanlang.
3. GitHub repozitoriyangizni ulang.
4. Sozlamalarni kiriting:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. **Environment Variables** bo'limida `.env` dagi barcha qiymatlarni (BOT_TOKEN, MONGO_URI, JWT_SECRET, BASE_URL) kiriting.
6. **Health Check Path:** `/health`
7. Deploy yakunlangach, bot internetda **24/7 rejimida** uzluksiz ishlaydi. Kompyuteringizni o'chirib qo'ysangiz ham foydalanuvchilar botdan to'liq foydalana oladilar.

---

## 🔒 8. XAVFSIZLIK VA ISHONCHLILIK

- **Hech qanday soxta tugmalar yo'q:** Barcha tugmalar real controller va servislar bilan bog'langan.
- **Takroriy to'lov (Idempotency) himoyasi:** Agar webhook bir xil buyurtma uchun bir necha bor kelsa, ikkinchi marta chipta chiqarilmaydi.
- **Inventar Poygasi (Race Conditions) himoyasi:** Bir nechta odam oxirgi chiptani birdaniga sotib olishga ursa, faqat birinchisiga ruxsat beriladi, boshqalarga rad javobi qaytariladi.
- **Vaqtincha band qilish muddati:** 15 daqiqa ichida to'lov qilinmagan buyurtmalar avtomatik bekor qilinadi va chiptalar umumiy savdoga qaytariladi (`sweepExpiredOrders`).
- **Noyob QR Token:** QR-kod ichida maxfiy parollar saqlanmaydi, faqat kriptografik xavfsiz 24-belgili tasodifiy token ishlatiladi.

---

© 2026 **ELITE TICKETS PLATFORM**. Professional E-Ticketing System.
