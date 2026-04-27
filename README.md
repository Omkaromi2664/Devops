# DevOps Pipeline Sample App

Simple Express app used for a local DevOps pipeline demo (Jenkins, Docker, Kubernetes, Nagios).

## Local Run

Replace placeholders before running.

```bash
npm install
npm test
npm start
```

## Docker

Replace <DOCKER_HUB_USER> and <IMAGE_NAME>.

```bash
docker build -t <DOCKER_HUB_USER>/<IMAGE_NAME>:latest .
docker run --rm -p 3000:3000 <DOCKER_HUB_USER>/<IMAGE_NAME>:latest
```

## Kubernetes

```bash
kubectl apply -f k8s/
kubectl get pods
```

## Jenkins

Set the Jenkins environment variables DOCKER_HUB_USER and IMAGE_NAME, and create a Jenkins credential
with ID docker-hub (username/password) for Docker Hub login.

## Nagios

Copy nagios/hosts.cfg into the Nagios configuration directory and restart Nagios.
