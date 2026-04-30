pipeline {
  agent any
  tools {
    nodejs 'node20'
  }
  environment {
    DOCKER_HUB_USER = "omkar4123"
    IMAGE_NAME      = "devops-pipeline-app"
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install Dependencies') {
      steps {
        sh 'npm install'
      }
    }

    stage('Run Unit Tests') {
      steps {
        sh 'npm test'
      }
    }

    stage('Run Integration Tests') {
      steps {
        sh 'npm run test:integration'
      }
    }

    stage('Build Docker Image') {
      steps {
        sh '''
          docker build \
            -t ${DOCKER_HUB_USER}/${IMAGE_NAME}:${BUILD_NUMBER} \
            -t ${DOCKER_HUB_USER}/${IMAGE_NAME}:latest .
        '''
      }
    }

    stage('Run Selenium Tests') {
      when {
        expression { 
          return env.RUN_SELENIUM_TESTS == 'true' || 
                 env.BRANCH_NAME == 'main' ||
                 env.BUILD_NUMBER == '1'
        }
      }
      steps {
        script {
          catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
            sh 'npm run test:selenium || true'
          }
        }
      }
    }

    stage('Push Docker Image') {
      steps {
        withCredentials([usernamePassword(
          credentialsId: 'docker-hub',
          usernameVariable: 'DOCKER_USER',
          passwordVariable: 'DOCKER_PASS'
        )]) {
          sh '''
            echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
            docker push ${DOCKER_HUB_USER}/${IMAGE_NAME}:${BUILD_NUMBER}
            docker push ${DOCKER_HUB_USER}/${IMAGE_NAME}:latest
          '''
        }
      }
    }

    stage('Deploy to Kubernetes') {
      steps {
        sh '''
          kubectl apply -f k8s/
          kubectl set image deployment/devops-pipeline-app \
            devops-pipeline-app=${DOCKER_HUB_USER}/${IMAGE_NAME}:${BUILD_NUMBER}
          kubectl rollout status deployment/devops-pipeline-app --timeout=60s
        '''
      }
    }

  }

  post {
    success {
      echo "Build #${BUILD_NUMBER} deployed successfully — image: ${DOCKER_HUB_USER}/${IMAGE_NAME}:${BUILD_NUMBER}"
    }
    failure {
      echo "Build #${BUILD_NUMBER} failed. Check the stage logs above."
    }
    always {
      archiveArtifacts artifacts: '.test-results/**', allowEmptyArchive: true
      publishHTML([
        reportDir: '.test-results',
        reportFiles: 'latest.json',
        reportName: 'Test Results'
      ])
    }
  }
}