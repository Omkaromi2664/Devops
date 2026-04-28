const express = require('express');
const axios = require('axios');
const https = require('https');
const fs = require('fs');

const router = express.Router();

const K8S_PROXY_URL = process.env.K8S_PROXY_URL || '';
const K8S_API_URL = process.env.K8S_API_URL || 'https://kubernetes.default.svc';
const K8S_IN_CLUSTER = process.env.K8S_IN_CLUSTER === 'true' || process.env.K8S_IN_CLUSTER === '1';
const K8S_NAMESPACE = process.env.K8S_NAMESPACE || 'default';
const SERVICE_ACCOUNT_DIR = '/var/run/secrets/kubernetes.io/serviceaccount';

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

function getInClusterConfig() {
  const tokenPath = `${SERVICE_ACCOUNT_DIR}/token`;
  const caPath = `${SERVICE_ACCOUNT_DIR}/ca.crt`;
  const token = fs.readFileSync(tokenPath, 'utf8').trim();
  const ca = fs.readFileSync(caPath);

  return {
    headers: {
      Authorization: `Bearer ${token}`
    },
    httpsAgent: new https.Agent({ ca }),
    timeout: 3000
  };
}

async function fetchPods() {
  const namespace = K8S_NAMESPACE || 'default';

  if (K8S_IN_CLUSTER) {
    const url = `${K8S_API_URL}/api/v1/namespaces/${namespace}/pods`;
    const response = await axios.get(url, getInClusterConfig());
    return response.data;
  }

  if (K8S_PROXY_URL) {
    const url = `${K8S_PROXY_URL}/api/v1/namespaces/${namespace}/pods`;
    const response = await axios.get(url, { timeout: 3000 });
    return response.data;
  }

  throw new Error('K8s offline');
}

async function getKubernetesStatus() {
  try {
    const data = await fetchPods();
    const items = Array.isArray(data.items) ? data.items : [];

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
