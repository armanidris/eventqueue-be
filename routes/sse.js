const express = require('express');
const db = require('../db');
const router = express.Router();

// Simpan koneksi client dengan struktur Map bersarang
const clients = new Map();

// Middleware SSE untuk courts
router.get('/courts', (req, res) => {
  // Set header SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // ID client unik
  const clientId = Date.now();
  
  // Kirim heartbeat setiap 30 detik
  const heartbeatInterval = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Simpan koneksi
  if (!clients.has('courts')) {
    clients.set('courts', new Map());
  }
  clients.get('courts').set(clientId, res);

  // Kirim data awal
  sendInitialCourtData(res);

  // Handle disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    if (clients.has('courts')) {
      clients.get('courts').delete(clientId);
      if (clients.get('courts').size === 0) {
        clients.delete('courts');
      }
    }
  });
});

// Fungsi broadcast update court
function broadcastCourtUpdate(updatedCourt) {
  if (!clients.has('courts')) return;

  const eventData = {
    id: Date.now(),
    type: 'COURT_UPDATE',
    data: formatCourtData(updatedCourt),
    timestamp: new Date().toISOString()
  };

  clients.get('courts').forEach(clientRes => {
    try {
      clientRes.write(`event: court_update\n`);
      clientRes.write(`id: ${eventData.id}\n`);
      clientRes.write(`data: ${JSON.stringify(eventData)}\n\n`);
    } catch (err) {
      console.error('Error sending to client:', err);
    }
  });
}

// Helper: Format data court
function formatCourtData(court) {
  return {
    id: court.id,
    name: court.name,
    current: court.current,
    next: court.next,
    afterNext: court.afterNext,
    Last: court.Last,
    status: getCourtStatus(court)
  };
}

// Helper: Get court status
function getCourtStatus(court) {
  if (court.current >= court.Last) return 'completed';
  if (court.next >= court.Last) return 'nearing-completion';
  return 'active';
}

// Helper: Kirim data awal
function sendInitialCourtData(res) {
  db.all('SELECT * FROM courts', [], (err, rows) => {
    if (err) {
      console.error('Error fetching initial data:', err);
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({
        type: 'INITIAL_DATA_ERROR',
        message: 'Failed to load initial data'
      })}\n\n`);
      return;
    }

    const eventData = {
      id: Date.now(),
      type: 'INITIAL_DATA',
      data: rows.map(formatCourtData),
      timestamp: new Date().toISOString()
    };

    res.write(`event: initial_data\n`);
    res.write(`id: ${eventData.id}\n`);
    res.write(`data: ${JSON.stringify(eventData)}\n\n`);
  });
}

module.exports = {
  router,
  broadcastCourtUpdate
};