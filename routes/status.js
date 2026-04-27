const { getSystemStatus } = require('./system');
const { getJenkinsStatus } = require('./jenkins');
const { getDockerStatus } = require('./docker');
const { getKubernetesStatus } = require('./kubernetes');
const { getNagiosStatus } = require('./nagios');

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

  return {
    updatedAt: Date.now(),
    system,
    jenkins,
    docker,
    kubernetes,
    nagios
  };
}

module.exports = { getFullStatus };
