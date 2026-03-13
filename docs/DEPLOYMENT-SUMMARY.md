# BidFlow Deployment Guide

This is the canonical deployment document for the repository. If deployment instructions conflict elsewhere, use this file.

## Recommended Path

For a clean end-to-end deployment, use:

```bash
./scripts/deploy-all.sh
```

That script deploys infrastructure, writes `deployment-outputs.json`, builds the frontend, and publishes the static site to the provisioned frontend hosting resources.

## Script Map

BidFlow includes the following deployment and operations scripts:

### 1. `check-prerequisites.sh`
Purpose: Verify required local tools and AWS access before deployment.

### 2. `deploy-all.sh`
Purpose: Recommended full-stack deployment path.

What it does:
- Installs infra dependencies.
- Bootstraps CDK if required.
- Deploys the stack and writes `deployment-outputs.json`.
- Builds the frontend with the deployed API URL.
- Uploads frontend output and invalidates CloudFront.

### 3. `deploy-infrastructure.sh`
Purpose: Manual staged deployment for infrastructure only.

What it does:
- Deploys the CDK stack.
- Saves outputs to `deployment-outputs.json`.

### 4. `setup-knowledge-base.sh`
Purpose: Configure the Bedrock knowledge-base workflow after infrastructure deployment.

### 5. `test-backend.sh`
Purpose: Validate the deployed API and orchestration flow.

### 6. `deploy-frontend.sh`
Purpose: Legacy/manual frontend deployment helper.

Use this only if you intentionally want to deploy the frontend separately from the recommended `deploy-all.sh` flow.

### 7. `cleanup.sh`
Purpose: Tear down deployed resources and optionally remove local deployment artifacts.

## Deployment Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Deployment Process                        │
└─────────────────────────────────────────────────────────────┘

1. check-prerequisites.sh
   ↓
   Verify tools installed
   ↓
2. deploy-all.sh
   ↓
  Deploy AWS resources and save deployment outputs
   ↓
3. setup-knowledge-base.sh
   ↓
   Upload PDFs → Create KB → Sync → Update Lambda
   ↓
4. test-backend.sh
   ↓
   Test API endpoints → Verify pipeline → Check self-correction
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
│   ├── deploy-all.sh            # ✅ Recommended full deploy
│   ├── deploy-infrastructure.sh # ✅ Executable
│   ├── setup-knowledge-base.sh  # ✅ Executable
│   ├── test-backend.sh          # ✅ Executable
│   ├── deploy-frontend.sh       # Manual frontend path
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
│   ├── out/                     # Static export output
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

## Operational Notes

- `deployment-outputs.json` is the standard local outputs file across scripts.
- `deploy-all.sh` is the preferred deployment path for this repository.
- Use the staged scripts only if you need to stop between infrastructure, KB setup, testing, and frontend publishing.

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
- [ ] Bedrock models (auto-enabled on first use)

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
