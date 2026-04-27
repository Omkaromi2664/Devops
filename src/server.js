const http = require('http');
const WebSocket = require('ws');
const { app, port } = require('./app');
const { getFullStatus } = require('../routes/status');

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

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

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
