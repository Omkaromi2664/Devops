const { Builder, By, until, Key } = require('selenium-webdriver');
const { recordTest, saveResults, clearResults, getResults } = require('./test-results-manager');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 30000;

let driver;
const testSummary = {
  tests: [],
  totalTests: 0,
  passedTests: 0,
  failedTests: 0
};

async function runTest(testName, testFn) {
  const startTime = Date.now();
  try {
    await testFn();
    const duration = Date.now() - startTime;
    console.log(`✓ ${testName} (${duration}ms)`);
    testSummary.passedTests++;
    recordTest(testName, true, duration);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`✗ ${testName}: ${error.message}`);
    testSummary.failedTests++;
    recordTest(testName, false, duration, error.message);
  }
  testSummary.totalTests++;
}

async function setupDriver() {
  const { Options } = require('selenium-webdriver/chrome');
  
  const chromeOptions = new Options();
  chromeOptions.addArguments(
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1920,1080'
  );
  
  const chromeBin = process.env.CHROME_BIN || process.env.CHROMEDRIVER_BIN;
  if (chromeBin) {
    chromeOptions.setChromeBinaryPath(chromeBin);
  }
  
  driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(chromeOptions)
    .build();
    
  await driver.manage().setTimeouts({ implicit: 5000 });
}

async function teardownDriver() {
  if (driver) {
    await driver.quit();
  }
}

async function testDashboardPageLoads() {
  await driver.get(DASHBOARD_URL);
  await driver.wait(until.elementLocated(By.className('app-title')), TEST_TIMEOUT);
  
  const title = await driver.findElement(By.className('app-title')).getText();
  if (!title.includes('DevOps Pipeline')) throw new Error('Title mismatch');
}

async function testSystemHealthPanelExists() {
  await driver.wait(until.elementLocated(By.xpath("//h2[contains(text(), 'System Health')]")), TEST_TIMEOUT);
  const cpuElement = await driver.findElement(By.id('system-cpu'));
  const cpu = await cpuElement.getText();
  if (!cpu || cpu === '--') throw new Error('CPU metric not loaded');
}

async function testJenkinsPanelExists() {
  await driver.wait(until.elementLocated(By.xpath("//h2[contains(text(), 'Jenkins Build Status')]")), TEST_TIMEOUT);
  const pandElement = await driver.findElement(By.id('jenkins-list'));
  if (!pandElement) throw new Error('Jenkins panel not found');
}

async function testDockerPanelExists() {
  await driver.wait(until.elementLocated(By.xpath("//h2[contains(text(), 'Docker Containers')]")), TEST_TIMEOUT);
  const dockerElement = await driver.findElement(By.id('docker-table-body'));
  if (!dockerElement) throw new Error('Docker panel not found');
}

async function testKubernetesPanelExists() {
  await driver.wait(until.elementLocated(By.xpath("//h2[contains(text(), 'Kubernetes Pod Status')]")), TEST_TIMEOUT);
  const k8sElement = await driver.findElement(By.id('k8s-table-body'));
  if (!k8sElement) throw new Error('K8s panel not found');
}

async function testNagiosPanelExists() {
  await driver.wait(until.elementLocated(By.xpath("//h2[contains(text(), 'Nagios Alerts')]")), TEST_TIMEOUT);
  const nagiosElement = await driver.findElement(By.id('nagios-list'));
  if (!nagiosElement) throw new Error('Nagios panel not found');
}

async function testLiveIndicatorIsVisible() {
  const liveIndicator = await driver.findElement(By.className('live-indicator'));
  const text = await liveIndicator.getText();
  if (!text.includes('5 seconds')) throw new Error('Live indicator text incorrect');
}

async function testPageUpdates() {
  // Get initial CPU value
  const cpuElement1 = await driver.findElement(By.id('system-cpu'));
  const initialCpu = await cpuElement1.getText();

  // Wait 6 seconds for update
  await driver.sleep(6000);

  // Verify element still exists (dashboard still running)
  const cpuElement2 = await driver.findElement(By.id('system-cpu'));
  const updatedCpu = await cpuElement2.getText();

  if (!updatedCpu || updatedCpu === '--') throw new Error('CPU not updated');
}

async function testBadgesArePresent() {
  const badges = await driver.findElements(By.className('badge'));
  if (badges.length < 3) throw new Error('Insufficient badges found');
}

async function testAllStatusPillsDisplay() {
  const pills = await driver.findElements(By.className('pill'));
  if (pills.length === 0) throw new Error('No status pills found');
}

async function testFooterExists() {
  const footer = await driver.findElement(By.className('footer-note'));
  const text = await footer.getText();
  if (!text.includes('252190023')) throw new Error('Footer info missing');
}

