# BidFlow Quick Start Guide

Get BidFlow up and running in 30 minutes.

## Prerequisites Check

Run these commands to verify you have everything:

```bash
# Check AWS CLI
aws --version
# Expected: aws-cli/2.x.x

# Check Node.js
node --version
# Expected: v18.x.x or higher

# Check Python
python3 --version
# Expected: Python 3.12.x

# Check AWS credentials
aws sts get-caller-identity
# Should return your AWS account info
```

If any command fails, see [DEPLOYMENT.md](DEPLOYMENT.md) for installation instructions.

## Step 1: Enable Bedrock Models (5 minutes)

1. Go to: https://console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess
2. Click **Manage model access**
3. Enable:
   - ✅ Claude 3.5 Sonnet
   - ✅ Amazon Nova Lite
   - ✅ Titan Embeddings G1 - Text v2
4. Click **Save changes**

## Step 2: Deploy Infrastructure (5 minutes)

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Deploy CDK stack
./scripts/deploy-infrastructure.sh
```

When prompted:
- Confirm Bedrock access: `y`
- Proceed with deployment: `y`

**Save the API URL from the output!**

## Step 3: Create Sample PDFs (10 minutes)

Create 5 simple PDF files in `docs/sample-pdfs/`:

**Quick template for each PDF:**

```
[Document Title]

This is a sample document for [Company Name].

Key capabilities:
- ISO 27001 certified security practices
- SOC 2 Type II compliance
- SSO integration via SAML and OIDC
- 99.9% SLA guarantee
- Multi-tenancy architecture
- Encryption at rest and in transit

We have successfully delivered similar projects for enterprise clients
in healthcare, finance, and technology sectors.

Contact: info@company.com
```

Create these 5 PDFs:
1. `company-profile.pdf`
2. `case-study-saas-migration.pdf`
3. `case-study-sso-integration.pdf`
4. `case-study-security-audit.pdf`
5. `capabilities-deck-saas-delivery.pdf`

**Tip:** Use Google Docs or Microsoft Word, then "Save as PDF"

## Step 4: Setup Knowledge Base (5 minutes)

```bash
./scripts/setup-knowledge-base.sh
```

When prompted:
- PDFs created: `y`
- Follow the manual steps in AWS Console
- Enter Knowledge Base ID when prompted

**Manual steps (in AWS Console):**
1. Go to: https://console.aws.amazon.com/bedrock/home?region=us-east-1#/knowledge-bases
2. Click **Create knowledge base**
3. Name: `BidFlowCompanyMemory`
4. Click **Next** → **Next** → **Next** → **Create**
5. Click **Sync** button
6. Copy the Knowledge Base ID (10 characters)
7. Paste into terminal when prompted

## Step 5: Test Backend (2 minutes)

```bash
./scripts/test-backend.sh
```

Expected output:
```
✅ API call successful!
✅ Self-correction loop triggered
✅ All tests passed!
```

## Step 6: Deploy Frontend (3 minutes)

```bash
./scripts/deploy-frontend.sh
```

Choose option:
- **A** for AWS Amplify (recommended for production)
- **B** for local testing

For local testing:
- Access at: http://localhost:3000
- Click "Load Demo RFP"
- Click "Generate"
- Watch the magic happen! ✨

## Verification Checklist

Your deployment is successful when you see:

- ✅ Infrastructure deployed (Step 2)
- ✅ Knowledge Base synced (Step 4)
- ✅ Backend tests passed (Step 5)
- ✅ Frontend loads (Step 6)
- ✅ Demo RFP generates proposal
- ✅ Self-correction loop visible in timeline
- ✅ Final proposal displays in Markdown

## What You Just Built

You now have a complete agentic AI system that:

1. **Extracts** requirements from RFP text
2. **Retrieves** relevant evidence from your documents
3. **Strategizes** win themes and proof points
4. **Writes** formal proposal drafts
5. **Audits** for compliance gaps
6. **Self-corrects** when issues found

All in under 60 seconds per RFP!

## Next Steps

### Customize Your System

1. **Replace sample PDFs** with your actual company docs
2. **Adjust prompts** in `backend/src/prompts.py`
3. **Modify UI** in `frontend/bidflow-ui/app/page.tsx`

### Production Deployment

1. **Push to Git** and deploy on Amplify
2. **Add authentication** (Cognito/IAM)
3. **Set up monitoring** (CloudWatch)
4. **Configure custom domain**

### Cost Management

- Monitor costs in AWS Cost Explorer
- Set up billing alerts
- Delete OpenSearch collection when not in use

## Troubleshooting

**Backend test fails:**
```bash
# Check Lambda logs
aws logs tail /aws/lambda/AgentOrchestrator --follow
```

**Frontend can't connect:**
```bash
# Verify API URL in .env.local
cat frontend/bidflow-ui/.env.local
```

**Knowledge Base returns no results:**
- Verify sync completed in AWS Console
- Check PDFs contain keywords (ISO 27001, SOC 2, SSO, SLA)

## Cleanup

When you're done testing:

```bash
./scripts/cleanup.sh
```

This removes all AWS resources to avoid charges.

## Get Help

- Full deployment guide: [DEPLOYMENT.md](DEPLOYMENT.md)
- Architecture details: [README.md](README.md)
- AWS Support: https://console.aws.amazon.com/support/

---

**Estimated Total Time:** 30 minutes
**Estimated Cost:** $0.10-0.50 for testing (mostly Bedrock API calls)

Happy building! 🚀
