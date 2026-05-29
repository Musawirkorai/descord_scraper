const { createClient } = require('redis');
const logger = require('../utils/logger');

let client;

async function connectRedis() {
  client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  client.on('error', err => logger.error('Redis error:', err));
  client.on('connect', () => logger.info('✅ Redis connected'));
  await client.connect();
}

function getRedis() {
  if (!client) throw new Error('Redis not initialized');
  return client;
}

async function cacheGet(key) {
  try { return JSON.parse(await getRedis().get(key)); } catch { return null; }
}

async function cacheSet(key, value, ttlSeconds = 3600) {
  try { await getRedis().setEx(key, ttlSeconds, JSON.stringify(value)); } catch (e) { logger.warn('Cache set failed:', e.message); }
}

async function cacheDel(key) {
  try { await getRedis().del(key); } catch {}
}

module.exports = { connectRedis, getRedis, cacheGet, cacheSet, cacheDel };
