const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, '..', '.test-results');
const RESULTS_FILE = path.join(RESULTS_DIR, 'latest.json');

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

function getResults() {
  if (!fs.existsSync(RESULTS_FILE)) {
    return {
      ok: false,
      message: 'No test results available',
      tests: [],
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      lastRun: null
    };
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
  getResults,
  recordTest,
  clearResults,
  ensureResultsDir
};
