# BidFlow Deployment Summary

## Deployment Scripts Overview

BidFlow includes 5 automated deployment scripts to streamline the setup process:

### 1. `check-prerequisites.sh`
**Purpose:** Verify all required tools are installed and configured

**What it checks:**
- ✅ AWS CLI v2
- ✅ Node.js 18+
- ✅ Python 3.12+
- ✅ Git
- ✅ AWS CDK CLI
- ✅ jq (JSON processor)
- ✅ AWS credentials
- ✅ AWS region configuration

**Usage:**
```bash
./scripts/check-prerequisites.sh
```

**When to run:** Before starting deployment

---

### 2. `deploy-infrastructure.sh`
**Purpose:** Deploy AWS infrastructure using CDK

**What it does:**
- Checks prerequisites
- Installs CDK dependencies
- Bootstraps CDK (if needed)
- Deploys CloudFormation stack
- Creates S3 bucket, DynamoDB table, Lambda, API Gateway
- Saves outputs to `deployment-outputs.json`

**Resources created:**
- S3 bucket: `bidflow-documents`
- DynamoDB table: `BidProjectState`
- Lambda function: `AgentOrchestrator`
- API Gateway HTTP API
- IAM roles and policies

**Usage:**
```bash
./scripts/deploy-infrastructure.sh
```

**Duration:** ~5 minutes

**Output:** `deployment-outputs.json` with API URL, bucket name, table name

---

### 3. `setup-knowledge-base.sh`
**Purpose:** Setup Bedrock Knowledge Base with company documentation

**What it does:**
- Uploads PDFs to S3
- Provides step-by-step instructions for creating Knowledge Base
- Updates Lambda with Knowledge Base ID

**Manual steps required:**
- Create Knowledge Base in AWS Console
- Configure data source (S3)
- Select embedding model (Titan v2)
- Create vector store (OpenSearch Serverless)
- Sync data source
- Copy Knowledge Base ID

**Usage:**
```bash
./scripts/setup-knowledge-base.sh
```

**Duration:** ~5 minutes (including manual steps)

**Prerequisites:** 5 PDF files in `docs/sample-pdfs/`

---

### 4. `test-backend.sh`
**Purpose:** Test deployed backend API

**What it tests:**
- POST /run endpoint (execute pipeline)
- GET /runs endpoint (query history)
- Agent execution order
- Self-correction loop
- Response format
- Error handling

**Usage:**
```bash
./scripts/test-backend.sh
```

**Duration:** ~1 minute (pipeline execution takes 30-60 seconds)

**Output:** `test-response.json` with full pipeline response

---

### 5. `deploy-frontend.sh`
**Purpose:** Deploy Next.js frontend

**What it does:**
- Installs npm dependencies
- Configures environment variables
- Builds Next.js application
- Provides deployment options (Amplify or local)

**Deployment options:**
- **Option A:** AWS Amplify (recommended for production)
- **Option B:** Local server (for testing)

**Usage:**
```bash
./scripts/deploy-frontend.sh
```

**Duration:** ~3 minutes (build) + deployment time

---

### 6. `cleanup.sh`
**Purpose:** Remove all deployed resources

**What it does:**
- Empties S3 bucket
- Destroys CDK stack
- Provides instructions for manual cleanup

**Manual cleanup required:**
- Knowledge Base
- OpenSearch Serverless collection
- Amplify app (if deployed)

**Usage:**
```bash
./scripts/cleanup.sh
```

**Duration:** ~2 minutes

---

## Deployment Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Deployment Process                        │
└─────────────────────────────────────────────────────────────┘

1. check-prerequisites.sh
   ↓
   Verify tools installed
   ↓
2. deploy-infrastructure.sh
   ↓
   Create AWS resources (S3, DynamoDB, Lambda, API Gateway)
   ↓
3. setup-knowledge-base.sh
   ↓
   Upload PDFs → Create KB → Sync → Update Lambda
   ↓
4. test-backend.sh
   ↓
   Test API endpoints → Verify pipeline → Check self-correction
   ↓
5. deploy-frontend.sh
   ↓
   Build Next.js → Deploy to Amplify or local
   ↓
   ✅ BidFlow is live!
