# BidFlow Backend

Python Lambda function for multi-agent RFP proposal generation.

## Architecture

The backend implements a five-agent pipeline with self-correction:

```
Extractor → Researcher → Strategist → Writer → Critic
                                         ↓
                                    (if rejected)
                                         ↓
                                    Writer v2 → Critic v2
```

## Modules

### `handler.py`
Main Lambda entry point. Routes POST /run and GET /runs requests. Orchestrates the complete multi-agent pipeline.

### `bedrock.py`
Bedrock API integration:
- `invoke_claude()`: Claude 3.5 Sonnet for strategy and writing
- `invoke_nova()`: Amazon Nova Lite for extraction and auditing
- `kb_retrieve()`: Knowledge Base retrieval using Retrieve API

### `prompts.py`
Prompt templates for all agents:
- `EXTRACTOR_PROMPT`: Parse RFP into JSON checklist
- `STRATEGIST_PROMPT`: Generate win themes and proof points
- `WRITER_PROMPT`: Generate formal Markdown proposal
- `CRITIC_PROMPT`: Audit for compliance gaps

### `dynamo.py`
DynamoDB persistence:
- `save_run()`: Store run record with artifacts
- `query_runs()`: Retrieve run history

### `cost.py`
Cost estimation:
- `estimate_cost()`: Calculate estimated cost per run
- `estimate_cost_detailed()`: Token-based cost breakdown

## Environment Variables

Required:
- `REGION`: AWS region (default: us-east-1)
- `TABLE_NAME`: DynamoDB table name
- `BUCKET_NAME`: S3 bucket name
- `KNOWLEDGE_BASE_ID`: Bedrock Knowledge Base ID
- `CLAUDE_MODEL_ID`: Claude model ID
- `NOVA_LITE_MODEL_ID`: Nova Lite model ID

## API Endpoints

### POST /run

Execute agent pipeline for RFP proposal generation.

**Request:**
```json
{
  "project_id": "demo-001",
  "rfp_text": "We are a B2B SaaS company..."
}
```

**Response:**
```json
{
  "trace_id": "uuid",
  "project_id": "demo-001",
  "log": [
    {"agent": "Extractor", "msg": "Parsing RFP..."},
    {"agent": "Researcher", "msg": "Retrieved 6 evidence chunks."},
    ...
  ],
  "artifacts": {
    "checklist": {...},
    "evidence": [...],
    "strategy": "...",
    "draft_v1": "...",
    "critic_v1": "...",
    "draft_v2": "...",
    "critic_v2": "..."
  },
  "final_markdown": "# Executive Summary\n...",
  "cost_estimate_usd": 0.04,
  "elapsed_seconds": 42.5
}
```

### GET /runs?project_id=demo-001

Query run history for a project.

**Response:**
```json
{
  "project_id": "demo-001",
  "runs": [
    {
      "timestamp": "1704067200",
      "trace_id": "uuid",
      "elapsed_seconds": 42.5,
      "cost_estimate_usd": 0.04
    }
  ]
}
```

## Agent Details

### 1. Extractor (Nova Lite)
- Parses RFP text into structured JSON checklist
- Identifies compliance requirements (ISO 27001, SOC 2, SSO, SLA)
- Fallback to default checklist if JSON parsing fails

### 2. Researcher (Knowledge Base)
- Retrieves top 6 relevant evidence chunks from company docs
- Uses Bedrock Agent Runtime Retrieve API
- Formats evidence with source URIs

### 3. Strategist (Claude Sonnet)
- Generates 3 win themes
- Generates 3 proof points referencing evidence
- Identifies 2 risks with mitigations

### 4. Writer (Claude Sonnet)
- Generates formal Markdown proposal with 7 sections
- Includes all must_include_terms from checklist
- Respects word_limit constraint
- Incorporates critic feedback for revisions

### 5. Critic (Nova Lite)
- Audits draft for compliance gaps
- Returns "APPROVED" or "REJECT: <reason>"
- Checks for ISO 27001, SOC 2, SSO, SLA, timeline
- Validates word limit compliance

## Self-Correction Loop

If Critic rejects draft_v1:
1. Writer generates draft_v2 with critic feedback
2. Critic re-audits draft_v2
3. Maximum one revision cycle per run
4. If draft_v2 rejected, returns with human review flag

## Error Handling

- Input validation: Returns 400 for empty RFP text
- Agent failures: Returns 500 with descriptive error message
- Invalid JSON from Extractor: Uses fallback checklist
- KB retrieval failure: Returns 500 with error details
- All errors logged to CloudWatch with trace_id

## Testing

Run unit tests:
```bash
cd backend
python -m pytest tests/
```

Run property-based tests:
```bash
python -m pytest tests/test_properties.py
```

## Deployment

The backend is deployed as part of the CDK stack:
```bash
cd infra
cdk deploy
```

Lambda function code is automatically packaged from `backend/src/`.

## Cost Optimization

- Nova Lite for fast/cheap operations (Extractor, Critic)
- Claude Sonnet for high-quality operations (Strategist, Writer)
- Single revision cycle to control costs
- Pay-per-request DynamoDB billing
- Estimated cost per run: $0.03-0.04
