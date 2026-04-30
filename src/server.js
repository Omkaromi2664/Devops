const http = require('http');
const WebSocket = require('ws');
const { app, port } = require('./app');
const { getFullStatus } = require('../routes/status');
const TestScheduler = require('../util/test-scheduler');

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Initialize test scheduler
const testScheduler = new TestScheduler({
  intervalMs: Number(process.env.TEST_INTERVAL_MS) || 5 * 60 * 1000, // 5 minutes
  enabled: process.env.TEST_SCHEDULER_ENABLED !== 'false'
});

async function broadcastStatus() {
  const payload = await getFullStatus();
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', (socket) => {
  getFullStatus()
    .then((payload) => {
      socket.send(JSON.stringify(payload));
    })
    .catch(() => {
      socket.send(JSON.stringify({ updatedAt: Date.now() }));
    });
});

setInterval(broadcastStatus, 5000);

app.get('/api/status', async (req, res) => {
  const payload = await getFullStatus();
  res.json(payload);
});

// Add test scheduler status endpoint
app.get('/api/scheduler', (req, res) => {
  res.json(testScheduler.getStatus());
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  
  // Start test scheduler
  testScheduler.start();
  console.log('Test scheduler started');
});
