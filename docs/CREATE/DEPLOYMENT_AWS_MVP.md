# AWS Deployment (MVP) — ECS Fargate

## Overview

Deploy the full-stack app (frontend, backend, copilot) to AWS using:
- Amazon ECR to host Docker images
- Amazon ECS (Fargate) to run containers serverlessly
- Application Load Balancer (ALB) to route traffic
- All 3 containers run in a single ECS task, sharing `localhost` networking

## Naming Convention

All resources use the `cookiecutter-test-` prefix.

| Resource                | Name                                  |
|-------------------------|---------------------------------------|
| ECR Repo (backend)      | `cookiecutter-test-backend`           |
| ECR Repo (frontend)     | `cookiecutter-test-frontend`          |
| ECR Repo (copilot)      | `cookiecutter-test-copilot`           |
| ECS Cluster             | `cookiecutter-test-cluster`           |
| Task Definition         | `cookiecutter-test-task`              |
| ECS Service             | `cookiecutter-test-service`           |
| ALB                     | `cookiecutter-test-alb`               |
| Target Group            | `cookiecutter-test-tg`                |
| Security Group (ALB)    | `cookiecutter-test-sg-alb`            |
| Security Group (ECS)    | `cookiecutter-test-sg-ecs`            |
| CloudWatch Log Group    | `/ecs/cookiecutter-test`              |
| IAM Role (Task Exec)    | `cookiecutter-test-ecs-execution-role`|

Region: `us-east-1`

---

## Prerequisites

- AWS CLI installed and authenticated (`aws sts get-caller-identity`)
- Docker running locally
- Default VPC available in us-east-1

---

## Phase 1 — Create ECR Repositories

```bash
aws ecr create-repository --repository-name cookiecutter-test-backend --region us-east-1
aws ecr create-repository --repository-name cookiecutter-test-frontend --region us-east-1
aws ecr create-repository --repository-name cookiecutter-test-copilot --region us-east-1
```

## Phase 2 — Build & Push Docker Images

Login to ECR:

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

Build locally (from project root):

```bash
cd deployment && docker compose up --build -d && cd ..
```

The frontend for AWS uses the same approach as Azure — containers in a Fargate task
share `localhost`, so nginx proxies to `localhost:8000` and `localhost:4001`.

Create an AWS-specific nginx config (`frontend/nginx.aws.conf`):

```nginx
server {
    listen 80;
    server_name localhost;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 256;

    location / {
        root   /usr/share/nginx/html;
        index  index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /copilotkit {
        proxy_pass http://localhost:4001/copilotkit;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }
}
```

Create `frontend/Dockerfile.aws`:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.aws.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Tag and push:

```bash
ECR=$AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Backend
docker tag deployment-backend $ECR/cookiecutter-test-backend:latest
docker push $ECR/cookiecutter-test-backend:latest

# Frontend (build with AWS Dockerfile)
cd frontend
docker build -f Dockerfile.aws -t $ECR/cookiecutter-test-frontend:latest .
docker push $ECR/cookiecutter-test-frontend:latest
cd ..

# Copilot
docker tag deployment-copilot $ECR/cookiecutter-test-copilot:latest
docker push $ECR/cookiecutter-test-copilot:latest
```

## Phase 3 — Create CloudWatch Log Group

```bash
aws logs create-log-group --log-group-name /ecs/cookiecutter-test --region us-east-1
```

## Phase 4 — Create IAM Role for ECS Task Execution

```bash
# Create the execution role
aws iam create-role \
  --role-name cookiecutter-test-ecs-execution-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach the managed policy
aws iam attach-role-policy \
  --role-name cookiecutter-test-ecs-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

## Phase 5 — Get Default VPC and Subnets

```bash
# Get default VPC ID
VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=isDefault,Values=true" \
  --query "Vpcs[0].VpcId" --output text --region us-east-1)
echo "VPC: $VPC_ID"

# Get subnet IDs (need at least 2 for ALB)
SUBNETS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query "Subnets[*].SubnetId" --output text --region us-east-1)
echo "Subnets: $SUBNETS"

