const dns = require('dns');

// DNS server fix for Windows + MongoDB Atlas SRV resolution
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const http = require('http');
const config = require('./config');
const { connectDB, disconnectDB } = require('./config/database');
const { createApp } = require('./app');
const { getBotInstance } = require('./services/botService');
const { registerBotHandlers } = require('./handlers');
const { sweepExpiredOrders } = require('./services/inventoryService');
const logger = require('./utils/logger');

async function startPlatform() {
  try {
    logger.info(`Starting ${config.appName}...`);

    // 1. Connect to MongoDB Atlas
    await connectDB();

    // 2. Start Express Web Server & Admin API
    const app = createApp();
    const server = http.createServer(app);

    server.listen(config.port, () => {
      logger.info(`[Express API] Server is running on port ${config.port} (${config.baseUrl}) ✅`);
      logger.info(`[Admin Panel] Dashboard mavjud: ${config.baseUrl}/admin`);
      logger.info(`[Health Check] Health endpoint: ${config.baseUrl}/health`);
    });

    // 3. Start Telegram Bot
    const bot = getBotInstance();
    registerBotHandlers(bot);

    const botInfo = await bot.telegram.getMe();
    logger.info(`[Telegram Bot] @${botInfo.username} ("${botInfo.first_name}") muvaffaqiyatli ishga tushmoqda... ✅`);

    await bot.launch();
    logger.info(`[Telegram Bot] Polling faollashtirildi va xabarlarni qabul qilmoqda ✅`);

    // 4. Background cleanup for expired order reservations (Every 2 minutes)
    const sweepInterval = setInterval(() => {
      sweepExpiredOrders().catch((err) => logger.error('Sweep error:', err));
    }, 2 * 60 * 1000);

    // 5. Graceful shutdown handler
    const gracefulShutdown = async (signal) => {
      logger.warn(`[Shutdown] ${signal} qabul qilindi. Server to'xtatilmoqda...`);
      clearInterval(sweepInterval);

      try {
        bot.stop(signal);
      } catch (e) {}

      server.close(() => {
        logger.info('[Shutdown] HTTP server yopildi.');
      });

      await disconnectDB().catch(() => {});
      logger.info('[Shutdown] Dastur to\'liq to\'xtatildi.');
      process.exit(0);
    };

    process.once('SIGINT', () => gracefulShutdown('SIGINT'));
    process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    logger.error('Dasturni ishga tushirishda xatolik:', error);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

startPlatform();
