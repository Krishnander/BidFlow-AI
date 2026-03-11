# BidFlow — Agentic AI SaaS RFP Proposal Generator

BidFlow is an agentic AI prototype that automates SaaS RFP proposal generation using a multi-agent pipeline with self-correction. Built with AWS Bedrock, Lambda, DynamoDB, and Next.js.

## Overview

BidFlow orchestrates five specialized AI agents to transform RFP requirements into compliant proposal responses:

```
Extractor → Researcher → Strategist → Writer → Critic
                                         ↓
                                    (if rejected)
                                         ↓
                                    Writer v2 → Critic v2
```

### Key Features

- **Multi-Agent Pipeline**: Five specialized agents (Extractor, Researcher, Strategist, Writer, Critic)
- **Self-Correction Loop**: Automatic revision when compliance gaps detected
- **RAG-Based Evidence**: Retrieves relevant content from company documentation
- **Compliance Auditing**: Checks for ISO 27001, SOC 2, SSO, SLA requirements
- **Real-Time Timeline**: Live visualization of agent execution steps
- **Cost Estimation**: Transparent cost tracking per run

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

### AWS Services Used

- **Amazon Bedrock**: Claude 3.5 Sonnet (strategy/writing), Amazon Nova Lite (extraction/auditing)
- **Bedrock Knowledge Bases**: RAG retrieval from company documents
- **AWS Lambda**: Python 3.12 agent orchestrator
- **Amazon DynamoDB**: Run history and artifact storage
- **Amazon S3**: Company documentation storage
- **API Gateway HTTP API**: RESTful endpoints
- **AWS Amplify**: Next.js UI hosting
- **OpenSearch Serverless**: Vector store for Knowledge Base

## Project Structure

```
bidflow/
├── infra/                      # AWS CDK infrastructure (TypeScript)
│   ├── lib/bidflow-stack.ts    # CDK stack definition
│   └── bin/bidflow.ts          # CDK app entry point
├── backend/                    # Lambda function (Python 3.12)
│   └── src/
│       ├── handler.py          # Lambda entry + orchestration
│       ├── bedrock.py          # Bedrock API integration
│       ├── prompts.py          # Agent prompt templates
│       ├── dynamo.py           # DynamoDB helpers
│       └── cost.py             # Cost estimation
├── frontend/bidflow-ui/        # Next.js UI (TypeScript)
│   └── app/
│       ├── page.tsx            # Main application page
│       └── layout.tsx          # Root layout
└── README.md                   # This file
```

## Prerequisites

- AWS CLI v2 configured with credentials
- Node.js 18+ installed
- Python 3.12 installed
- AWS CDK CLI v2: `npm install -g aws-cdk`
- Git

## Quick Start

For rapid deployment, see [QUICKSTART.md](QUICKSTART.md) (30 minutes).

For detailed instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Automated Deployment Scripts

We provide automated scripts for easy deployment:

```bash
# Make scripts executable
chmod +x scripts/*.sh

# 1. Deploy infrastructure
./scripts/deploy-infrastructure.sh

# 2. Setup Knowledge Base
./scripts/setup-knowledge-base.sh

# 3. Test backend API
./scripts/test-backend.sh

# 4. Deploy frontend
./scripts/deploy-frontend.sh

# Cleanup (when done)
./scripts/cleanup.sh
```

## Detailed Setup Instructions

### Phase 1: Infrastructure Deployment

1. **Deploy CDK Stack**

```bash
cd infra
npm install
cdk bootstrap  # First time only
cdk deploy
```

Note the outputs:
- `HttpApiUrl`: API Gateway endpoint
- `BucketName`: S3 bucket name
- `TableName`: DynamoDB table name

### Phase 2: Knowledge Base Setup

2. **Create Company Documentation PDFs**

Create 5 PDFs with SaaS-focused content:
- `company-profile.pdf` - Mentions ISO 27001 & SOC 2
- `case-study-saas-migration.pdf` - SLA outcomes
- `case-study-sso-integration.pdf` - SAML/OIDC
- `case-study-security-audit.pdf` - ISO/SOC wording
- `capabilities-deck-saas-delivery.pdf` - Multi-tenancy, encryption, SLAs

3. **Upload PDFs to S3**

```bash
aws s3 cp company-profile.pdf s3://bidflow-documents/
aws s3 cp case-study-saas-migration.pdf s3://bidflow-documents/
aws s3 cp case-study-sso-integration.pdf s3://bidflow-documents/
aws s3 cp case-study-security-audit.pdf s3://bidflow-documents/
aws s3 cp capabilities-deck-saas-delivery.pdf s3://bidflow-documents/
```

4. **Create Knowledge Base**

In AWS Console → Amazon Bedrock → Knowledge Bases:
- Click "Create knowledge base"
- Name: `BidFlowCompanyMemory`
- Data source: S3 bucket `bidflow-documents`
- Embedding model: Titan Embeddings v2
- Vector store: Quick create OpenSearch Serverless
- Click "Create"

5. **Sync Knowledge Base**

- Select your Knowledge Base
- Click "Sync" button
- Wait for sync to complete

6. **Test Retrieval**

- In Knowledge Base console, click "Test"
- Query: "ISO 27001 compliance"
- Verify results returned

7. **Update Lambda Environment Variable**