# Convert to comma-separated for later use
SUBNET_LIST=$(echo $SUBNETS | tr '\t' ',')
echo "Subnet list: $SUBNET_LIST"
```

## Phase 6 — Create Security Groups

### ALB Security Group (allows inbound HTTP from internet)

```bash
ALB_SG_ID=$(aws ec2 create-security-group \
  --group-name cookiecutter-test-sg-alb \
  --description "ALB security group for cookiecutter-test" \
  --vpc-id $VPC_ID \
  --query "GroupId" --output text --region us-east-1)
echo "ALB SG: $ALB_SG_ID"

# Allow HTTP from anywhere
aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG_ID \
  --protocol tcp --port 80 --cidr 0.0.0.0/0 --region us-east-1
```

### ECS Security Group (allows traffic from ALB only)

```bash
ECS_SG_ID=$(aws ec2 create-security-group \
  --group-name cookiecutter-test-sg-ecs \
  --description "ECS tasks security group for cookiecutter-test" \
  --vpc-id $VPC_ID \
  --query "GroupId" --output text --region us-east-1)
echo "ECS SG: $ECS_SG_ID"

# Allow traffic from ALB security group on port 80
aws ec2 authorize-security-group-ingress \
  --group-id $ECS_SG_ID \
  --protocol tcp --port 80 \
  --source-group $ALB_SG_ID --region us-east-1
```

## Phase 7 — Create Application Load Balancer

```bash
# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name cookiecutter-test-alb \
  --subnets $SUBNETS \
  --security-groups $ALB_SG_ID \
  --scheme internet-facing \
  --type application \
  --query "LoadBalancers[0].LoadBalancerArn" --output text --region us-east-1)
echo "ALB ARN: $ALB_ARN"

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --query "LoadBalancers[0].DNSName" --output text --region us-east-1)
echo "ALB DNS: $ALB_DNS"

# Create Target Group (targets are IP addresses since Fargate uses awsvpc)
TG_ARN=$(aws elbv2 create-target-group \
  --name cookiecutter-test-tg \
  --protocol HTTP --port 80 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path "/api/health" \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --query "TargetGroups[0].TargetGroupArn" --output text --region us-east-1)
echo "TG ARN: $TG_ARN"

# Create Listener (HTTP:80 -> Target Group)
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN \
  --region us-east-1
```

## Phase 8 — Create ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name cookiecutter-test-cluster \
  --region us-east-1
```

## Phase 9 — Register Task Definition

The task definition puts all 3 containers in one task. They share `localhost` networking
(Fargate `awsvpc` network mode).

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws ecs register-task-definition \
  --family cookiecutter-test-task \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu "1024" \
  --memory "2048" \
  --execution-role-arn arn:aws:iam::${AWS_ACCOUNT_ID}:role/cookiecutter-test-ecs-execution-role \
  --container-definitions "[
    {
      \"name\": \"frontend\",
      \"image\": \"${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/cookiecutter-test-frontend:latest\",
      \"portMappings\": [{\"containerPort\": 80, \"protocol\": \"tcp\"}],
      \"essential\": true,
      \"logConfiguration\": {
        \"logDriver\": \"awslogs\",
        \"options\": {
          \"awslogs-group\": \"/ecs/cookiecutter-test\",
          \"awslogs-region\": \"us-east-1\",
          \"awslogs-stream-prefix\": \"frontend\"
        }
      }
    },
    {
      \"name\": \"backend\",
      \"image\": \"${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/cookiecutter-test-backend:latest\",
      \"portMappings\": [{\"containerPort\": 8000, \"protocol\": \"tcp\"}],
      \"essential\": true,
      \"environment\": [
        {\"name\": \"DYNAMODB_API_URL\", \"value\": \"REPLACE_WITH_VALUE\"},
        {\"name\": \"DYNAMODB_API_KEY\", \"value\": \"REPLACE_WITH_VALUE\"}
      ],
      \"logConfiguration\": {
        \"logDriver\": \"awslogs\",
        \"options\": {
          \"awslogs-group\": \"/ecs/cookiecutter-test\",
          \"awslogs-region\": \"us-east-1\",
          \"awslogs-stream-prefix\": \"backend\"
        }
      }
    },
    {
      \"name\": \"copilot\",
      \"image\": \"${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/cookiecutter-test-copilot:latest\",
      \"portMappings\": [{\"containerPort\": 4001, \"protocol\": \"tcp\"}],
      \"essential\": true,
      \"environment\": [
        {\"name\": \"ANTHROPIC_API_KEY\", \"value\": \"REPLACE_WITH_VALUE\"},
        {\"name\": \"CLAUDE_API_KEY\", \"value\": \"REPLACE_WITH_VALUE\"}
      ],
      \"logConfiguration\": {
        \"logDriver\": \"awslogs\",
        \"options\": {
          \"awslogs-group\": \"/ecs/cookiecutter-test\",
          \"awslogs-region\": \"us-east-1\",
          \"awslogs-stream-prefix\": \"copilot\"
        }
      }
    }
  ]" \
  --region us-east-1
