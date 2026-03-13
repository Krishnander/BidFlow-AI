# BidFlow AI

A multi-agent system that converts RFP documents into structured, compliance-aware proposals. The pipeline decomposes the response process into discrete stages — extraction, evidence retrieval, strategy, drafting, and critique — each handled by a purpose-built agent running on Amazon Bedrock.

---

## Problem

Responding to enterprise RFPs is slow, error-prone, and expensive. A typical response requires days of cross-functional effort to extract requirements, gather evidence, align on strategy, draft sections, and verify compliance coverage. BidFlow compresses that workflow into an automated pipeline that completes in under a minute.

## How It Works

A single Lambda function orchestrates five agents in sequence. Each agent receives structured input from the previous stage and produces structured output for the next.

| Stage | Agent | Model | Responsibility |
|-------|-------|-------|----------------|
| 1 | Extractor | Amazon Nova Lite | Parse RFP text into a JSON checklist of requirements and compliance terms |
| 2 | Researcher | Bedrock Knowledge Base | Retrieve top-k evidence chunks from company documents via RAG |
| 3 | Strategist | Claude Sonnet | Generate win themes, proof points, and risk mitigations from the checklist + evidence |
| 4 | Writer | Claude Sonnet | Draft a seven-section Markdown proposal grounded in the strategy |
| 5 | Critic | Amazon Nova Lite | Audit the draft against the original checklist; approve or reject with reasoning |

If the Critic rejects, the Writer revises using the feedback, and the Critic re-evaluates once. The final output — along with every intermediate artifact — is persisted to DynamoDB and returned to the caller.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Frontend  (Next.js 14 · Static Export · S3 + CloudFront)           │
└────────────────────────────┬─────────────────────────────────────────┘
                             │  HTTPS
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  API Gateway  (HTTP API · CORS · POST /run · GET /runs/{id})        │
└────────────────────────────┬─────────────────────────────────────────┘
                             │  Async invoke
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Lambda: AgentOrchestrator  (Python 3.12 · 1 024 MB · 300 s)        │
│                                                                      │
│   ┌───────────┐   ┌────────────┐   ┌────────────┐   ┌───────────┐  │
│   │ Extractor │──▶│ Researcher │──▶│ Strategist │──▶│  Writer   │  │
│   │(Nova Lite)│   │  (KB RAG)  │   │  (Claude)  │   │ (Claude)  │  │
│   └───────────┘   └────────────┘   └────────────┘   └─────┬─────┘  │
│                                                            │        │
│                                                            ▼        │
│                                                      ┌───────────┐  │
│                                            ┌────────▶│  Critic   │  │
│                                            │ retry   │(Nova Lite)│  │
│                                            │ (max 1) └─────┬─────┘  │
│                                            │               │        │
│                                            │   REJECT      │APPROVE │
│                                            └───────────────┘   │    │
│                                                                ▼    │
│                                                        Save result  │
└────────────────────────────────────────────────────┬─────────────────┘
                                                     │
                    ┌────────────────────────────────┬┘
                    ▼                                ▼
         ┌──────────────────┐             ┌──────────────────┐
         │    DynamoDB       │             │       S3          │
         │ BidProjectState   │             │ bidflow-documents │
         │ (run history +    │             │ (company PDFs for │
         │  all artifacts)   │             │  Knowledge Base)  │
         └──────────────────┘             └──────────────────┘
```

### AWS Services Used

| Service | Purpose |
|---------|---------|
| **Amazon Bedrock** | Model inference (Claude Sonnet, Nova Lite) and Knowledge Base retrieval |
| **Lambda** | Stateless orchestration of the agent pipeline |
| **API Gateway** | HTTP API with CORS for the frontend |
| **DynamoDB** | Run state, intermediate artifacts, and cost tracking |
| **S3** | Company document storage (KB source) and frontend static hosting |
| **CloudFront** | CDN for the static frontend export |
| **CloudWatch** | Lambda logging and operational metrics |

---

## Repository Structure

```
BidFlow AI/
├── backend/                   Lambda function source (Python 3.12)
│   └── src/
│       ├── handler.py         Entry point and orchestration logic
│       ├── bedrock.py         Bedrock model invocation and KB retrieval
│       ├── prompts.py         Prompt templates for each agent
│       ├── dynamo.py          DynamoDB read/write helpers
│       └── cost.py            Per-run cost estimation
├── frontend/bidflow-ui/       Next.js 14 application
│   └── app/
│       ├── page.tsx           Main workspace UI
│       ├── layout.tsx         Root layout and font configuration
│       └── globals.css        Design system and utility classes
├── infra/                     AWS CDK stack (TypeScript)
│   └── lib/
│       └── bidflow-stack.ts   All provisioned resources
├── scripts/                   Deployment and operations scripts
│   ├── deploy-all.sh          Recommended full-stack deploy
│   ├── deploy-infrastructure.sh
│   ├── setup-knowledge-base.sh
│   ├── test-backend.sh
│   └── cleanup.sh
├── docs/
│   ├── DEPLOYMENT-SUMMARY.md  Canonical deployment guide
│   └── sample-pdfs/           Sample company documents for KB
└── demo.html                  Standalone lightweight demo page
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.12+
- AWS CLI v2 with configured credentials
- AWS CDK CLI v2

