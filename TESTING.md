# Testing Guide

This project includes comprehensive automated testing with unit tests, integration tests, and Selenium E2E tests, all integrated into the DevOps dashboard.

## Test Types

### Unit Tests (CI/CD Safe)
Basic functionality tests for individual routes. Safe to run in CI pipeline—no external dependencies.

```bash
npm test                    # Recommended
npm run test:unit          # Explicit
```

### Integration Tests (Requires Running App)  
Tests that verify API endpoints return valid data and handle errors properly. **Requires the app to be running.**

```bash
npm run test:integration
```

These tests will gracefully skip if the app isn't available at `http://localhost:3000`.

### Selenium E2E Tests (Requires Browser & App)
Full UI and browser automation tests that verify the dashboard UI loads, updates, and integrates with all APIs. **Requires Chrome/Chromium and the app to be running.**

```bash
npm run test:selenium
```

> **Note:** Selenium tests require Chrome/Chromium browser, ChromeDriver, and the application running at `http://localhost:3000`.

### Run All Tests
```bash
npm run test:all
```

Runs unit tests first, then integration and Selenium tests (requires app running).

## Test Coverage

View coverage report:
```bash
npm run test:coverage
```

## CI/CD Pipeline Test Execution

The Jenkins pipeline runs **unit tests only**:
1. ✓ Unit Tests - Runs automatically, no external dependencies
2. ⏭️ Build Docker Image
3. ⏭️ Push to Docker Hub
4. ⏭️ Deploy to Kubernetes

**Integration and Selenium tests** are NOT run in the CI pipeline because they require:
- A running application instance
- External services (Jenkins, Docker, Nagios, etc.)
- Browser environment (Selenium)

Instead, these tests should be run:
- **Locally** during development: `npm run test:all`
- **Post-deployment** via the test scheduler in the running app
- **Manually** against the deployed dashboard

## Test Results on Dashboard

After deployment, test results are automatically:
- Saved to `.test-results/latest.json`
- Displayed on the dashboard in the **Test Results** panel
- Available via API at `/api/tests`

The dashboard shows:
- **Total Tests**: Number of tests in the current run
- **Pass Rate**: Percentage of passing tests
- **Passed**: Count of passing tests
- **Failed**: Count of failing tests
- **Last Run**: Timestamp of the most recent test execution
- **Recent Failures**: Names of recently failed tests (if any)

## Test Scheduler

The app automatically runs integration tests on a schedule (default: every 5 minutes).

### Configuration

Control the test scheduler via environment variables:

```bash
# Enable/disable scheduler (default: true)
TEST_SCHEDULER_ENABLED=true

# Interval in milliseconds (default: 5 minutes = 300000ms)
TEST_INTERVAL_MS=300000
```

### Scheduler Status

Get current scheduler status:
```bash
curl http://localhost:3000/api/scheduler
```

Response includes:
- `enabled`: Whether scheduler is active
- `isRunning`: Whether tests are currently running
- `lastRunTime`: Timestamp of last test run
- `intervalMs`: Configured interval
- `runCount`: Total number of scheduled runs
- `testResults`: Current test metrics

## Jenkins Integration

The Jenkins pipeline includes:

1. **Run Unit Tests** (via `npm run test:unit`) - Always runs, no external dependencies
2. **Build Docker Image** - Builds container image
3. **Push to Docker Hub** - Publishes image
4. **Deploy to Kubernetes** - Updates running deployment

**Post-deployment testing** happens automatically via the test scheduler in the running app:
- Integration tests run every 5 minutes (configurable via `TEST_INTERVAL_MS`)
- Results appear on the dashboard in the **Test Results** panel
- Test artifacts are archived in Jenkins

Test results are archived and can be viewed:
- On the dashboard at `http://{app-url}/` (Test Results panel)
- Via API at `http://{app-url}/api/tests`
- In Jenkins artifacts (`.test-results/latest.json`)

