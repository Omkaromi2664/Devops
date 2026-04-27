const express = require('express');
const axios = require('axios');

const router = express.Router();

const K8S_PROXY_URL = process.env.K8S_PROXY_URL || 'http://localhost:8001';

function formatAge(creationTimestamp) {
  if (!creationTimestamp) return '--';
  const created = new Date(creationTimestamp).getTime();
  if (Number.isNaN(created)) return '--';
  const seconds = Math.max(0, Math.floor((Date.now() - created) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

async function getKubernetesStatus() {
  try {
    const url = `${K8S_PROXY_URL}/api/v1/namespaces/default/pods`;
    const response = await axios.get(url, { timeout: 3000 });
    const items = Array.isArray(response.data.items) ? response.data.items : [];

    const pods = items.map((item) => {
      const name = item.metadata && item.metadata.name;
      const status = item.status && item.status.phase;
      const reason = item.status && item.status.reason;
      const containerStatuses = item.status && item.status.containerStatuses;
      let derivedStatus = status || 'Unknown';

      if (Array.isArray(containerStatuses)) {
        const waiting = containerStatuses.find((cs) => cs.state && cs.state.waiting);
        const terminated = containerStatuses.find((cs) => cs.state && cs.state.terminated);
        if (waiting && waiting.state.waiting && waiting.state.waiting.reason) {
          derivedStatus = waiting.state.waiting.reason;
        } else if (terminated && terminated.state.terminated && terminated.state.terminated.reason) {
          derivedStatus = terminated.state.terminated.reason;
        }
      }

      if (reason && reason !== derivedStatus) {
        derivedStatus = reason;
      }

      return {
        name: name || 'pod',
        status: derivedStatus,
        age: formatAge(item.metadata && item.metadata.creationTimestamp)
      };
    });

    return {
      ok: true,
      pods
    };
  } catch (error) {
    return {
      ok: false,
      message: 'K8s offline',
      pods: []
    };
  }
}

router.get('/', async (req, res) => {
  const payload = await getKubernetesStatus();
  res.json(payload);
});

module.exports = { router, getKubernetesStatus };