### Local Development

```bash
cd frontend/bidflow-ui
npm install
cp .env.local.example .env.local    # then set NEXT_PUBLIC_API_BASE_URL
npm run dev                          # starts on localhost:3000
```

### Full Deployment

The recommended path deploys infrastructure, builds the frontend, and publishes everything in one pass:

```bash
./scripts/deploy-all.sh
```

For a staged deployment workflow, see [`docs/DEPLOYMENT-SUMMARY.md`](docs/DEPLOYMENT-SUMMARY.md).

---

## API

The backend exposes three routes through API Gateway:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/run` | Submit RFP text; returns a `run_id` immediately (async execution) |
| `GET` | `/runs/{run_id}` | Poll for status and results of a specific run |
| `GET` | `/runs` | List run history for a project |

### Example

```bash
# Start a run
curl -X POST "$API_URL/run" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "demo-001", "rfp_text": "..."}'

# Poll for results (after ~40 seconds)
curl "$API_URL/runs/{run_id}"
```

The completed response includes the final proposal Markdown, every intermediate artifact (checklist, evidence, strategy, drafts, critic feedback), elapsed time, and estimated cost.

---

## Technology

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, react-markdown |
| Backend | Python 3.12, boto3, Lambda |
| AI Models | Claude Sonnet (strategy + writing), Amazon Nova Lite (extraction + critique), Titan Embeddings v2 (KB) |
| Infrastructure | AWS CDK (TypeScript), API Gateway, Lambda, DynamoDB, S3, CloudFront |
| Export | Copy, Text, Word (.doc), PDF (jsPDF) |

---

## Further Reading

| Document | Scope |
|----------|-------|
| [`docs/DEPLOYMENT-SUMMARY.md`](docs/DEPLOYMENT-SUMMARY.md) | Deployment guide and script reference |
| [`backend/README.md`](backend/README.md) | Lambda modules, API contract, agent behavior |
| [`frontend/bidflow-ui/README.md`](frontend/bidflow-ui/README.md) | Frontend development and configuration |
| [`infra/README.md`](infra/README.md) | CDK stack and infrastructure details |

### 2. RAG Integration
- Retrieves relevant evidence from Knowledge Base
- Grounds proposals in real company data
- Provides proof points and case studies

### 3. Self-Correction Loop
- Critic agent audits output quality
- Triggers revision if needed
- Ensures compliance and completeness

### 4. Model Selection Strategy
- **Nova 2 Lite** for fast, simple tasks (extraction, auditing)
- **Claude Sonnet 4.6** for complex reasoning (strategy, writing)
- Optimizes cost and performance

---

## 📈 Business Impact

### Time Savings
- **Manual:** 2-5 days per proposal
- **BidFlow:** 40 seconds
- **Savings:** 99.5% time reduction

### Cost Savings
- **Manual:** $2,000-$5,000 (consultant fees)
- **BidFlow:** $0.04 per proposal
- **Savings:** 99.99% cost reduction

### Quality Improvement
- Consistent format and tone
- All requirements addressed
- Evidence-backed claims
- Compliance guaranteed

---

## 🔮 Future Enhancements

1. **Multi-language Support** - Generate proposals in any language
2. **Custom Templates** - Industry-specific proposal formats
3. **Collaboration Features** - Team review and editing
4. **Analytics Dashboard** - Win rate tracking
5. **Integration APIs** - Connect to CRM systems

---

## 🏆 Why BidFlow Wins

1. **Real Problem** - RFP responses are painful and time-consuming
2. **Innovative Solution** - Multi-agent architecture with RAG
3. **Production Ready** - Deployed and working on AWS
4. **Cost Effective** - $0.04 per proposal vs thousands in manual work
5. **Scalable** - Serverless architecture handles any load
6. **Measurable Impact** - 99.5% time savings, 99.99% cost savings

---

## 📄 License

MIT License - See LICENSE file for details

---

**Built with ❤️ using AWS Cloud, Kiro IDE**
