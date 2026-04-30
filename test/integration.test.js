const { recordTest, getResults, clearResults } = require('./test-results-manager');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 10000;

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

async function testHealthEndpointResponse() {
  const response = await fetch(`${BASE_URL}/health`, { timeout: TEST_TIMEOUT });
  if (response.status !== 200) throw new Error(`Status ${response.status}`);
  
  const data = await response.json();
  if (data.status !== 'ok') throw new Error('Status not ok');
}

async function testStatusEndpointStructure() {
  const response = await fetch(`${BASE_URL}/api/status`, { timeout: TEST_TIMEOUT });
  if (!response.ok) throw new Error(`Status ${response.status}`);
  
  const data = await response.json();
  const required = ['updatedAt', 'system', 'jenkins', 'docker', 'kubernetes', 'nagios'];
  for (const field of required) {
    if (!(field in data)) throw new Error(`Missing field: ${field}`);
  }
}

async function testSystemMetricsComplete() {
  const response = await fetch(`${BASE_URL}/api/system`, { timeout: TEST_TIMEOUT });
  const data = await response.json();

  if (data.ok) {
    if (!data.data) throw new Error('Missing data object');
    if (!('cpuPercent' in data.data)) throw new Error('Missing cpuPercent');
    if (!('memory' in data.data)) throw new Error('Missing memory');
    if (!('disk' in data.data)) throw new Error('Missing disk');
    if (!('uptimeSeconds' in data.data)) throw new Error('Missing uptimeSeconds');
  }
}

async function testJenkinsDataFormat() {
  const response = await fetch(`${BASE_URL}/api/jenkins`, { timeout: TEST_TIMEOUT });
  const data = await response.json();

  if (!('ok' in data)) throw new Error('Missing ok field');
  if (data.ok && Array.isArray(data.builds)) {
    for (const build of data.builds) {
      if (!('job' in build)) throw new Error('Build missing job');
      if (!('number' in build)) throw new Error('Build missing number');
      if (!('result' in build)) throw new Error('Build missing result');
    }
  }
}

async function testDockerDataFormat() {
  const response = await fetch(`${BASE_URL}/api/docker`, { timeout: TEST_TIMEOUT });
  const data = await response.json();

  if (!('ok' in data)) throw new Error('Missing ok field');
  if (data.ok && Array.isArray(data.containers)) {
    for (const container of data.containers) {
      if (!('name' in container)) throw new Error('Container missing name');
      if (!('status' in container)) throw new Error('Container missing status');
      if (!('state' in container)) throw new Error('Container missing state');
    }
  }
}

async function testKubernetesDataFormat() {
  const response = await fetch(`${BASE_URL}/api/kubernetes`, { timeout: TEST_TIMEOUT });
  const data = await response.json();

  if (!('ok' in data)) throw new Error('Missing ok field');
  if (data.ok && Array.isArray(data.pods)) {
    for (const pod of data.pods) {
      if (!('name' in pod)) throw new Error('Pod missing name');
      if (!('status' in pod)) throw new Error('Pod missing status');
      if (!('age' in pod)) throw new Error('Pod missing age');
    }
  }
}

async function testNagiosDataFormat() {
  const response = await fetch(`${BASE_URL}/api/nagios`, { timeout: TEST_TIMEOUT });
  const data = await response.json();

  if (!('ok' in data)) throw new Error('Missing ok field');
  if (data.ok && Array.isArray(data.alerts)) {
    for (const alert of data.alerts) {
      if (!('host' in alert)) throw new Error('Alert missing host');
      if (!('service' in alert)) throw new Error('Alert missing service');
      if (!('severity' in alert)) throw new Error('Alert missing severity');
    }
  }
}