```

## File Structure After Deployment

```
bidflow/
├── deployment-outputs.json      # CDK stack outputs (API URL, etc.)
├── knowledge-base-id.txt        # Knowledge Base ID
├── test-response.json           # Backend test results
├── scripts/
│   ├── check-prerequisites.sh   # ✅ Executable
│   ├── deploy-infrastructure.sh # ✅ Executable
│   ├── setup-knowledge-base.sh  # ✅ Executable
│   ├── test-backend.sh          # ✅ Executable
│   ├── deploy-frontend.sh       # ✅ Executable
│   └── cleanup.sh               # ✅ Executable
├── docs/
│   └── sample-pdfs/             # Company documentation PDFs
│       ├── company-profile.pdf
│       ├── case-study-saas-migration.pdf
│       ├── case-study-sso-integration.pdf
│       ├── case-study-security-audit.pdf
│       └── capabilities-deck-saas-delivery.pdf
├── infra/
│   ├── cdk.out/                 # CDK synthesized templates
│   └── node_modules/            # CDK dependencies
├── backend/
│   └── src/                     # Lambda function code
├── frontend/bidflow-ui/
│   ├── .env.local               # Environment variables
│   ├── .next/                   # Next.js build output
│   └── node_modules/            # Frontend dependencies
└── README.md
```

## Environment Variables

### Backend (Lambda)
Set automatically by CDK:
- `REGION`: us-east-1
- `TABLE_NAME`: BidProjectState
- `BUCKET_NAME`: bidflow-documents
- `KNOWLEDGE_BASE_ID`: (set by setup-knowledge-base.sh)
- `CLAUDE_MODEL_ID`: anthropic.claude-3-5-sonnet-20240620-v1:0
- `NOVA_LITE_MODEL_ID`: amazon.nova-lite-v1:0

### Frontend (Next.js)
Set in `.env.local`:
- `NEXT_PUBLIC_API_BASE_URL`: API Gateway URL from deployment-outputs.json

## AWS Resources Created

### Compute
- **Lambda Function:** AgentOrchestrator
  - Runtime: Python 3.12
  - Memory: 1024 MB
  - Timeout: 60 seconds
  - Concurrent executions: 10 (default)

### Storage
- **S3 Bucket:** bidflow-documents
  - Encryption: SSE-S3
  - Public access: Blocked
  - Versioning: Disabled

- **DynamoDB Table:** BidProjectState
  - Partition key: project_id (String)
  - Sort key: timestamp (String)
  - Billing: Pay-per-request
  - Point-in-time recovery: Disabled

### API
- **API Gateway:** HTTP API
  - CORS: Enabled (all origins)
  - Routes: POST /run, GET /runs
  - Throttling: 10,000 req/sec (default)

### AI/ML
- **Bedrock Knowledge Base:** BidFlowCompanyMemory
  - Embedding model: Titan Embeddings v2
  - Vector store: OpenSearch Serverless
  - Data source: S3 (bidflow-documents)

### Networking
- **VPC:** Not used (Lambda runs in AWS-managed VPC)
- **Security Groups:** Not applicable
- **NAT Gateway:** Not used

## Cost Breakdown

### One-Time Costs
- None (all resources are pay-per-use)

### Recurring Costs

**Free Tier (First 12 months):**
- Lambda: 1M requests/month free
- DynamoDB: 25 GB storage free
- S3: 5 GB storage free
- API Gateway: 1M requests/month free

**Beyond Free Tier:**

| Service | Cost | Notes |
|---------|------|-------|
| Bedrock (per run) | $0.03-0.04 | Claude + Nova API calls |
| OpenSearch Serverless | ~$175/month | Largest cost (always running) |
| Lambda | ~$0.20/1K runs | After free tier |
| DynamoDB | ~$0.25/1M writes | Pay-per-request |
| S3 | ~$0.023/GB/month | Minimal (5 PDFs) |
| API Gateway | ~$1.00/1M requests | HTTP API pricing |

**Total estimated cost:**
- Light usage (100 runs/month): ~$180/month
- Moderate usage (1,000 runs/month): ~$210/month
- Heavy usage (10,000 runs/month): ~$580/month

**Cost optimization:**
- Delete OpenSearch collection when not in use
- Use pay-per-request DynamoDB
- Limit retrieval to 6 chunks
- Single revision cycle per run

## Deployment Checklist

Print this checklist and check off items as you complete them:

### Pre-Deployment
- [ ] AWS account created
- [ ] AWS CLI installed
- [ ] AWS credentials configured
- [ ] Node.js 18+ installed
- [ ] Python 3.12+ installed
- [ ] Git installed
- [ ] Bedrock model access enabled

### Infrastructure
- [ ] Scripts made executable (`chmod +x scripts/*.sh`)
- [ ] Prerequisites checked (`check-prerequisites.sh`)
- [ ] Infrastructure deployed (`deploy-infrastructure.sh`)
- [ ] Deployment outputs saved (`deployment-outputs.json`)

### Knowledge Base
- [ ] 5 PDF files created in `docs/sample-pdfs/`
- [ ] PDFs uploaded to S3
- [ ] Knowledge Base created in AWS Console
- [ ] Data source synced
- [ ] Retrieval tested
- [ ] Knowledge Base ID saved
- [ ] Lambda updated with KB ID

### Backend
- [ ] Backend API tested (`test-backend.sh`)
- [ ] POST /run returns 200
- [ ] Self-correction loop triggered
- [ ] GET /runs returns history
- [ ] Test response saved (`test-response.json`)

### Frontend
- [ ] Frontend dependencies installed
- [ ] Environment variables configured (`.env.local`)
- [ ] Next.js build successful
- [ ] Frontend deployed (Amplify or local)
- [ ] UI loads without errors

### End-to-End Testing
- [ ] Demo RFP loads
- [ ] Generate button works
- [ ] Agent timeline displays
- [ ] Self-correction visible
- [ ] Final proposal renders
- [ ] Cost estimate displays
- [ ] All tabs work

### Production (Optional)
- [ ] Custom domain configured
- [ ] Authentication added
- [ ] Monitoring enabled
- [ ] Billing alerts set
- [ ] Backup strategy defined

## Troubleshooting Guide

### Script Errors

**Error: "Permission denied"**
```bash
chmod +x scripts/*.sh
```

**Error: "jq: command not found"**
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Windows
# Download from https://stedolan.github.io/jq/download/
```

**Error: "AWS credentials not configured"**
```bash
aws configure
```

### Deployment Errors

**Error: "CDK bootstrap required"**
```bash
cd infra
cdk bootstrap aws://ACCOUNT-ID/us-east-1
```

**Error: "Stack already exists"**
```bash
cd infra
cdk destroy
./scripts/deploy-infrastructure.sh
```

**Error: "Bedrock throttling"**
- Wait 5 minutes and retry
- Check service quotas in AWS Console

### Knowledge Base Errors

**Error: "No results returned"**
- Verify sync completed
- Check PDFs contain keywords
- Test in AWS Console

**Error: "Access denied"**
- Verify Lambda has `bedrock-agent-runtime:Retrieve` permission
- Check Knowledge Base IAM role

### Frontend Errors

**Error: "API call failed"**
- Verify `NEXT_PUBLIC_API_BASE_URL` is correct
- Check API Gateway CORS
- Inspect browser console

**Error: "Module not found"**
```bash
cd frontend/bidflow-ui
rm -rf node_modules
npm install
```

## Support Resources

### Documentation
- [QUICKSTART.md](../QUICKSTART.md) - 30-minute quick start
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Detailed deployment guide
- [README.md](../README.md) - Project overview

### AWS Documentation
- [Bedrock](https://docs.aws.amazon.com/bedrock/)
- [CDK](https://docs.aws.amazon.com/cdk/)
- [Lambda](https://docs.aws.amazon.com/lambda/)
- [API Gateway](https://docs.aws.amazon.com/apigateway/)

### Community
- AWS Support: https://console.aws.amazon.com/support/
- GitHub Issues: (if applicable)

## Success Metrics

Your deployment is successful when:

✅ All scripts run without errors
✅ Backend tests pass (200 status)
✅ Self-correction loop triggers
✅ Frontend loads and displays UI
✅ Demo RFP generates proposal
✅ Cost estimate displays
✅ All tabs show data

**Congratulations! You've successfully deployed BidFlow!** 🎉
