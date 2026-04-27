const express = require('express');
const path = require('path');
const systemRoute = require('../routes/system');
const jenkinsRoute = require('../routes/jenkins');
const dockerRoute = require('../routes/docker');
const kubernetesRoute = require('../routes/kubernetes');
const nagiosRoute = require('../routes/nagios');

const app = express();
const port = process.env.PORT || 3000;

const publicDir = path.join(__dirname, '..', 'public');

app.use(express.static(publicDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/system', systemRoute.router);
app.use('/api/jenkins', jenkinsRoute.router);
app.use('/api/docker', dockerRoute.router);
app.use('/api/kubernetes', kubernetesRoute.router);
app.use('/api/nagios', nagiosRoute.router);

module.exports = { app, port };
