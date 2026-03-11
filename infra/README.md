# BidFlow Infrastructure

AWS CDK infrastructure for BidFlow - Agentic AI SaaS RFP Proposal Generator.

## Prerequisites

- AWS CLI v2 configured with credentials
- Node.js 18+ installed
- AWS CDK CLI v2 installed: `npm install -g aws-cdk`
- Python 3.12 installed

## Resources Created

- **S3 Bucket**: `bidflow-documents` - Stores company documentation PDFs
- **DynamoDB Table**: `BidProjectState` - Stores run history and artifacts
- **Lambda Function**: `AgentOrchestrator` - Multi-agent pipeline orchestrator
- **API Gateway HTTP API**: Routes for POST /run and GET /runs

## Deployment

### First Time Setup

```bash
cd infra
npm install
cdk bootstrap
```

### Deploy Stack

```bash
cdk deploy
```

### View Outputs

After deployment, note the following outputs:
- **HttpApiUrl**: API Gateway endpoint URL (use for frontend configuration)
- **BucketName**: S3 bucket name (upload PDFs here)
- **TableName**: DynamoDB table name
- **LambdaFunctionName**: Lambda function name

## Post-Deployment Steps

1. Create Amazon Bedrock Knowledge Base in AWS Console
2. Upload company documentation PDFs to S3 bucket
3. Sync Knowledge Base with S3 data source
4. Update Lambda environment variable `KNOWLEDGE_BASE_ID` with the KB ID
5. Configure frontend with `HttpApiUrl`

## Cleanup

```bash
cdk destroy
```

Note: S3 bucket and DynamoDB table have `RETAIN` removal policy and must be deleted manually if needed.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Amplify   │─────▶│ API Gateway  │─────▶│   Lambda    │
│  (Next.js)  │      │  HTTP API    │      │Orchestrator │
└─────────────┘      └──────────────┘      └──────┬──────┘
                                                   │
                     ┌─────────────────────────────┼─────────────┐
                     │                             │             │
              ┌──────▼──────┐            ┌────────▼────┐  ┌─────▼────┐
              │   Bedrock   │            │  DynamoDB   │  │    S3    │
              │   Runtime   │            │    Table    │  │  Bucket  │
              └──────┬──────┘            └─────────────┘  └────┬─────┘
                     │                                          │
              ┌──────▼──────┐                                  │
              │  Knowledge  │──────────────────────────────────┘
              │    Base     │
              └─────────────┘
```

## Cost Optimization

- DynamoDB: Pay-per-request billing (no idle cost)
- Lambda: 1024 MB memory, 60s timeout
- S3: Minimal storage for PDFs
- API Gateway: HTTP API (lower cost than REST API)

Estimated cost per run: $0.03-0.04 (primarily Bedrock model invocations)