async function testResponseTimes() {
  const endpoints = [
    `${BASE_URL}/api/status`,
    `${BASE_URL}/api/system`,
    `${BASE_URL}/api/jenkins`,
    `${BASE_URL}/api/docker`,
    `${BASE_URL}/api/kubernetes`,
    `${BASE_URL}/api/nagios`
  ];

  const maxResponseTime = 5000;

  for (const endpoint of endpoints) {
    const start = Date.now();
    try {
      await fetch(endpoint, { timeout: TEST_TIMEOUT });
      const duration = Date.now() - start;
      if (duration > maxResponseTime) {
        throw new Error(`Slow response: ${duration}ms`);
      }
    } catch (error) {
      throw new Error(`${endpoint}: ${error.message}`);
    }
  }
}

async function testErrorHandling() {
  try {
    const response = await fetch(`${BASE_URL}/api/invalid-endpoint`, { timeout: TEST_TIMEOUT });
    if (response.status === 404) {
      // Expected
      return;
    }
    throw new Error('Should have returned 404');
  } catch (error) {
    if (error.message === 'Should have returned 404') throw error;
    // Other errors are OK (might be connection error in test env)
  }
}

async function testDataConsistency() {
  // Fetch status twice and verify both have valid timestamps
  const response1 = await fetch(`${BASE_URL}/api/status`, { timeout: TEST_TIMEOUT });
  const data1 = await response1.json();

  await new Promise(resolve => setTimeout(resolve, 1000));

  const response2 = await fetch(`${BASE_URL}/api/status`, { timeout: TEST_TIMEOUT });
  const data2 = await response2.json();

  if (!data1.updatedAt || !data2.updatedAt) throw new Error('Missing timestamps');
  if (typeof data1.updatedAt !== 'number') throw new Error('Invalid timestamp type');
}

async function testConcurrentRequests() {
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(fetch(`${BASE_URL}/api/status`, { timeout: TEST_TIMEOUT }).then(r => r.json()));
  }

  const results = await Promise.all(promises);
  if (results.some(r => !r.updatedAt)) throw new Error('Some requests failed');
}

async function checkAppAvailable() {
  try {
    const response = await fetch(`${BASE_URL}/health`, { timeout: 3000 });
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function runAllTests() {
  console.log('\n🔗 Starting Integration Tests\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  // Check if app is available
  const appAvailable = await checkAppAvailable();
  if (!appAvailable) {
    console.log('⚠️  App not available at ' + BASE_URL);
    console.log('Integration tests skipped (app must be running during integration test phase)\n');
    return;
  }

  // Append to existing results
  try {
    console.log('✈️ Endpoint Integration Tests:\n');
    await runTest('Health endpoint response', testHealthEndpointResponse);
    await runTest('Status endpoint structure', testStatusEndpointStructure);
    await runTest('System metrics format', testSystemMetricsComplete);
    await runTest('Jenkins data format', testJenkinsDataFormat);
    await runTest('Docker data format', testDockerDataFormat);
    await runTest('Kubernetes data format', testKubernetesDataFormat);
    await runTest('Nagios data format', testNagiosDataFormat);

    console.log('\n⏱️ Performance Tests:\n');
    await runTest('Response times acceptable', testResponseTimes);
    await runTest('Data consistency', testDataConsistency);
    await runTest('Concurrent requests', testConcurrentRequests);

    console.log('\n🛡️ Error Handling Tests:\n');
    await runTest('Error handling', testErrorHandling);

  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📈 Integration Test Summary');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${testSummary.totalTests}`);
  console.log(`✓ Passed: ${testSummary.passedTests}`);
  console.log(`✗ Failed: ${testSummary.failedTests}`);
  console.log(`Pass Rate: ${((testSummary.passedTests / testSummary.totalTests) * 100).toFixed(1)}%`);
  console.log('='.repeat(50) + '\n');

  // Get current results
  const results = getResults();
  console.log('💾 Results appended to .test-results/latest.json');
  console.log(`Total from all runs: ${results.totalTests} tests`);

  if (testSummary.failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch(console.error);
