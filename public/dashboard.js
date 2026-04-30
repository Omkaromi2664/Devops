const elements = {
  systemUpdated: document.getElementById('system-updated'),
  systemCpu: document.getElementById('system-cpu'),
  systemRam: document.getElementById('system-ram'),
  systemDisk: document.getElementById('system-disk'),
  systemUptime: document.getElementById('system-uptime'),
  testsBadge: document.getElementById('tests-badge'),
  testsTotal: document.getElementById('tests-total'),
  testsRate: document.getElementById('tests-rate'),
  testsPassed: document.getElementById('tests-passed'),
  testsFailed: document.getElementById('tests-failed'),
  testsLastrun: document.getElementById('tests-lastrun'),
  testsDetails: document.getElementById('tests-details'),
  testsRecent: document.getElementById('tests-recent'),
  jenkinsBadge: document.getElementById('jenkins-badge'),
  jenkinsList: document.getElementById('jenkins-list'),
  dockerBadge: document.getElementById('docker-badge'),
  dockerBody: document.getElementById('docker-table-body'),
  k8sBadge: document.getElementById('k8s-badge'),
  k8sBody: document.getElementById('k8s-table-body'),
  nagiosBadge: document.getElementById('nagios-badge'),
  nagiosList: document.getElementById('nagios-list')
};

function setBadge(element, level, text) {
  if (!element) return;
  element.className = `badge ${level}`;
  element.textContent = text;
}

function setPill(element, level, text) {
  element.className = `pill ${level}`;
  element.textContent = text;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '--';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Math.max(bytes, 0);
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const digits = value < 10 && index > 0 ? 1 : 0;
  return `${value.toFixed(digits)} ${units[index]}`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '--';
  return `${value.toFixed(1)}%`;
}

function formatDate(timestamp) {
  if (!timestamp) return '--';
  return new Date(timestamp).toLocaleString();
}