```

> **Important:** Replace `REPLACE_WITH_VALUE` with actual values from your `.env` file.
> For production, use AWS Secrets Manager instead of plaintext environment variables.

## Phase 10 — Create ECS Service

```bash
# Use the first 2 subnets for the service
SUBNET_1=$(echo $SUBNETS | awk '{print $1}')
SUBNET_2=$(echo $SUBNETS | awk '{print $2}')

aws ecs create-service \
  --cluster cookiecutter-test-cluster \
  --service-name cookiecutter-test-service \
  --task-definition cookiecutter-test-task \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[$SUBNET_1,$SUBNET_2],
    securityGroups=[$ECS_SG_ID],
    assignPublicIp=ENABLED
  }" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=frontend,containerPort=80" \
  --region us-east-1
```

## Phase 11 — Verify Deployment

Wait 2-3 minutes for the task to start, then:

```bash
# Check service status
aws ecs describe-services \
  --cluster cookiecutter-test-cluster \
  --services cookiecutter-test-service \
  --query "services[0].{status:status, running:runningCount, desired:desiredCount}" \
  --region us-east-1

# Get ALB DNS
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --names cookiecutter-test-alb \
  --query "LoadBalancers[0].DNSName" --output text --region us-east-1)
echo "App URL: http://$ALB_DNS"

# Test endpoints
curl -s http://$ALB_DNS/api/health
curl -s http://$ALB_DNS/   # Should return HTML
```

## Phase 12 — (Optional) Auto Scaling

Add auto scaling so ECS can scale from 1 to 4 tasks based on CPU usage:

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/cookiecutter-test-cluster/cookiecutter-test-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 1 \
  --max-capacity 4 \
  --region us-east-1

# Create scaling policy (scale at 70% CPU)
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/cookiecutter-test-cluster/cookiecutter-test-service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name cookiecutter-test-cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleOutCooldown": 60,
    "ScaleInCooldown": 120
  }' \
  --region us-east-1
```

---

## Troubleshooting

### Check container logs

```bash
# View recent logs for each container
aws logs tail /ecs/cookiecutter-test --prefix frontend --since 30m --region us-east-1
aws logs tail /ecs/cookiecutter-test --prefix backend --since 30m --region us-east-1
aws logs tail /ecs/cookiecutter-test --prefix copilot --since 30m --region us-east-1
```

### Check task status

```bash
# List running tasks
aws ecs list-tasks \
  --cluster cookiecutter-test-cluster \
  --service-name cookiecutter-test-service \
  --region us-east-1

# Describe a task (get task ID from above)
aws ecs describe-tasks \
  --cluster cookiecutter-test-cluster \
  --tasks <TASK_ID> \
  --region us-east-1
```

### Common issues

- **Task keeps stopping:** Check CloudWatch logs. Usually a container crash or bad env var.
- **ALB returns 503:** Task hasn't started yet or health check failing. Wait 2-3 min.
- **502 Bad Gateway:** Frontend nginx can't reach backend/copilot on localhost. Verify all 3 containers are running in the task.
- **Health check failing:** Ensure `/api/health` returns 200. The backend must be healthy before ALB routes traffic.

---

## Architecture Diagram

```
Internet
  |
  v
ALB (cookiecutter-test-alb)
  |
  v
ECS Fargate Task (all 3 containers share localhost)
  |
  +-- frontend (nginx, port 80) -- ALB target
  |     |
  |     +-- /api/*      --> proxy to localhost:8000 (backend)
  |     +-- /copilotkit  --> proxy to localhost:4001 (copilot)
  |     +-- /*           --> serve React SPA
  |
  +-- backend (FastAPI, port 8000)
  |     |
  |     +-- /api/auth/*  --> AWS API Gateway --> Lambda --> DynamoDB
  |     +-- /api/stock/* --> yfinance
  |
  +-- copilot (Node.js, port 4001)
```

