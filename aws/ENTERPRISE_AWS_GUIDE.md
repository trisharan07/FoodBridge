# ☁️ Enterprise Cloud Deployment: AWS ECS, RDS PostgreSQL & S3 Assets

This guide covers deploying **FoodBridge** on production-grade AWS infrastructure using:
- **AWS ECS (Elastic Container Service) on Fargate**: Serverless Docker container execution.
- **Amazon RDS for PostgreSQL 16**: Managed, fault-tolerant relational database with automated backups.
- **Amazon S3**: Object storage for food imagery, proof-of-delivery photos, and assets.
- **Application Load Balancer (ALB)**: SSL termination and path-based routing for API and WebSockets.

---

## 🏛️ Enterprise Cloud Architecture

```
                       [ Users & Devices ]
                                │
                                ▼
                   ┌───────────────────────────┐
                   │    AWS CloudFront CDN     │ (Optional HTTPS Acceleration)
                   └────────────┬──────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
┌───────────────────────────────┐               ┌────────────────────────┐
│  Application Load Balancer    │               │    Amazon S3 Bucket    │
│  (Path & WebSocket Routing)   │               │   Listing & Delivery   │
└───────────────┬───────────────┘               │       Food Photos      │
                │                               └────────────────────────┘
                ▼
┌────────────────────────────────────────────────────────────────────────┐
│               AWS ECS Cluster (Fargate Serverless Tasks)               │
│                                                                        │
│   ┌─────────────────────┐   ┌─────────────────┐   ┌────────────────┐   │
│   │ foodbridge-frontend │   │ foodbridge-api  │   │   ai-service   │   │
│   │    (Vite React)     │   │ (Express/Socket)│   │  (MobileNetV2) │   │
│   └─────────────────────┘   └────────┬────────┘   └────────────────┘   │
└──────────────────────────────────────┼─────────────────────────────────┘
                                       │
                                       ▼
                        ┌───────────────────────────────┐
                        │  Amazon RDS PostgreSQL 16     │
                        │    (Private Subnet, SSL)      │
                        └───────────────────────────────┘
```

---

## 🚀 Quick Deployment: 1-Click AWS CloudFormation

You can provision the entire network, S3 bucket, RDS database, and ECS cluster in one command using the provided [cloudformation.yml](file:///Users/trisharansathe/Downloads/Final%20year%20project/FoodBridge/aws/cloudformation.yml).

### Via AWS CLI:
```bash
aws cloudformation create-stack \
  --stack-name foodbridge-enterprise-prod \
  --template-body file://aws/cloudformation.yml \
  --parameters ParameterKey=DBPassword,ParameterValue="YourStrongPassword2026!" \
  --capabilities CAPABILITY_IAM
```

### Via AWS Console:
1. Navigate to **CloudFormation** in the AWS Console.
2. Click **Create stack** ➔ **With new resources (standard)**.
3. Upload `aws/cloudformation.yml`.
4. Enter your parameters (Stack name, database password).
5. Click **Submit** and wait ~5 minutes until status reaches `CREATE_COMPLETE`.
6. Go to the **Outputs** tab to view your:
   - `S3BucketName`
   - `RDSEndpoint`
   - `DatabaseURL`

---

## 📦 Pushing Docker Containers to Amazon ECR

### 1. Authenticate Docker with Amazon ECR:
```bash
export AWS_REGION="us-east-1"
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
```

### 2. Create ECR Repositories:
```bash
aws ecr create-repository --repository-name foodbridge-backend
aws ecr create-repository --repository-name foodbridge-frontend
aws ecr create-repository --repository-name foodbridge-ai-service
```

### 3. Build, Tag, and Push:

#### Backend API:
```bash
docker build -t foodbridge-backend ./backend
docker tag foodbridge-backend:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/foodbridge-backend:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/foodbridge-backend:latest
```

#### Frontend SPA:
```bash
docker build -t foodbridge-frontend ./frontend
docker tag foodbridge-frontend:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/foodbridge-frontend:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/foodbridge-frontend:latest
```

#### MobileNet AI Service:
```bash
docker build -t foodbridge-ai-service ./ml-service
docker tag foodbridge-ai-service:latest ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/foodbridge-ai-service:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/foodbridge-ai-service:latest
```

---

## 🗄️ Executing Migrations on Amazon RDS

Once your Amazon RDS instance is active, apply the FoodBridge schema and migrations:

```bash
export DATABASE_URL="postgres://foodbridge:<PASSWORD>@<RDS_ENDPOINT>:5432/foodbridge?sslmode=require"

# Run automated Node.js migration runner:
node database/migrate.js
```

This applies:
- `01_schema.sql` (Tables: users, food_listings, pickups, volunteer_assignments, organizations, reviews, notifications, audit_logs)
- `02_migration_v2.sql` (Admin verification, GPS tracking columns, delivery notes, freshness label)
- `03_migration_v3.sql` (WebPush subscriptions and SMS notification preference flags)

---

## ☁️ Amazon S3 Media Storage Configuration

When running in AWS, add the following environment variables to your backend:

| Variable | Example Value | Description |
|:---------|:--------------|:------------|
| `AWS_S3_BUCKET` | `foodbridge-prod-assets-123456789` | S3 Bucket name for food photos |
| `AWS_REGION` | `us-east-1` | AWS Region hosting the bucket |
| `CLOUDFRONT_URL` | `https://d1234.cloudfront.net` | (Optional) CloudFront CDN endpoint |

FoodBridge automatically streams food images directly into your S3 bucket under the prefix `listings/` with high-performance caching headers (`Cache-Control: max-age=31536000, public`).

---

## 🔄 Deploying ECS Task Definition

Register the task definition with AWS ECS:

```bash
aws ecs register-task-definition --cli-input-json file://aws/ecs/task-definition.json
```

Create or update the ECS Service:
```bash
aws ecs create-service \
  --cluster foodbridge-prod-cluster \
  --service-name foodbridge-service \
  --task-definition foodbridge-production \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<SUBNET_1>,<SUBNET_2>],securityGroups=[<ECS_SG>],assignPublicIp=ENABLED}"
```
