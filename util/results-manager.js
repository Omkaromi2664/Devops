const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, '..', '.test-results');
const RESULTS_FILE = path.join(RESULTS_DIR, 'latest.json');

function createEmptyResults() {
  return {
    timestamp: Date.now(),
    runDate: new Date().toISOString(),
    tests: [],
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    lastRun: null
  };
}

function ensureResultsDir() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

function saveResults(testResults) {
  ensureResultsDir();
  const data = {
    timestamp: Date.now(),
    runDate: new Date().toISOString(),
    ...testResults
  };
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(data, null, 2));
  return data;
}

function saveRunResults(tests) {
  const normalizedTests = Array.isArray(tests) ? tests : [];
  const passedTests = normalizedTests.filter((test) => test.passed).length;
  const failedTests = normalizedTests.length - passedTests;

  return saveResults({
    tests: normalizedTests,
    totalTests: normalizedTests.length,
    passedTests,
    failedTests,
    lastRun: Date.now(),
    ok: failedTests === 0,
    passRate: normalizedTests.length > 0 ? Math.round((passedTests / normalizedTests.length) * 100) : 0
  });
}

function getResults() {
  if (!fs.existsSync(RESULTS_FILE)) {
    return createEmptyResults();
  }

  const data = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
  return data;
}

function recordTest(name, passed, duration, error = null) {
  const results = getResults();
  
  const testRecord = {
    name,
    passed,
    duration,
    timestamp: Date.now(),
    error: error || null
  };

  if (!Array.isArray(results.tests)) results.tests = [];
  results.tests.push(testRecord);

  results.totalTests = (results.totalTests || 0) + 1;
  results.passedTests = (results.passedTests || 0) + (passed ? 1 : 0);
  results.failedTests = (results.failedTests || 0) + (passed ? 0 : 1);
  results.lastRun = Date.now();
  results.runDate = new Date().toISOString();

  saveResults(results);
  return testRecord;
}

function clearResults() {
  ensureResultsDir();
  const emptyResults = {
    timestamp: Date.now(),
    runDate: new Date().toISOString(),
    tests: [],
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    lastRun: null
  };
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(emptyResults, null, 2));
}

module.exports = {
  saveResults,
  saveRunResults,
  getResults,
  recordTest,
  clearResults,
  ensureResultsDir
};
