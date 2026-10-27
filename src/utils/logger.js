const config = require('../config');

function formatTime() {
  return new Date().toISOString();
}

const logger = {
  info: (msg, meta = '') => {
    console.log(`[INFO]  [${formatTime()}] ${msg}`, meta ? JSON.stringify(meta) : '');
  },
  warn: (msg, meta = '') => {
    console.warn(`[WARN]  [${formatTime()}] ${msg}`, meta ? JSON.stringify(meta) : '');
  },
  error: (msg, err = null) => {
    console.error(`[ERROR] [${formatTime()}] ${msg}`, err ? (err.stack || err.message || err) : '');
  },
  debug: (msg, meta = '') => {
    if (config.isDev) {
      console.log(`[DEBUG] [${formatTime()}] ${msg}`, meta ? JSON.stringify(meta) : '');
    }
  },
};

module.exports = logger;
