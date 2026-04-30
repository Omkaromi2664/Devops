const express = require('express');
const { getResults } = require('../test/test-results-manager');

const router = express.Router();

router.get('/', async (req, res) => {
  const results = getResults();
  
  // Add computed fields
  results.ok = results.totalTests > 0 && results.failedTests === 0;
  results.passRate = results.totalTests > 0 
    ? Math.round((results.passedTests / results.totalTests) * 100) 
    : 0;
  results.status = results.ok ? 'passing' : 'failing';
  results.recentTests = (results.tests || []).slice(-10);
  
  res.json(results);
});

router.get('/history', async (req, res) => {
  const results = getResults();
  
  // Return format suitable for graphing
  const testsByName = {};
  
  (results.tests || []).forEach(test => {
    if (!testsByName[test.name]) {
      testsByName[test.name] = {
        name: test.name,
        runs: 0,
        passes: 0,
        failures: 0,
        avgDuration: 0,
        totalDuration: 0
      };
    }
    
    testsByName[test.name].runs++;
    if (test.passed) {
      testsByName[test.name].passes++;
    } else {
      testsByName[test.name].failures++;
    }
    testsByName[test.name].totalDuration += test.duration || 0;
  });
  
  // Calculate averages
  Object.values(testsByName).forEach(test => {
    if (test.runs > 0) {
      test.avgDuration = Math.round(test.totalDuration / test.runs);
    }
  });
  
  res.json({
    ok: results.ok,
    lastRun: results.lastRun,
    runDate: results.runDate,
    totalRuns: results.totalTests,
    statistics: Object.values(testsByName)
  });
});

router.get('/summary', async (req, res) => {
  const results = getResults();
  
  res.json({
    ok: results.totalTests > 0 && results.failedTests === 0,
    totalTests: results.totalTests,
    passedTests: results.passedTests,
    failedTests: results.failedTests,
    passRate: results.totalTests > 0 
      ? Math.round((results.passedTests / results.totalTests) * 100) 
      : 0,
    lastRun: results.lastRun,
    runDate: results.runDate
  });
});

module.exports = { router };
