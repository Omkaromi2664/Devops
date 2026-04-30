const { saveRunResults, getResults } = require('./results-manager');

class TestScheduler {
  constructor(options = {}) {
    this.intervalMs = options.intervalMs || 5 * 60 * 1000;
    this.enabled = options.enabled !== false;
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.isRunning = false;
    this.lastRunTime = null;
    this.runCount = 0;
  }

  async fetchJson(pathname, timeoutMs = 8000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(new URL(pathname, this.baseUrl), {
        signal: controller.signal
      });

      const body = await response.json().catch(() => ({}));
      return {
        ok: response.ok,
        status: response.status,
        body
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async runCheck(name, pathname, validator) {
    const startedAt = Date.now();

    try {
      const response = await this.fetchJson(pathname);
      validator(response);

      return {
        name,
        passed: true,
        duration: Date.now() - startedAt,
        timestamp: Date.now(),
        error: null
      };
    } catch (error) {
      return {
        name,
        passed: false,
        duration: Date.now() - startedAt,
        timestamp: Date.now(),
        error: error.message
      };
    }
  }

  async runChecks() {
    const checks = [
      this.runCheck('Health endpoint', '/health', (response) => {
        if (!response.ok || response.body.status !== 'ok') {
          throw new Error('Health endpoint failed');
        }
      }),
      this.runCheck('Status endpoint', '/api/status', (response) => {
        if (!response.ok || !response.body.updatedAt) {
          throw new Error('Status endpoint failed');
        }
      }),
      this.runCheck('System API', '/api/system', (response) => {
        if (!response.ok || response.body.ok === false) {
          throw new Error('System API unavailable');
        }
      }),
      this.runCheck('Jenkins API', '/api/jenkins', (response) => {
        if (!('ok' in response.body)) {
          throw new Error('Jenkins API missing ok field');
        }
      }),
      this.runCheck('Docker API', '/api/docker', (response) => {
        if (!('ok' in response.body)) {
          throw new Error('Docker API missing ok field');
        }
      }),
      this.runCheck('Kubernetes API', '/api/kubernetes', (response) => {
        if (!('ok' in response.body)) {
          throw new Error('Kubernetes API missing ok field');
        }
      }),
      this.runCheck('Nagios API', '/api/nagios', (response) => {
        if (!('ok' in response.body)) {
          throw new Error('Nagios API missing ok field');
        }
      })
    ];

    return Promise.all(checks);
  }

  async runTests() {
    if (this.isRunning) {
      console.log('[TestScheduler] Tests already running, skipping this interval');
      return;
    }

    this.isRunning = true;
    this.lastRunTime = Date.now();
    this.runCount += 1;

    console.log(`[TestScheduler] Starting test run #${this.runCount} at ${new Date().toISOString()}`);

    try {
      const results = await this.runChecks();
      const saved = saveRunResults(results);

      if (saved.failedTests === 0) {
        console.log(`[TestScheduler] Test run completed successfully (${saved.totalTests} checks)`);
      } else {
        console.log(`[TestScheduler] Test run completed with ${saved.failedTests} failure(s)`);
      }
    } catch (error) {
      console.error('[TestScheduler] Test run failed:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (!this.enabled) {
      console.log('[TestScheduler] Disabled, not starting');
      return;
    }

    console.log(`[TestScheduler] Starting with interval of ${this.intervalMs}ms`);

    this.runTests().catch((error) => console.error('[TestScheduler] Initial run failed:', error));

    this.intervalHandle = setInterval(() => {
      this.runTests().catch((error) => console.error('[TestScheduler] Scheduled run failed:', error));
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
        passRate: results.totalTests > 0 ? Math.round((results.passedTests / results.totalTests) * 100) : 0,
        status: results.totalTests > 0 && results.failedTests === 0 ? 'passing' : 'failing'
      }
    };
  }
}

module.exports = TestScheduler;