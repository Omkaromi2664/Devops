const express = require('express');
const axios = require('axios');

const router = express.Router();

const JENKINS_URL = process.env.JENKINS_URL || 'http://localhost:8080';
const JENKINS_USER = process.env.JENKINS_USER || '';
const JENKINS_TOKEN = process.env.JENKINS_TOKEN || '';
const BUILD_WINDOW_MINUTES = Number(process.env.JENKINS_BUILD_WINDOW_MINUTES || 60);

function getBuildWindowMs() {
  if (!Number.isFinite(BUILD_WINDOW_MINUTES) || BUILD_WINDOW_MINUTES <= 0) {
    return 60 * 60 * 1000;
  }
  return BUILD_WINDOW_MINUTES * 60 * 1000;
}

function buildAxiosConfig() {
  const config = { timeout: 3000 };
  if (JENKINS_USER && JENKINS_TOKEN) {
    config.auth = { username: JENKINS_USER, password: JENKINS_TOKEN };
  }
  return config;
}

async function getJenkinsStatus() {
  try {
    const url = `${JENKINS_URL}/api/json?tree=jobs[name,builds[number,result,timestamp,building]{0,5}]`;
    const response = await axios.get(url, buildAxiosConfig());
    const jobs = Array.isArray(response.data.jobs) ? response.data.jobs : [];
    const builds = [];

    jobs.forEach((job) => {
      const jobBuilds = Array.isArray(job.builds) ? job.builds : [];
      jobBuilds.forEach((build) => {
        builds.push({
          job: job.name,
          number: build.number,
          result: build.result || null,
          building: Boolean(build.building),
          timestamp: build.timestamp || null
        });
      });
    });

    const cutoff = Date.now() - getBuildWindowMs();
    const recentBuilds = builds.filter((build) => {
      const timestamp = Number(build.timestamp || 0);
      if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
      return timestamp >= cutoff;
    });

    recentBuilds.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return {
      ok: true,
      builds: recentBuilds.slice(0, 5)
    };
  } catch (error) {
    return {
      ok: false,
      message: 'Jenkins offline',
      builds: []
    };
  }
}

router.get('/', async (req, res) => {
  const payload = await getJenkinsStatus();
  res.json(payload);
});

module.exports = { router, getJenkinsStatus };
