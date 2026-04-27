const express = require('express');
const axios = require('axios');

const router = express.Router();

const JENKINS_URL = process.env.JENKINS_URL || 'http://localhost:8080';

async function getJenkinsStatus() {
  try {
    const url = `${JENKINS_URL}/api/json?tree=jobs[name,builds[number,result,timestamp,building]{0,5}]`;
    const response = await axios.get(url, { timeout: 3000 });
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

    builds.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return {
      ok: true,
      builds: builds.slice(0, 5)
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
