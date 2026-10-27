const dns = require('dns');
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const mongoose = require('mongoose');
const config = require('../config');
const { User, Category, Event, TicketType } = require('../models');

async function seed() {
  console.log('[Seed] MongoDB Atlas ulanmoqda...');
  await mongoose.connect(config.db.uri);
  console.log('[Seed] Ulandi ✅');

  // 1. Initial Admin User
  let admin = null;
  if (config.telegram.adminId) {
    admin = await User.findOne({ telegramId: Number(config.telegram.adminId) });
  }
  if (!admin) {
    admin = await User.findOne({ email: config.admin.initialEmail });
  }

  if (!admin) {
    admin = new User({
      firstName: 'Elite',
      lastName: 'Admin',
      email: config.admin.initialEmail,
      password: config.admin.initialPassword,
      role: 'superadmin',
      status: 'active',
      phone: '+998901234567',
      organizationName: 'Elite Tickets Central',
      telegramId: config.telegram.adminId ? Number(config.telegram.adminId) : undefined,
    });
    await admin.save();
    console.log(`[Seed] Superadmin yaratildi: ${admin.email} (Parol: ${config.admin.initialPassword}) ✅`);
  } else {
    admin.email = config.admin.initialEmail;
    admin.password = config.admin.initialPassword;
    admin.role = 'superadmin';
    admin.status = 'active';
    admin.organizationName = 'Elite Tickets Central';
    await admin.save();
    console.log(`[Seed] Superadmin yangilandi: ${admin.email} [ID: ${admin.telegramId || admin._id}] ✅`);
  }

  // 2. Categories
  const categoriesData = [
    { name: 'Konsertlar', slug: 'konsertlar', icon: '🎤', description: 'O\'zbek va xorij yulduzlarining jonli konsertlari', order: 1 },
    { name: 'Teatr va Balet', slug: 'teatr-va-balet', icon: '🎭', description: 'Klassik va zamonaviy teatr tomoshalari', order: 2 },
    { name: 'Stand-Up', slug: 'stand-up', icon: '🎙', description: 'Kulgi va hazil kechalari, solistlar chiqishlari', order: 3 },
    { name: 'Sport musobaqalari', slug: 'sport', icon: '⚽️', description: 'Futbol, boks, MMA va yirik musobaqalar', order: 4 },
    { name: 'Festivallar', slug: 'festivallar', icon: '🎪', description: 'Shahar va musiqa festivallari, ochiq osmon ostidagi shoular', order: 5 },
    { name: 'Ko\'rgazmalar', slug: 'korgazmalar', icon: '🖼', description: 'San\'at, biznes va texnologiya ko\'rgazmalari', order: 6 },
  ];

  const categoryMap = {};
  for (const c of categoriesData) {
    let cat = await Category.findOne({ slug: c.slug });
    if (!cat) {
      cat = await Category.create(c);
      console.log(`[Seed] Kategoriya yaratildi: ${c.name}`);
    } else {
      console.log(`[Seed] Kategoriya mavjud: ${c.name}`);
    }
    categoryMap[c.slug] = cat;
  }

  // 3. Events & Ticket Types
  const eventsData = [
    {
      title: 'Jaloliddin Ahmadaliyev — Katta Jonli Konsert',
      slug: 'jaloliddin-ahmadaliyev-live-2026',
      description: 'Estradamizning eng yorqin yulduzi Jaloliddin Ahmadaliyevning yangi albom taqdimoti va eng sara xit qo\'shiqlari jonli ijroda! Yuqori sifatli yorug\'lik, ovoz va unutilmas shou sizni kutmoqda.',
      categorySlug: 'konsertlar',
      city: 'Toshkent',
      venue: 'Humo Arena',
      address: 'Afrosiyob ko\'chasi, 2-uy',
      mapUrl: 'https://yandex.uz/maps/-/CDrQ5-8Z',
      poster: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=1200',
      startAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 kundan keyin
      endAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
      ageRestriction: '6+',
      rules: 'Tadbir boshlanishidan kamida 30 daqiqa oldin kelishingiz so\'raladi. Rasmga olish taqiqlanadi.',
      isPopular: true,
      ticketTypes: [
        { name: 'Standard (Balkon)', price: 150000, totalQuantity: 200, sector: 'Balkon Sektori' },
        { name: 'Fan Zone (Parter)', price: 280000, totalQuantity: 150, sector: 'Sahna oldi erkin zona' },
        { name: 'VIP Loja', price: 500000, totalQuantity: 40, sector: 'VIP A Sektori' },
      ],
    },
    {
      title: 'Alisher Navoiy nomidagi teatr: "Oqqush Ko\'li" Baleti',
      slug: 'oqqush-koli-balet-2026',
      description: 'Pyotr Chaykovskiyning jahon durdonasi hisoblangan "Oqqush ko\'li" baleti Navoiy nomidagi teatrning bosh sahnasida simfonik orkestr jo\'rligida.',
      categorySlug: 'teatr-va-balet',
      city: 'Toshkent',
      venue: 'Alisher Navoiy nomidagi DAKT',
      address: 'Zarafshon ko\'chasi, 28-uy',
      mapUrl: 'https://yandex.uz/maps/-/CDrQ5-8Z',
      poster: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200',
      startAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2.5 * 60 * 60 * 1000),
      ageRestriction: '12+',
      rules: 'Klassik libos talab etiladi. Spektakl boshlangandan keyin zalga kirish qat\'iyan man etiladi.',
      isPopular: true,
      ticketTypes: [
        { name: 'Amfiteatr', price: 90000, totalQuantity: 120, sector: 'Amfiteatr' },
        { name: 'Parter', price: 180000, totalQuantity: 100, sector: 'Parter 5-10 qatorlar' },
        { name: 'Prezident Lojasi', price: 350000, totalQuantity: 16, sector: 'Bosh Loja' },
      ],
    },
    {
      title: 'Stand-Up Tashkent: Katta Yillik Hazil Shou',
      slug: 'standup-tashkent-yillik-2026',
      description: 'O\'zbekiston va MDHning eng tajribali komiklari ishtirokidagi unutilmas kecha. Yangi materiallar, eksklyuziv hazillar va yorqin kayfiyat kafolatlanadi!',
      categorySlug: 'stand-up',
      city: 'Toshkent',
      venue: 'Turkiston San\'at Saroyi',
      address: 'Navoiy ko\'chasi, 2-uy',
      mapUrl: 'https://yandex.uz/maps/-/CDrQ5-8Z',
      poster: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?q=80&w=1200',
      startAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      ageRestriction: '18+',
      rules: 'Voyaga yetmaganlar kiritilmaydi. Shaxsni tasdiqlovchi hujjat talab qilinadi.',
      isPopular: false,
      ticketTypes: [
        { name: 'Standard', price: 120000, totalQuantity: 150, sector: 'Zal markazi' },
        { name: 'VIP Stol', price: 250000, totalQuantity: 30, sector: 'Oldi qator stollar' },
      ],
    },
    {
      title: 'Futbol: O\'zbekiston — Hal qiluvchi Saralash O\'yini',
      slug: 'futbol-uzbekistan-qualifier-2026',
      description: 'Milliy terma jamoamizning jahon chempionati saralash bosqichidagi eng muhim uchrashuvi! Milliy g\'urur va kuchli raqobat maydonida birga bo\'ling.',
      categorySlug: 'sport',
      city: 'Toshkent',
      venue: 'Bunyodkor Stadioni (Milliy)',
      address: 'Chilonzor tumani, Bunyodkor shox ko\'chasi, 47',
      mapUrl: 'https://yandex.uz/maps/-/CDrQ5-8Z',
      poster: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200',
      startAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      ageRestriction: '0+',
      rules: 'Stadionga suv idishlari, lazer moslamalari va o\'tkir buyumlar kiritish taqiqlanadi.',
      isPopular: true,
      ticketTypes: [
        { name: '2-Toifa (Darvoza orti)', price: 60000, totalQuantity: 300, sector: 'Sektor 14-18' },
        { name: '1-Toifa (Markaziy)', price: 140000, totalQuantity: 200, sector: 'Sektor 3-5' },
        { name: 'VIP Lounge', price: 400000, totalQuantity: 50, sector: 'VIP Skybox' },
      ],
    },
  ];

  for (const ed of eventsData) {
    let ev = await Event.findOne({ slug: ed.slug });
    const category = categoryMap[ed.categorySlug];
    if (!ev) {
      ev = await Event.create({
        title: ed.title,
        slug: ed.slug,
        description: ed.description,
        category: category._id,
        city: ed.city,
        venue: ed.venue,
        address: ed.address,
        mapUrl: ed.mapUrl,
        poster: ed.poster,
        startAt: ed.startAt,
        endAt: ed.endAt,
        organizer: admin._id,
        organizerName: 'Elite Tickets Central',
        ageRestriction: ed.ageRestriction,
        rules: ed.rules,
        status: 'published',
        isPopular: ed.isPopular,
      });
      console.log(`[Seed] Tadbir yaratildi: ${ev.title}`);

      // Add ticket types
      for (const tt of ed.ticketTypes) {
        await TicketType.create({
          event: ev._id,
          name: tt.name,
          price: tt.price,
          totalQuantity: tt.totalQuantity,
          sector: tt.sector,
          isActive: true,
        });
        console.log(`  [Seed] -> Chipta turi: ${tt.name} (${tt.price.toLocaleString()} so'm)`);
      }
    } else {
      console.log(`[Seed] Tadbir allaqachon mavjud: ${ev.title}`);
    }
  }

  console.log('\n=============================================');
  console.log('✅ BAZANI SEED QILISH MUVAFFAQIYATLI YAKUNLANDI!');
  console.log(`Admin kirish: ${config.admin.initialEmail} | ${config.admin.initialPassword}`);
  console.log('Admin Dashboard: http://localhost:' + config.port + '/admin');
  console.log('=============================================\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[Seed Error]:', err);
  process.exit(1);
});
