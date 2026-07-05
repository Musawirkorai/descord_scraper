require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { createServer } = require('http');
const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { initWebSocket } = require('./services/websocket');
const logger = require('./utils/logger');
const rateLimit = require('express-rate-limit');
const { startScheduler } = require('./services/subnetScheduler');
const { client } = require('./bot/index');

// Routes
const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/servers');
const channelRoutes = require('./routes/channels');
const messageRoutes = require('./routes/messages');
const analyticsRoutes = require('./routes/analytics');
const scraperRoutes = require('./routes/scraper');

const app = express();
const httpServer = createServer(app);

// Security & middleware
app.use(helmet());
app.use(compression());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined', { stream: { write: msg => logger.http(msg.trim()) } }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/scraper', scraperRoutes);
app.use("/api/subnets", require("./routes/subnet_routes"));
app.use("/api", require("./routes/subnetConfig"));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Error handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  await connectDB();
  await connectRedis();
  initWebSocket(httpServer);
  
  // Start Express server
  httpServer.listen(PORT, () => logger.info(`🚀 Server running on port ${PORT}`));

  // 2. Safely initialize the Discord scheduler hook here
  if (client) {
    client.once('ready', () => {
      if (!process.env.DISCORD_GUILD_ID) {
        logger.warn('⚠️ DISCORD_GUILD_ID is missing from your .env file! Scheduler skipped.');
        return;
      }
      startScheduler(client, process.env.DISCORD_GUILD_ID);
      logger.info('🚀 Discord client ready and subnet scheduler started.');
    });
  } else {
    logger.error('❌ Discord client instance could not be loaded from the bot folder.');
  }
}

bootstrap().catch(err => { 
  logger.error('Bootstrap failed:', err); 
  process.exit(1); 
});

module.exports = app;