```bash
aws lambda update-function-configuration \
  --function-name AgentOrchestrator \
  --environment Variables="{REGION=us-east-1,TABLE_NAME=BidProjectState,BUCKET_NAME=bidflow-documents,KNOWLEDGE_BASE_ID=YOUR_KB_ID,CLAUDE_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0,NOVA_LITE_MODEL_ID=amazon.nova-lite-v1:0}"
```

Replace `YOUR_KB_ID` with the actual Knowledge Base ID.

### Phase 3: Frontend Deployment

8. **Configure Frontend**

```bash
cd frontend/bidflow-ui
npm install
```

Create `.env.local`:
```
NEXT_PUBLIC_API_BASE_URL=https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com
```

Replace with your actual API Gateway URL from CDK output.

9. **Test Locally**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

10. **Deploy to AWS Amplify**

- Push code to Git repository
- Go to AWS Amplify Console
- Click "New app" → "Host web app"
- Connect Git repository
- Amplify auto-detects Next.js
- Set environment variable: `NEXT_PUBLIC_API_BASE_URL`
- Click "Save and deploy"

## Usage

### Demo Flow

1. Open the BidFlow UI
2. Click "Load Demo RFP" to populate the input
3. Click "Generate" to start the pipeline
4. Watch the agent timeline:
   - Extractor parses RFP into checklist
   - Researcher retrieves 6 evidence chunks
   - Strategist generates win themes
   - Writer creates draft v1
   - Critic rejects (missing ISO 27001)
   - Writer creates draft v2
   - Critic approves
5. View final proposal in Markdown
6. Check cost estimate badge

### API Endpoints

**POST /run**

Execute agent pipeline:

```bash
curl -X POST "https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/run" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "demo-001",
    "rfp_text": "We require ISO 27001 and SOC 2. SSO via SAML/OIDC. SLA 99.9%. Provide timeline."
  }'
```

**GET /runs**

Query run history:

```bash
curl "https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/runs?project_id=demo-001"
```

## Cost Optimization

### AWS Free Tier Usage

- **Lambda**: 1M requests/month, 400,000 GB-seconds compute
- **DynamoDB**: 25 GB storage, 25 WCU, 25 RCU (pay-per-request)
- **S3**: 5 GB storage, 20,000 GET requests, 2,000 PUT requests
- **API Gateway**: 1M requests/month (HTTP API)

### Estimated Costs (Beyond Free Tier)

- **Per Run**: $0.03-0.04 (primarily Bedrock model invocations)
- **Lambda**: ~$0.20 per 1,000 executions
- **DynamoDB**: ~$0.25 per million writes (pay-per-request)
- **S3**: Minimal (< $0.10 for 5 PDFs)
- **OpenSearch Serverless**: ~$0.24/hour (~$175/month) - **Largest cost**

### Optimization Strategies

- Use Nova Lite for fast/cheap operations (Extractor, Critic)
- Use Claude Sonnet for high-quality operations (Strategist, Writer)
- Single revision cycle to control Bedrock API calls
- Pay-per-request DynamoDB (no idle cost)
- Limit retrieval to 6 chunks

## Troubleshooting

### Backend Issues

**Lambda timeout**
- Check CloudWatch logs for slow agent
- Verify Bedrock API latency
- Consider increasing timeout beyond 60s

**Knowledge Base retrieval fails**
- Verify KB sync completed
- Check S3 bucket contains PDFs
- Test retrieval in AWS Console
- Verify Lambda has `bedrock-agent-runtime:Retrieve` permission

**Extractor returns invalid JSON**
- Check prompt template formatting
- Review CloudWatch logs for raw response
- Fallback checklist should activate automatically

### Frontend Issues

**API calls fail with CORS error**
- Verify API Gateway CORS configuration
- Check backend returns CORS headers
- Ensure `NEXT_PUBLIC_API_BASE_URL` is set

**Timeline doesn't animate**
- Check browser console for errors
- Verify `log` array populated in API response

**Markdown doesn't render**
- Verify `react-markdown` installed
- Check `final_markdown` contains valid Markdown

## Cleanup

To avoid ongoing charges:

```bash
# Destroy CDK stack
cd infra
cdk destroy

# Delete Knowledge Base (manual in AWS Console)
# Delete OpenSearch Serverless collection (manual)
# Delete S3 bucket contents (if needed)
```

Note: S3 bucket and DynamoDB table have `RETAIN` removal policy and must be deleted manually.

## Development

### Backend Testing

```bash
cd backend
python -m pytest tests/
```

### Frontend Testing

```bash
cd frontend/bidflow-ui
npm run lint
npm run build
```

## Documentation

- [Infrastructure README](infra/README.md) - CDK deployment details
- [Backend README](backend/README.md) - Lambda function details
- [Frontend README](frontend/bidflow-ui/README.md) - Next.js UI details
- [Requirements](. kiro/specs/bidflow-rfp-generator/requirements.md) - Detailed requirements
- [Design](. kiro/specs/bidflow-rfp-generator/design.md) - System design
- [Tasks](. kiro/specs/bidflow-rfp-generator/tasks.md) - Implementation tasks

## License

MIT

## Acknowledgments

Built for the AWS Builder Center 10,000 AIdeas competition using:
- Amazon Bedrock (Claude 3.5 Sonnet, Amazon Nova Lite)
- AWS CDK for infrastructure as code
- Next.js for modern React development
- Kiro AI for development assistance
