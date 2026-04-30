const { spawn } = require('child_process');
const path = require('path');
const { getResults } = require('./results-manager');

class TestScheduler {
  constructor(options = {}) {
    this.intervalMs = options.intervalMs || 5 * 60 * 1000; // 5 minutes default
    this.isRunning = false;
    this.currentRun = null;
    this.lastRunTime = null;
    this.runCount = 0;
    this.enabled = options.enabled !== false;
  }

  async runTests() {
    if (this.isRunning) {
      console.log('[TestScheduler] Tests already running, skipping this interval');
      return;
    }

    this.isRunning = true;
    this.lastRunTime = Date.now();
    this.runCount++;

    console.log(`[TestScheduler] Starting test run #${this.runCount} at ${new Date().toISOString()}`);

    try {
      // Run integration tests (faster, more reliable in production)
      await this.runIntegrationTests();
      console.log('[TestScheduler] Test run completed successfully');
    } catch (error) {
      console.error('[TestScheduler] Test run failed:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  runIntegrationTests() {
    return new Promise((resolve, reject) => {
      const testFile = path.join(__dirname, '..', 'test', 'integration.test.js');
      const env = Object.assign({}, process.env, {
        BASE_URL: process.env.BASE_URL || 'http://localhost:3000'
      });

      const proc = spawn('node', [testFile], {
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(`[TestScheduler] ${data}`);
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(`[TestScheduler] ${data}`);
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Tests exited with code ${code}`));
        }
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }

  start() {
    if (!this.enabled) {
      console.log('[TestScheduler] Disabled, not starting');
      return;
    }

    console.log(`[TestScheduler] Starting with interval of ${this.intervalMs}ms`);
    
    // Run tests immediately on startup
    this.runTests().catch(err => console.error('[TestScheduler] Initial run failed:', err));

    // Then schedule regular runs
    this.intervalHandle = setInterval(() => {
      this.runTests().catch(err => console.error('[TestScheduler] Scheduled run failed:', err));
    }, this.intervalMs);
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log('[TestScheduler] Stopped');
    }
  }

  getStatus() {
    const results = getResults();
    return {
      enabled: this.enabled,
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      intervalMs: this.intervalMs,
      runCount: this.runCount,
      testResults: {
        totalTests: results.totalTests,
        passedTests: results.passedTests,
        failedTests: results.failedTests,
        passRate: results.totalTests > 0 
          ? Math.round((results.passedTests / results.totalTests) * 100) 
          : 0,
        status: results.totalTests > 0 && results.failedTests === 0 ? 'passing' : 'failing'
      }
    };
  }
}

module.exports = TestScheduler;