## API Endpoints

### Get Latest Test Results
```bash
curl http://localhost:3000/api/tests
```

### Get Test History
```bash
curl http://localhost:3000/api/tests/history
```

Returns statistics per test name including:
- Total runs
- Pass/failure counts
- Average duration

### Get Test Summary
```bash
curl http://localhost:3000/api/tests/summary
```

### Get Scheduler Status
```bash
curl http://localhost:3000/api/scheduler
```

## Test Data Management

Test results are persisted in `.test-results/latest.json` with structure:

```json
{
  "timestamp": 1234567890,
  "runDate": "2026-04-30T10:15:30.000Z",
  "totalTests": 25,
  "passedTests": 24,
  "failedTests": 1,
  "passRate": 96,
  "lastRun": 1234567890,
  "tests": [
    {
      "name": "Health endpoint response",
      "passed": true,
      "duration": 45,
      "timestamp": 1234567800,
      "error": null
    },
    ...
  ]
}
```

## Selenium Setup

### Prerequisites

```bash
# Debian/Ubuntu
sudo apt-get install chromium-browser

# macOS
brew install chromium
```

### Custom Chrome Path

If ChromeDriver can't find your Chrome binary:

```bash
CHROME_BIN=/custom/path/to/chrome npm run test:selenium
```

### Running Tests Against Remote Dashboard

```bash
DASHBOARD_URL=https://your-domain.com npm run test:selenium
```

## Troubleshooting

### Tests won't start
- Verify app is running: `curl http://localhost:3000/health`
- Check Node.js version: `node --version` (requires 18+)
- Install dependencies: `npm install`

### Selenium tests timeout
- Ensure Chrome is installed
- Check CHROME_BIN environment variable
- Verify dashboard is accessible at TEST_DASHBOARD_URL

### Test results not appearing on dashboard
- Check browser console for errors
- Verify WebSocket connection: `curl http://localhost:3000/api/tests`
- Ensure `.test-results/` directory exists (created automatically)

### Performance issues with tests
- Increase TEST_INTERVAL_MS if scheduler tests interfere with other processes
- Run Selenium tests separately from integration tests
- Use TEST_SCHEDULER_ENABLED=false to disable automatic testing during development

## Development Tips

### Adding New Tests

1. **Integration test** - Add to `test/integration.test.js`:
```javascript
async function testMyFeature() {
  const response = await fetch(`${BASE_URL}/api/my-endpoint`);
  const data = await response.json();
  if (!data.expectedField) throw new Error('Missing field');
}

await runTest('My feature test', testMyFeature);
```

2. **Selenium test** - Add to `test/selenium.test.js`:
```javascript
async function testMyUIFeature() {
  await driver.wait(until.elementLocated(By.id('my-element')), TEST_TIMEOUT);
  const element = await driver.findElement(By.id('my-element'));
  const text = await element.getText();
  if (!text) throw new Error('Element text missing');
}

await runTest('My UI test', testMyUIFeature);
```

3. **Unit test** - Add to `test/health.test.js` following Node.js test format

### Viewing Test Output

During test execution, output streams to console with:
- ✓ for passing tests
- ✗ for failing tests
- Timing information
- Summary statistics

## CI/CD Pipeline

The Jenkinsfile runs tests at these stages:

| Stage | Command | Always Runs | Description |
|-------|---------|------------|-------------|
| Unit Tests | `npm test` | ✓ | Basic functionality |
| Integration Tests | `npm run test:integration` | ✓ | API validation |
| Selenium Tests | `npm run test:selenium` | On main branch | Browser automation |

Failed tests cause the build stage to fail, preventing deployment.

## Performance Metrics

Typical test execution times:
- Unit tests: ~50ms
- Integration tests: ~5-10 seconds (depends on services)
- Selenium tests: ~45-60 seconds (depends on system)

Tests run in parallel where possible to minimize execution time.
