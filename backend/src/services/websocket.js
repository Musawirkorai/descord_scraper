const { WebSocketServer } = require('ws');
const logger = require('../utils/logger');

let wss;
const clients = new Set();

function initWebSocket(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    clients.add(ws);
    logger.info(`WS client connected. Total: ${clients.size}`);

    ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
      } catch {}
    });

    ws.on('close', () => { clients.delete(ws); logger.info(`WS client disconnected. Total: ${clients.size}`); });
    ws.on('error', (err) => { logger.error('WS error:', err); clients.delete(ws); });
  });

  logger.info('✅ WebSocket server initialized');
}

function broadcastEvent(type, data) {
  if (!wss) return;
  const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  }
}

function getConnectedCount() { return clients.size; }

module.exports = { initWebSocket, broadcastEvent, getConnectedCount };