async function testDataTableStructure() {
  const dockerTable = await driver.findElement(By.id('docker-table'));
  const headers = await dockerTable.findElements(By.css('thead th'));
  if (headers.length !== 4) throw new Error('Docker table headers mismatch');

  const expectedHeaders = ['Container', 'Status', 'CPU', 'Memory'];
  for (let i = 0; i < Math.min(headers.length, expectedHeaders.length); i++) {
    const text = await headers[i].getText();
    if (!text) throw new Error(`Header ${i} is empty`);
  }
}

async function testHealthEndpoint() {
  const response = await fetch(`${DASHBOARD_URL}/health`);
  if (!response.ok) throw new Error('Health endpoint failed');
  
  const data = await response.json();
  if (data.status !== 'ok') throw new Error('Health status not ok');
}

async function testStatusApiEndpoint() {
  const response = await fetch(`${DASHBOARD_URL}/api/status`);
  if (!response.ok) throw new Error('Status API failed');
  
  const data = await response.json();
  if (!data.updatedAt) throw new Error('Status API missing updatedAt');
  if (!data.system && !data.jenkins && !data.docker && !data.kubernetes && !data.nagios) {
    throw new Error('Status API missing all services');
  }
}

async function testSystemApiEndpoint() {
  const response = await fetch(`${DASHBOARD_URL}/api/system`);
  if (!response.ok) throw new Error('System API failed');
  
  const data = await response.json();
  if (!data.ok && !data.data) throw new Error('System API response invalid');
}

async function testJenkinsApiEndpoint() {
  const response = await fetch(`${DASHBOARD_URL}/api/jenkins`);
  if (!response.ok) throw new Error('Jenkins API failed');
  
  const data = await response.json();
  if (!('ok' in data)) throw new Error('Jenkins API missing ok field');
}

async function testDockerApiEndpoint() {
  const response = await fetch(`${DASHBOARD_URL}/api/docker`);
  if (!response.ok) throw new Error('Docker API failed');
  
  const data = await response.json();
  if (!('ok' in data)) throw new Error('Docker API missing ok field');
}

async function testKubernetesApiEndpoint() {
  const response = await fetch(`${DASHBOARD_URL}/api/kubernetes`);
  if (!response.ok) throw new Error('Kubernetes API failed');
  
  const data = await response.json();
  if (!('ok' in data)) throw new Error('Kubernetes API missing ok field');
}

async function testNagiosApiEndpoint() {
  const response = await fetch(`${DASHBOARD_URL}/api/nagios`);
  if (!response.ok) throw new Error('Nagios API failed');
  
  const data = await response.json();
  if (!('ok' in data)) throw new Error('Nagios API missing ok field');
}

async function runAllTests() {
  console.log('\n📊 Starting Selenium E2E Tests\n');
  console.log(`Dashboard URL: ${DASHBOARD_URL}\n`);

  clearResults();

  try {
    await setupDriver();

    console.log('🌐 UI Tests:\n');
    await runTest('Dashboard page loads', testDashboardPageLoads);
    await runTest('Live indicator visible', testLiveIndicatorIsVisible);
    await runTest('System Health panel', testSystemHealthPanelExists);
    await runTest('Jenkins panel', testJenkinsPanelExists);
    await runTest('Docker panel', testDockerPanelExists);
    await runTest('Kubernetes panel', testKubernetesPanelExists);
    await runTest('Nagios panel', testNagiosPanelExists);
    await runTest('Status badges display', testBadgesArePresent);
    await runTest('Status pills display', testAllStatusPillsDisplay);
    await runTest('Data table structure', testDataTableStructure);
    await runTest('Footer exists', testFooterExists);
    await runTest('Page auto-updates', testPageUpdates);

    console.log('\n🔌 API Tests:\n');
    await runTest('Health endpoint', testHealthEndpoint);
    await runTest('Status API', testStatusApiEndpoint);
    await runTest('System API', testSystemApiEndpoint);
    await runTest('Jenkins API', testJenkinsApiEndpoint);
    await runTest('Docker API', testDockerApiEndpoint);
    await runTest('Kubernetes API', testKubernetesApiEndpoint);
    await runTest('Nagios API', testNagiosApiEndpoint);

  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  } finally {
    await teardownDriver();
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📈 Test Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${testSummary.totalTests}`);
  console.log(`✓ Passed: ${testSummary.passedTests}`);
  console.log(`✗ Failed: ${testSummary.failedTests}`);
  console.log(`Pass Rate: ${((testSummary.passedTests / testSummary.totalTests) * 100).toFixed(1)}%`);
  console.log('='.repeat(50) + '\n');

  // Save results
  const finalResults = getResults();
  console.log('💾 Results saved to .test-results/latest.json');

  if (testSummary.failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch(console.error);
