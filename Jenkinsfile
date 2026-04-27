pipeline {
  agent any

  environment {
    DOCKER_HUB_USER = "${env.DOCKER_HUB_USER}"
    IMAGE_NAME = "${env.IMAGE_NAME}"
  }

  stages {
    stage('Checkout') {
      steps {
        script {
          if (!env.DOCKER_HUB_USER?.trim() || !env.IMAGE_NAME?.trim()) {
            error 'DOCKER_HUB_USER and IMAGE_NAME must be set in Jenkins environment'
          }
        }
        checkout scm
      }
    }
    stage('Install Dependencies') {
      steps {
        sh 'npm install'
      }
    }
    stage('Run Tests') {
      steps {
        sh 'npm test'
      }
    }
    stage('Build Docker Image') {
      steps {
        sh 'docker build -t ${DOCKER_HUB_USER}/${IMAGE_NAME}:${BUILD_NUMBER} -t ${DOCKER_HUB_USER}/${IMAGE_NAME}:latest .'
      }
    }
    stage('Push Docker Image') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'docker-hub', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
          sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin'
        }
        sh 'docker push ${DOCKER_HUB_USER}/${IMAGE_NAME}:${BUILD_NUMBER}'
        sh 'docker push ${DOCKER_HUB_USER}/${IMAGE_NAME}:latest'
      }
    }
    stage('Deploy to Kubernetes') {
      steps {
        sh 'kubectl apply -f k8s/'
        sh 'kubectl set image deployment/devops-pipeline-app devops-pipeline-app=${DOCKER_HUB_USER}/${IMAGE_NAME}:latest'
        sh 'kubectl rollout status deployment/devops-pipeline-app'
      }
    }
  }

  post {
    failure {
      echo 'Pipeline failed. Check the stage logs for details.'
    }
  }
}
