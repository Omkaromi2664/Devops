const { getSystemStatus } = require('./system');
const { getJenkinsStatus } = require('./jenkins');
const { getDockerStatus } = require('./docker');
const { getKubernetesStatus } = require('./kubernetes');
const { getNagiosStatus } = require('./nagios');
const { getResults: getTestResults } = require('../util/results-manager');

function getTestStatus() {
  try {
    const results = getTestResults();
    return {
      ok: results.totalTests > 0 && results.failedTests === 0,
      totalTests: results.totalTests,
      passedTests: results.passedTests,
      failedTests: results.failedTests,
      passRate: results.totalTests > 0 
        ? Math.round((results.passedTests / results.totalTests) * 100) 
        : 0,
      lastRun: results.lastRun,
      runDate: results.runDate
    };
  } catch (error) {
    return {
      ok: false,
      message: 'Test results unavailable',
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      passRate: 0
    };
  }
}

async function getFullStatus() {
  const results = await Promise.allSettled([
    getSystemStatus(),
    getJenkinsStatus(),
    getDockerStatus(),
    getKubernetesStatus(),
    getNagiosStatus()
  ]);

  const [system, jenkins, docker, kubernetes, nagios] = results.map((result) =>
    result.status === 'fulfilled'
      ? result.value
      : { ok: false, message: 'Service offline' }
  );

  const tests = getTestStatus();

  return {
    updatedAt: Date.now(),
    system,
    jenkins,
    docker,
    kubernetes,
    nagios,
    tests
  };
}

module.exports = { getFullStatus };
