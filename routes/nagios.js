const express = require('express');
const fs = require('fs');
const axios = require('axios');

const router = express.Router();

const STATUS_FILE = process.env.NAGIOS_STATUS_FILE || '/usr/local/nagios/var/status.dat';
const STATUS_URL = process.env.NAGIOS_STATUS_URL || '';
const ALERT_WINDOW_MINUTES = Number(process.env.NAGIOS_ALERT_WINDOW_MINUTES || 60);

function getAlertWindowMs() {
  if (!Number.isFinite(ALERT_WINDOW_MINUTES) || ALERT_WINDOW_MINUTES <= 0) {
    return 60 * 60 * 1000;
  }
  return ALERT_WINDOW_MINUTES * 60 * 1000;
}

async function readStatusText() {
  if (STATUS_URL) {
    const response = await axios.get(STATUS_URL, { timeout: 3000 });
    const data = response.data;
    return typeof data === 'string' ? data : JSON.stringify(data);
  }

  return fs.promises.readFile(STATUS_FILE, 'utf8');
}

function parseServiceStatus(lines) {
  const services = [];
  let inService = false;
  let current = {};

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (trimmed === 'servicestatus {') {
      inService = true;
      current = {};
      return;
    }

    if (!inService) return;

    if (trimmed === '}') {
      services.push(current);
      inService = false;
      current = {};
      return;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    current[key] = value;
  });

  return services;
}

function mapSeverity(state) {
  if (state === 2) return 'critical';
  if (state === 1 || state === 3) return 'warning';
  return 'ok';
}

function buildAlerts(services) {
  const windowMs = getAlertWindowMs();
  const cutoff = Date.now() - windowMs;
  const alerts = services
    .map((service) => {
      const state = Number(service.current_state);
      const severity = mapSeverity(state);
      if (severity === 'ok') return null;

      const timestamp = Number(service.last_state_change || service.last_check || 0) * 1000;
      if (Number.isFinite(timestamp) && timestamp < cutoff) return null;

      return {
        host: service.host_name || 'host',
        service: service.service_description || 'service',
        severity,
        timestamp: Number.isFinite(timestamp) ? timestamp : null
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  return alerts.slice(0, 5);
}

async function getNagiosStatus() {
  try {
    const content = await readStatusText();
    const lines = content.split(/\r?\n/);
    const services = parseServiceStatus(lines);
    const alerts = buildAlerts(services);

    return {
      ok: true,
      alerts
    };
  } catch (error) {
    return {
      ok: false,
      message: 'Nagios offline',
      alerts: []
    };
  }
}

router.get('/', async (req, res) => {
  const payload = await getNagiosStatus();
  res.json(payload);
});

module.exports = { router, getNagiosStatus };