---

## Cost Estimate

| Resource                | Cost         |
|-------------------------|-------------|
| ECS Fargate (1 task, 1 vCPU, 2GB) | ~$15/month |
| ALB                     | ~$8/month   |
| ECR (3 repos)           | ~$1/month   |
| CloudWatch Logs         | ~$1/month   |
| **Total**               | **~$25/month** |

---

## Teardown — Delete All AWS Resources

Delete resources in reverse order of creation to avoid dependency errors.

```bash
# 1. Delete ECS Service (scale to 0 first)
aws ecs update-service \
  --cluster cookiecutter-test-cluster \
  --service cookiecutter-test-service \
  --desired-count 0 \
  --region us-east-1

aws ecs delete-service \
  --cluster cookiecutter-test-cluster \
  --service cookiecutter-test-service \
  --force \
  --region us-east-1

# 2. Deregister Task Definition(s)
TASK_DEFS=$(aws ecs list-task-definitions \
  --family-prefix cookiecutter-test-task \
  --query "taskDefinitionArns[]" --output text --region us-east-1)
for td in $TASK_DEFS; do
  aws ecs deregister-task-definition --task-definition $td --region us-east-1
done

# 3. Delete ECS Cluster
aws ecs delete-cluster --cluster cookiecutter-test-cluster --region us-east-1

# 4. Delete ALB Listener, Target Group, and Load Balancer
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --names cookiecutter-test-alb \
  --query "LoadBalancers[0].LoadBalancerArn" --output text --region us-east-1)

LISTENER_ARN=$(aws elbv2 describe-listeners \
  --load-balancer-arn $ALB_ARN \
  --query "Listeners[0].ListenerArn" --output text --region us-east-1)

aws elbv2 delete-listener --listener-arn $LISTENER_ARN --region us-east-1

aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN --region us-east-1

# Wait for ALB to fully delete before removing target group
sleep 30

TG_ARN=$(aws elbv2 describe-target-groups \
  --names cookiecutter-test-tg \
  --query "TargetGroups[0].TargetGroupArn" --output text --region us-east-1)

aws elbv2 delete-target-group --target-group-arn $TG_ARN --region us-east-1

# 5. Delete Security Groups
ALB_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=cookiecutter-test-sg-alb" \
  --query "SecurityGroups[0].GroupId" --output text --region us-east-1)

ECS_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=cookiecutter-test-sg-ecs" \
  --query "SecurityGroups[0].GroupId" --output text --region us-east-1)

aws ec2 delete-security-group --group-id $ECS_SG_ID --region us-east-1
aws ec2 delete-security-group --group-id $ALB_SG_ID --region us-east-1

# 6. Delete ECR Repositories
aws ecr delete-repository --repository-name cookiecutter-test-backend --force --region us-east-1
aws ecr delete-repository --repository-name cookiecutter-test-frontend --force --region us-east-1
aws ecr delete-repository --repository-name cookiecutter-test-copilot --force --region us-east-1

# 7. Delete CloudWatch Log Group
aws logs delete-log-group --log-group-name /ecs/cookiecutter-test --region us-east-1

# 8. Delete IAM Role
aws iam detach-role-policy \
  --role-name cookiecutter-test-ecs-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
aws iam delete-role --role-name cookiecutter-test-ecs-execution-role

# 9. (Optional) Delete auto-scaling if created
aws application-autoscaling deregister-scalable-target \
  --service-namespace ecs \
  --resource-id service/cookiecutter-test-cluster/cookiecutter-test-service \
  --scalable-dimension ecs:service:DesiredCount \
  --region us-east-1 2>/dev/null
```

### Verify teardown

```bash
aws ecs describe-clusters --clusters cookiecutter-test-cluster --region us-east-1
# Should show "status": "INACTIVE"

aws elbv2 describe-load-balancers --names cookiecutter-test-alb --region us-east-1
# Should return error: "Load balancers not found"

aws ecr describe-repositories --repository-names cookiecutter-test-backend --region us-east-1
# Should return error: "repository not found"
```
