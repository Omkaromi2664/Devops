const express = require('express');
const os = require('os');
const fs = require('fs');

const router = express.Router();

function cpuAverage() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  cpus.forEach((cpu) => {
    const times = cpu.times;
    Object.keys(times).forEach((type) => {
      total += times[type];
    });
    idle += times.idle;
  });

  return { idle, total };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCpuUsagePercent() {
  const start = cpuAverage();
  await sleep(100);
  const end = cpuAverage();
  const idleDelta = end.idle - start.idle;
  const totalDelta = end.total - start.total;
  if (totalDelta <= 0) return 0;
  const usage = (1 - idleDelta / totalDelta) * 100;
  return Math.round(usage * 10) / 10;
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

async function getDiskUsage(path) {
  const stats = await fs.promises.statfs(path);
  const totalBytes = stats.blocks * stats.bsize;
  const freeBytes = stats.bfree * stats.bsize;
  return { usedBytes: totalBytes - freeBytes, totalBytes };
}

async function getSystemStatus() {
  try {
    const cpuPercent = await getCpuUsagePercent();
    const [loadAverage1m] = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const uptimeSeconds = os.uptime();
    const disk = await getDiskUsage('/');

    return {
      ok: true,
      data: {
        cpuPercent,
        loadAverage1m,
        memory: {
          usedBytes: totalMem - freeMem,
          totalBytes: totalMem
        },
        disk,
        uptimeSeconds,
        uptimeHuman: formatUptime(uptimeSeconds)
      }
    };
  } catch (error) {
    return {
      ok: false,
      message: 'System metrics unavailable',
      data: {}
    };
  }
}

router.get('/', async (req, res) => {
  const payload = await getSystemStatus();
  res.json(payload);
});

module.exports = { router, getSystemStatus };