function formatUptime(seconds) {
  if (!Number.isFinite(seconds)) return '--';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function clearChildren(element) {
  if (!element) return;
  element.replaceChildren();
}

function addEmptyRow(element, message, className) {
  const row = document.createElement('div');
  row.className = className || 'data-item failed';
  row.textContent = message;
  element.appendChild(row);
}

function updateSystem(system, updatedAt) {
  if (!system || !system.ok) {
    setBadge(elements.systemUpdated, 'danger', 'System offline');
    if (elements.systemCpu) elements.systemCpu.textContent = '--';
    if (elements.systemRam) elements.systemRam.textContent = '--';
    if (elements.systemDisk) elements.systemDisk.textContent = '--';
    if (elements.systemUptime) elements.systemUptime.textContent = '--';
    return;
  }

  const data = system.data || {};
  const memory = data.memory || {};
  const disk = data.disk || {};

  if (elements.systemCpu) elements.systemCpu.textContent = formatPercent(data.cpuPercent);
  if (elements.systemRam) {
    elements.systemRam.textContent = `${formatBytes(memory.usedBytes)} / ${formatBytes(memory.totalBytes)}`;
  }
  if (elements.systemDisk) {
    elements.systemDisk.textContent = `${formatBytes(disk.usedBytes)} / ${formatBytes(disk.totalBytes)}`;
  }
  if (elements.systemUptime) {
    elements.systemUptime.textContent = data.uptimeHuman || formatUptime(data.uptimeSeconds);
  }

  const label = updatedAt ? `Last updated: ${new Date(updatedAt).toLocaleTimeString()}` : 'Live';
  setBadge(elements.systemUpdated, 'neutral', label);
}

function updateTests(tests) {
  if (!tests) {
    setBadge(elements.testsBadge, 'neutral', 'No data');
    if (elements.testsTotal) elements.testsTotal.textContent = '--';
    if (elements.testsRate) elements.testsRate.textContent = '--';
    if (elements.testsPassed) elements.testsPassed.textContent = '--';
    if (elements.testsFailed) elements.testsFailed.textContent = '--';
    return;
  }

  const totalTests = tests.totalTests || 0;
  const passedTests = tests.passedTests || 0;
  const failedTests = tests.failedTests || 0;
  const passRate = tests.passRate || 0;
  const lastRun = tests.lastRun;

  // Update badge
  let badgeLevel = 'neutral';
  let badgeText = 'No runs';
  if (totalTests > 0) {
    badgeLevel = failedTests === 0 ? 'ok' : 'danger';
    badgeText = failedTests === 0 ? 'Passing' : `${failedTests} Failed`;
  }
  setBadge(elements.testsBadge, badgeLevel, badgeText);

  // Update metrics
  if (elements.testsTotal) elements.testsTotal.textContent = totalTests || '--';
  if (elements.testsRate) elements.testsRate.textContent = totalTests > 0 ? `${passRate}%` : '--';
  if (elements.testsPassed) elements.testsPassed.textContent = passedTests || '--';
  if (elements.testsFailed) elements.testsFailed.textContent = failedTests || '--';

  // Update last run time
  if (elements.testsLastrun) {
    if (lastRun) {
      const runDate = new Date(lastRun);
      elements.testsLastrun.textContent = `Last run: ${runDate.toLocaleTimeString()}`;
    } else {
      elements.testsLastrun.textContent = 'Last run: Never';
    }
  }

  // Show recent failed tests if any
  if (elements.testsDetails && elements.testsRecent) {
    const recentFailed = (tests.recentTests || [])
      .filter(t => !t.passed)
      .slice(0, 3);
    
    if (recentFailed.length > 0) {
      elements.testsDetails.style.display = 'block';
      elements.testsRecent.textContent = recentFailed.map(t => t.name).join(', ');
    } else {
      elements.testsDetails.style.display = 'none';
    }
  }
}

function updateJenkins(jenkins) {
  clearChildren(elements.jenkinsList);

  if (!jenkins || !jenkins.ok) {
    setBadge(elements.jenkinsBadge, 'danger', 'Offline');
    addEmptyRow(elements.jenkinsList, 'Jenkins offline', 'data-item failed');
    return;
  }

  setBadge(elements.jenkinsBadge, 'ok', 'Online');
  const builds = jenkins.builds || [];

  if (!builds.length) {
    addEmptyRow(elements.jenkinsList, 'No builds found', 'data-item running');
    return;
  }

  builds.forEach((build) => {
    const item = document.createElement('li');
    const status = (build.result || '').toUpperCase();
    const isBuilding = build.building || status === '';
    let itemClass = 'success';
    let pillClass = 'ok';
    let label = status || 'IN PROGRESS';

    if (isBuilding) {
      itemClass = 'running';
      pillClass = 'warn';
      label = 'In progress';
    } else if (status !== 'SUCCESS') {
      itemClass = 'failed';
      pillClass = 'danger';
      label = status || 'Failed';
    } else {
      label = 'Success';
    }

    item.className = `data-item ${itemClass}`;

    const info = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = `#${build.number || '--'}`;
    info.appendChild(strong);
    info.appendChild(document.createTextNode(` ${build.job || 'Build'}`));
    info.appendChild(document.createElement('br'));

    const small = document.createElement('small');
    small.textContent = build.job || 'Jenkins job';
    info.appendChild(small);

    const pill = document.createElement('span');
    setPill(pill, pillClass, label);

    const time = document.createElement('small');
    time.textContent = formatDate(build.timestamp);

    item.appendChild(info);
    item.appendChild(pill);
    item.appendChild(time);

    elements.jenkinsList.appendChild(item);
  });
}

function updateDocker(docker) {
  if (!elements.dockerBody) return;
  elements.dockerBody.replaceChildren();

  if (!docker || !docker.ok) {
    setBadge(elements.dockerBadge, 'danger', 'Offline');
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = 'Docker offline';
    row.appendChild(cell);
    elements.dockerBody.appendChild(row);
    return;
  }

  const containers = docker.containers || [];
  const badgeLevel = docker.hasIssues ? 'warn' : 'ok';
  const badgeText = docker.hasIssues ? 'Attention' : 'Healthy';
  setBadge(elements.dockerBadge, badgeLevel, badgeText);

  if (!containers.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = 'No running containers';
    row.appendChild(cell);
    elements.dockerBody.appendChild(row);
    return;
  }

  containers.forEach((container) => {
    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    nameCell.textContent = container.name || 'container';

    const statusCell = document.createElement('td');
    const pill = document.createElement('span');
    const state = (container.state || '').toLowerCase();
    const unhealthy = (container.health || '').toLowerCase() === 'unhealthy' || /unhealthy/i.test(container.status || '');
    let pillClass = 'warn';
    let label = container.status || 'Unknown';

    if (unhealthy) {
      pillClass = 'danger';
      label = 'Unhealthy';
    } else if (state === 'running') {
      pillClass = 'ok';
      label = 'Running';
    }

    setPill(pill, pillClass, label);
    statusCell.appendChild(pill);

    const cpuCell = document.createElement('td');
    cpuCell.textContent = formatPercent(container.cpuPercent);

    const memoryCell = document.createElement('td');
    memoryCell.textContent = formatBytes(container.memoryBytes);

    row.appendChild(nameCell);
    row.appendChild(statusCell);
    row.appendChild(cpuCell);
    row.appendChild(memoryCell);

    elements.dockerBody.appendChild(row);
  });
}

function updateK8s(kubernetes) {
  if (!elements.k8sBody) return;
  elements.k8sBody.replaceChildren();

  if (!kubernetes || !kubernetes.ok) {
    setBadge(elements.k8sBadge, 'danger', 'Offline');
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 3;
    cell.textContent = 'Kubernetes offline';
    row.appendChild(cell);
    elements.k8sBody.appendChild(row);
    return;
  }

  const pods = kubernetes.pods || [];
  setBadge(elements.k8sBadge, 'ok', 'Stable');

  if (!pods.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 3;
    cell.textContent = 'No pods found';
    row.appendChild(cell);
    elements.k8sBody.appendChild(row);
    return;
  }

  pods.forEach((pod) => {
    const row = document.createElement('tr');

    const nameCell = document.createElement('td');
    nameCell.textContent = pod.name || 'pod';

    const statusCell = document.createElement('td');
    const pill = document.createElement('span');
    const status = (pod.status || '').toLowerCase();
    let pillClass = 'ok';
    if (status === 'pending') pillClass = 'warn';
    if (status === 'crashloopbackoff' || status === 'failed') pillClass = 'danger';
    setPill(pill, pillClass, pod.status || 'Unknown');
    statusCell.appendChild(pill);

    const ageCell = document.createElement('td');
    ageCell.textContent = pod.age || '--';

    row.appendChild(nameCell);
    row.appendChild(statusCell);
    row.appendChild(ageCell);

    elements.k8sBody.appendChild(row);
  });
}

function updateNagios(nagios) {
  if (!elements.nagiosList) return;
  clearChildren(elements.nagiosList);

  if (!nagios || !nagios.ok) {
    setBadge(elements.nagiosBadge, 'danger', 'Offline');
    const item = document.createElement('div');
    item.className = 'alert-item critical';
    item.textContent = 'Nagios offline';
    elements.nagiosList.appendChild(item);
    return;
  }

  const alerts = nagios.alerts || [];
  setBadge(elements.nagiosBadge, alerts.length ? 'warn' : 'ok', `${alerts.length} recent alerts`);

  if (!alerts.length) {
    const item = document.createElement('div');
    item.className = 'alert-item ok';
    item.textContent = 'No recent alerts';
    elements.nagiosList.appendChild(item);
    return;
  }

  alerts.forEach((alert) => {
    const item = document.createElement('div');
    const severity = (alert.severity || 'ok').toLowerCase();
    let itemClass = 'ok';
    let pillClass = 'ok';
    let label = 'OK';

    if (severity === 'critical') {
      itemClass = 'critical';
      pillClass = 'danger';
      label = 'Critical';
    } else if (severity === 'warning') {
      itemClass = 'warning';
      pillClass = 'warn';
      label = 'Warning';
    }

    item.className = `alert-item ${itemClass}`;

    const host = document.createElement('div');
    const hostStrong = document.createElement('strong');
    hostStrong.textContent = alert.host || 'host';
    host.appendChild(hostStrong);

    const service = document.createElement('div');
    service.textContent = alert.service || 'service';

    const pill = document.createElement('span');
    setPill(pill, pillClass, label);

    const time = document.createElement('small');
    time.textContent = formatDate(alert.timestamp);

    item.appendChild(host);
    item.appendChild(service);
    item.appendChild(pill);
    item.appendChild(time);

    elements.nagiosList.appendChild(item);
  });
}

function applyStatus(payload) {
  if (!payload) return;
  updateSystem(payload.system, payload.updatedAt);
  updateTests(payload.tests);
  updateJenkins(payload.jenkins);
  updateDocker(payload.docker);
  updateK8s(payload.kubernetes);
  updateNagios(payload.nagios);
}

async function fetchOnce() {
  try {
    const response = await fetch('/api/status');
    if (!response.ok) return;
    const payload = await response.json();
    applyStatus(payload);
  } catch (error) {
    setBadge(elements.systemUpdated, 'danger', 'Disconnected');
  }
}

function connectSocket() {
  if (!('WebSocket' in window)) return;
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = new WebSocket(`${protocol}://${window.location.host}`);

  socket.addEventListener('message', (event) => {
    try {
      const payload = JSON.parse(event.data);
      applyStatus(payload);
    } catch (error) {
      setBadge(elements.systemUpdated, 'danger', 'Bad data');
    }
  });

  socket.addEventListener('close', () => {
    setBadge(elements.systemUpdated, 'danger', 'Disconnected');
  });

  socket.addEventListener('error', () => {
    setBadge(elements.systemUpdated, 'danger', 'Connection error');
  });
}

fetchOnce();
connectSocket();
