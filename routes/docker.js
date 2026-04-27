const express = require('express');
const http = require('http');

const router = express.Router();

const DOCKER_SOCKET = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
const REQUEST_TIMEOUT_MS = 3000;

function dockerRequest(path) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        socketPath: DOCKER_SOCKET,
        path,
        method: 'GET'
      },
      (response) => {
        let data = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          if (response.statusCode && response.statusCode >= 400) {
            const error = new Error(`Docker API ${response.statusCode}`);
            error.statusCode = response.statusCode;
            error.body = data;
            reject(error);
            return;
          }
          resolve(data);
        });
      }
    );

    request.on('error', reject);
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error('Docker API timeout'));
    });
    request.end();
  });
}

async function fetchContainers() {
  const payload = await dockerRequest('/containers/json?all=1');
  const containers = JSON.parse(payload);
  return Array.isArray(containers) ? containers : [];
}

async function fetchContainerStats(containerId) {
  try {
    const payload = await dockerRequest(`/containers/${containerId}/stats?stream=false`);
    return JSON.parse(payload);
  } catch (error) {
    return null;
  }
}

function computeCpuPercent(stats) {
  const cpuStats = stats && stats.cpu_stats;
  const preCpuStats = stats && stats.precpu_stats;
  if (!cpuStats || !preCpuStats) return null;

  const cpuDelta = cpuStats.cpu_usage.total_usage - preCpuStats.cpu_usage.total_usage;
  const systemDelta = cpuStats.system_cpu_usage - preCpuStats.system_cpu_usage;
  const onlineCpus =
    cpuStats.online_cpus ||
    (cpuStats.cpu_usage.percpu_usage ? cpuStats.cpu_usage.percpu_usage.length : 1);

  if (systemDelta > 0 && cpuDelta > 0) {
    const percent = (cpuDelta / systemDelta) * onlineCpus * 100;
    return Math.round(percent * 10) / 10;
  }

  return 0;
}

function getMemoryUsage(stats) {
  const usage = stats && stats.memory_stats && stats.memory_stats.usage;
  if (!Number.isFinite(usage)) return null;
  const cache = stats && stats.memory_stats && stats.memory_stats.stats && stats.memory_stats.stats.cache;
  const used = usage - (Number.isFinite(cache) ? cache : 0);
  return used >= 0 ? used : usage;
}

function getContainerName(container) {
  const names = Array.isArray(container.Names) ? container.Names : [];
  const rawName = names[0] || container.Id || 'container';
  return rawName.startsWith('/') ? rawName.slice(1) : rawName;
}

function getHealth(status) {
  if (!status) return null;
  if (/unhealthy/i.test(status)) return 'unhealthy';
  if (/healthy/i.test(status)) return 'healthy';
  if (/starting/i.test(status)) return 'starting';
  return null;
}

async function getDockerStatus() {
  try {
    const containers = await fetchContainers();
    const statsList = await Promise.all(
      containers.map((container) => {
        if (container.State !== 'running') return Promise.resolve(null);
        return fetchContainerStats(container.Id);
      })
    );

    const items = containers.map((container, index) => {
      const stats = statsList[index];
      return {
        id: container.Id,
        name: getContainerName(container),
        status: container.Status || container.State || 'unknown',
        state: container.State || 'unknown',
        health: getHealth(container.Status),
        cpuPercent: computeCpuPercent(stats),
        memoryBytes: getMemoryUsage(stats)
      };
    });

    const hasIssues = items.some(
      (container) => container.state !== 'running' || container.health === 'unhealthy'
    );

    return {
      ok: true,
      containers: items,
      hasIssues
    };
  } catch (error) {
    return {
      ok: false,
      message: 'Docker offline',
      containers: [],
      hasIssues: true
    };
  }
}

router.get('/', async (req, res) => {
  const payload = await getDockerStatus();
  res.json(payload);
});

module.exports = { router, getDockerStatus };
