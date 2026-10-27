const dns = require('dns');
const mongoose = require('mongoose');
const config = require('./index');

// Fix for Windows DNS resolution with MongoDB Atlas SRV records
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // Ignore in environments where setting DNS servers is restricted
}

let isConnected = false;

async function connectDB(customUri = null) {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const uri = customUri || config.db.uri;
  if (!uri) {
    throw new Error('MongoDB URI sozlanmagan! Iltimos .env faylida MONGO_URI ni tekshiring.');
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      autoIndex: true,
    });

    isConnected = true;
    console.log(`[Database] MongoDB Atlas muvaffaqiyatli ulandi: ${mongoose.connection.name} ✅`);

    mongoose.connection.on('error', (err) => {
      console.error('[Database] MongoDB xatosi:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[Database] MongoDB uzildi. Qayta ulanish kutilmoqda...');
      isConnected = false;
    });

    return mongoose.connection;
  } catch (error) {
    console.error('[Database] MongoDB ulanishida jiddiy xatolik:', error.message);
    throw error;
  }
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[Database] MongoDB aloqasi uzildi.');
  }
}

module.exports = {
  connectDB,
  disconnectDB,
};
