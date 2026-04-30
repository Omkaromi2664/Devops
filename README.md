# DevOps Pipeline Sample App

Simple Express app used for a local DevOps pipeline demo (Jenkins, Docker, Kubernetes, Nagios).

Monitor Jenkins builds, Docker containers, Kubernetes pods, Nagios alerts, system metrics, and **automated test results** all from one live dashboard.

## Features

- **Live Dashboard** - Real-time status monitoring with WebSocket updates
- **System Metrics** - CPU, RAM, Disk, Uptime monitoring
- **Jenkins Integration** - Build status and history
- **Docker Integration** - Container status and resource usage
- **Kubernetes Integration** - Pod status and age tracking
- **Nagios Integration** - Alert aggregation and monitoring
- **Automated Testing** - Unit tests, integration tests, and Selenium E2E tests
- **Test Results Display** - View test metrics directly on the dashboard
- **Test Scheduler** - Automatic recurring test execution

## Local Run

Replace placeholders before running.

```bash
npm install
npm test
npm start
```

## Testing

Full testing suite with results displayed on the dashboard:

```bash
# Run all tests
npm run test:all

# Or run individually
npm test                    # Unit tests
npm run test:integration   # Integration tests  
npm run test:selenium      # Selenium E2E tests
npm run test:coverage      # Coverage report
```

Test results appear in the **Test Results** panel on the dashboard. The app automatically runs integration tests every 5 minutes (configurable).

See [TESTING.md](TESTING.md) for complete testing documentation.

## Docker

Replace <DOCKER_HUB_USER> and <IMAGE_NAME>.

```bash
docker build -t <DOCKER_HUB_USER>/<IMAGE_NAME>:latest .
docker run --rm -p 3000:3000 <DOCKER_HUB_USER>/<IMAGE_NAME>:latest
```

## Kubernetes

```bash
kubectl apply -f k8s/rbac.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/
kubectl get pods
```

Update [k8s/configmap.yaml](k8s/configmap.yaml) with your Jenkins, Nagios, and Docker API URLs.
Update [k8s/secret.yaml](k8s/secret.yaml) with Jenkins credentials.

For managed Kubernetes, the service is exposed as a LoadBalancer. Use:

```bash
kubectl get svc devops-pipeline-service
```

For minikube, run `minikube tunnel` to get an external IP for the LoadBalancer.

## Jenkins

Set the Jenkins environment variables DOCKER_HUB_USER and IMAGE_NAME, and create a Jenkins credential
with ID docker-hub (username/password) for Docker Hub login.

The pipeline automatically runs tests before building and deploying. Test artifacts are archived for review.

## Nagios

Copy nagios/hosts.cfg into the Nagios configuration directory and restart Nagios.

## API Endpoints

- `GET /health` - Health check
- `GET /api/status` - Aggregated system status (with test results)
- `GET /api/tests` - Latest test results
- `GET /api/tests/history` - Historical test statistics
- `GET /api/tests/summary` - Test summary
- `GET /api/scheduler` - Test scheduler status
- `GET /api/system` - System metrics
- `GET /api/jenkins` - Jenkins build status
- `GET /api/docker` - Docker container status
- `GET /api/kubernetes` - Kubernetes pod status
- `GET /api/nagios` - Nagios alerts

