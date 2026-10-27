const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');

const config = require('./config');
const routes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const ticketController = require('./controllers/ticketController');

function createApp() {
  const app = express();

  // Basic security and parsing
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Static files (Admin SPA and public assets)
  app.use(express.static(path.join(__dirname, 'public')));

  // Health-check endpoint for Cloud Deployment (Render, VPS, Uptime)
  app.get('/health', (req, res) => {
    const isDbConnected = mongoose.connection.readyState === 1;
    res.status(isDbConnected ? 200 : 503).json({
      status: isDbConnected ? 'UP' : 'DEGRADED',
      app: config.appName,
      env: config.env,
      database: isDbConnected ? 'CONNECTED' : 'DISCONNECTED',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Admin Dashboard URL
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  });

  // Dedicated Turnstile QR Scanner URL
  app.get('/scanner', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  });

  // Short Web Ticket URL: /t/:ticketId
  app.get('/t/:id', ticketController.viewTicketWeb);

  // Mount API endpoints
  app.use('/api', apiLimiter, routes);

  // 404 & Centralized Error Handler
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};
