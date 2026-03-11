# BidFlow Deployment Guide

Complete step-by-step instructions for deploying BidFlow to AWS.

## Prerequisites

Before you begin, ensure you have:

- ✅ AWS Account with admin access
- ✅ AWS CLI v2 installed and configured
- ✅ Node.js 18+ installed
- ✅ Python 3.12+ installed
- ✅ Git installed
- ✅ Terminal/Command line access

## Quick Start

For automated deployment, run these scripts in order:

```bash
# 1. Deploy infrastructure
./scripts/deploy-infrastructure.sh

# 2. Setup Knowledge Base (includes manual steps)
./scripts/setup-knowledge-base.sh

# 3. Test backend API
./scripts/test-backend.sh

# 4. Deploy frontend
./scripts/deploy-frontend.sh
```

## Detailed Step-by-Step Instructions

### Phase 1: AWS Account Setup

#### 1.1 Install AWS CLI

**macOS:**
```bash
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /
```

**Windows:**
Download and run: https://awscli.amazonaws.com/AWSCLIV2.msi

**Linux:**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

Verify installation:
```bash
aws --version
```

#### 1.2 Configure AWS Credentials

```bash
aws configure
```

Enter:
- AWS Access Key ID: `[Your access key]`
- AWS Secret Access Key: `[Your secret key]`
- Default region name: `us-east-1`
- Default output format: `json`

Verify configuration:
```bash
aws sts get-caller-identity
```

#### 1.3 Enable Bedrock Model Access

1. Go to AWS Console: https://console.aws.amazon.com/bedrock/
2. Select region: **us-east-1** (top-right corner)
3. Click **Model access** in left sidebar
4. Click **Manage model access** button
5. Enable these models:
   - ✅ Claude 3.5 Sonnet
   - ✅ Amazon Nova Lite
   - ✅ Titan Embeddings G1 - Text v2
6. Click **Save changes**
7. Wait for status to change to "Access granted" (usually instant)

### Phase 2: Infrastructure Deployment

#### 2.1 Install Dependencies

```bash
# Install AWS CDK CLI globally
npm install -g aws-cdk

# Verify installation
cdk --version
```

#### 2.2 Make Scripts Executable

```bash
chmod +x scripts/*.sh
```

#### 2.3 Deploy Infrastructure

```bash
./scripts/deploy-infrastructure.sh
```

This script will:
- ✅ Check all prerequisites
- ✅ Install CDK dependencies
- ✅ Bootstrap CDK (if needed)
- ✅ Deploy CloudFormation stack
- ✅ Create S3 bucket, DynamoDB table, Lambda function, API Gateway
- ✅ Save deployment outputs to `deployment-outputs.json`

**Expected output:**
```
========================================
Deployment Complete!
========================================

Stack outputs:
┌─────────────────┬──────────────────────────────────────────────┐
│ OutputKey       │ OutputValue                                   │
├─────────────────┼──────────────────────────────────────────────┤
│ HttpApiUrl      │ https://abc123.execute-api.us-east-1.amazo...│
│ BucketName      │ bidflow-documents                             │
│ TableName       │ BidProjectState                               │
│ LambdaFunction  │ AgentOrchestrator                             │
└─────────────────┴──────────────────────────────────────────────┘
```

**Troubleshooting:**

- **Error: "Unable to resolve AWS account"**
  - Run: `aws configure` and enter valid credentials

- **Error: "CDK bootstrap required"**
  - Run: `cdk bootstrap aws://ACCOUNT-ID/us-east-1`

- **Error: "Stack already exists"**
  - Run: `cdk destroy` then redeploy

### Phase 3: Knowledge Base Setup

#### 3.1 Create Company Documentation PDFs

Create 5 PDF files in `docs/sample-pdfs/` directory:

**1. company-profile.pdf**
```
Helix Systems - Company Profile

About Us:
Helix Systems is a leading SaaS services provider specializing in cloud-native 
solutions for enterprise customers. We maintain ISO 27001 and SOC 2 Type II 
certifications, demonstrating our commitment to security and compliance.

Our security practices include:
- Annual ISO 27001 audits
- SOC 2 Type II attestation
- Regular penetration testing
- 24/7 security monitoring
- Incident response procedures

We serve 500+ enterprise customers across healthcare, finance, and technology sectors.
```

**2. case-study-saas-migration.pdf**
```
Case Study: Enterprise SaaS Cloud Migration

Client: Fortune 500 Financial Services Company

Challenge:
Migrate legacy on-premises application to cloud-native SaaS architecture.

Solution:
- Containerized microservices architecture
- Multi-region deployment for high availability
- Comprehensive observability with CloudWatch and Datadog
- Automated CI/CD pipeline

Results:
- Achieved 99.95% uptime SLA
- Reduced infrastructure costs by 40%
- Improved deployment frequency from monthly to daily
- Zero-downtime deployments
```

**3. case-study-sso-integration.pdf**
```
Case Study: Enterprise SSO Integration

Client: Healthcare Technology Company

Challenge:
Implement single sign-on for 10,000+ users across multiple identity providers.

Solution:
- SAML 2.0 integration with Okta, Azure AD, and Google Workspace
- OIDC support for modern applications
- Multi-factor authentication (MFA) enforcement
- Just-in-time (JIT) user provisioning

Results:
- Reduced login time by 80%
- Improved security posture
- Simplified user management
- 99.9% authentication success rate
```

**4. case-study-security-audit.pdf**
```
Case Study: Security Audit and Hardening

Client: B2B SaaS Platform

Challenge:
Achieve ISO 27001 and SOC 2 compliance for enterprise customers.

Solution:
- Comprehensive security audit
- Implementation of security controls
- Encryption at rest and in transit
- Regular vulnerability scanning
- Penetration testing
- Security awareness training

Results:
- Achieved ISO 27001 certification
- Obtained SOC 2 Type II attestation
- Zero critical vulnerabilities
- Passed all customer security audits
```

**5. capabilities-deck-saas-delivery.pdf**
```
Helix Systems - SaaS Delivery Capabilities

Multi-Tenancy Architecture:
- Isolated tenant data with row-level security
- Shared infrastructure for cost efficiency
- Tenant-specific customization support

Security & Compliance:
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- ISO 27001 certified
- SOC 2 Type II compliant
- GDPR and HIPAA ready

DevSecOps Practices:
- Automated security scanning in CI/CD
- Infrastructure as Code (IaC)
- Immutable infrastructure
- Automated backup and disaster recovery

SLA Commitments:
- 99.9% uptime guarantee
- < 100ms API response time (p95)
- 24/7 support for critical issues
- Monthly uptime reports
```

**Tips for creating PDFs:**
- Use any word processor (Microsoft Word, Google Docs, LibreOffice)
- Include the key terms: ISO 27001, SOC 2, SSO, SAML, OIDC, SLA
- Export as PDF
- Save to `docs/sample-pdfs/` directory

#### 3.2 Run Knowledge Base Setup Script

```bash
./scripts/setup-knowledge-base.sh
```

This script will:
- ✅ Upload PDFs to S3
- ✅ Provide instructions for creating Knowledge Base
- ✅ Update Lambda with Knowledge Base ID

**Manual steps in AWS Console:**

1. Open: https://console.aws.amazon.com/bedrock/home?region=us-east-1#/knowledge-bases

2. Click **Create knowledge base**

3. **Provide knowledge base details:**
   - Name: `BidFlowCompanyMemory`
   - Description: `Company documentation for BidFlow RAG`
   - IAM permissions: **Create and use a new service role**
   - Click **Next**

4. **Set up data source:**
   - Data source name: `BidFlowDocs`
   - S3 URI: `s3://bidflow-documents/` (from script output)
   - Click **Next**

5. **Select embeddings model:**
   - Embeddings model: **Titan Embeddings G1 - Text v2**
   - Click **Next**

6. **Configure vector store:**
   - Vector database: **Quick create a new vector store**
   - Click **Next**

7. **Review and create:**
   - Review all settings
   - Click **Create knowledge base**

8. **Wait for creation** (2-3 minutes)

9. **Sync data source:**
   - In Knowledge Base details page
   - Click **Data source** tab
   - Click **Sync** button
   - Wait for sync to complete (1-2 minutes)

10. **Test retrieval:**
    - Click **Test** button (top-right)
    - Enter query: `ISO 27001 compliance`
    - Verify results are returned with source citations

11. **Copy Knowledge Base ID:**
    - Shown at top of page (format: `XXXXXXXXXX`)
    - Enter when prompted by script

### Phase 4: Backend Testing

#### 4.1 Test API Endpoints

```bash
./scripts/test-backend.sh
```

This script will:
- ✅ Test POST /run endpoint with demo RFP
- ✅ Verify agent pipeline execution
- ✅ Check self-correction loop
- ✅ Test GET /runs endpoint
- ✅ Save full response to `test-response.json`

**Expected output:**
```
========================================
Test 1: POST /run (Execute Pipeline)
========================================

HTTP Status: 200
✅ API call successful!

Results:
  Trace ID: 550e8400-e29b-41d4-a716-446655440000
  Log entries: 10
  Cost estimate: $0.04
  Elapsed time: 42.5s

✅ Self-correction loop triggered (draft_v2 exists)

Agent Timeline:
  [Extractor] Parsing RFP into a structured checklist...
  [Researcher] Searching Knowledge Base for relevant evidence...
  [Researcher] Retrieved 6 evidence chunks.
  [Strategist] Creating win themes and response plan...
  [Writer] Writing proposal draft (v1)...
  [Critic] Auditing draft for compliance gaps...
  [Critic] REJECT: Missing ISO 27001
  [Writer] Rewriting draft to fix issues (v2)...
  [Critic] Re-auditing revised draft...
  [Critic] APPROVED
```

**Troubleshooting:**

- **Error: "Knowledge Base retrieval failed"**
  - Verify Knowledge Base ID is correct
  - Check Knowledge Base sync completed
  - Ensure Lambda has `bedrock-agent-runtime:Retrieve` permission

- **Error: "Bedrock throttling"**
  - Wait a few minutes and retry
  - Check Bedrock service quotas in AWS Console

- **Error: "Invalid JSON from Extractor"**
  - This is expected occasionally
  - Fallback checklist should activate automatically
  - Check CloudWatch logs for details

### Phase 5: Frontend Deployment

#### 5.1 Local Testing (Optional)

```bash
cd frontend/bidflow-ui
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

Test the UI:
1. Click "Load Demo RFP"
2. Click "Generate"
3. Watch agent timeline
4. View final proposal

Press Ctrl+C to stop the dev server.

#### 5.2 Deploy Frontend

```bash
./scripts/deploy-frontend.sh
```

This script will:
- ✅ Install dependencies
- ✅ Configure environment variables
- ✅ Build Next.js application
- ✅ Provide deployment options

**Option A: AWS Amplify (Recommended)**

1. Push code to Git repository:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/bidflow.git
git push -u origin main
```

2. Follow script instructions to deploy on Amplify

3. Access your app at the Amplify URL

**Option B: Local Server**

```bash
cd frontend/bidflow-ui
npm start
```

Access at http://localhost:3000

### Phase 6: End-to-End Testing

#### 6.1 Test Complete System

1. Open frontend URL in browser

2. Click **Load Demo RFP**

3. Click **Generate**

4. Observe agent timeline:
   - Extractor parses RFP
   - Researcher retrieves evidence
   - Strategist creates strategy
   - Writer generates draft v1
   - Critic rejects (missing compliance)
   - Writer generates draft v2
   - Critic approves

5. View final proposal in Markdown

6. Check cost estimate badge

7. Switch tabs to view intermediate artifacts

#### 6.2 Test with Custom RFP

Create your own RFP text with these requirements:
- Mention ISO 27001, SOC 2, SSO, SLA
- Request delivery timeline
- Ask for relevant experience

Generate and verify the output.

## Deployment Checklist

Use this checklist to track your deployment progress:

- [ ] AWS CLI installed and configured
- [ ] Bedrock model access enabled (Claude, Nova, Titan)
- [ ] Infrastructure deployed (`deploy-infrastructure.sh`)
- [ ] Company documentation PDFs created
- [ ] PDFs uploaded to S3
- [ ] Knowledge Base created and synced
- [ ] Lambda updated with Knowledge Base ID
- [ ] Backend API tested (`test-backend.sh`)
- [ ] Frontend configured and built
- [ ] Frontend deployed (Amplify or local)
- [ ] End-to-end testing completed

## Cost Monitoring

### Expected Costs

**Free Tier (First 12 months):**
- Lambda: 1M requests/month free
- DynamoDB: 25 GB storage free
- S3: 5 GB storage free
- API Gateway: 1M requests/month free

**Beyond Free Tier:**
- Per run: $0.03-0.04 (Bedrock models)
- OpenSearch Serverless: ~$175/month (largest cost)
- Lambda: ~$0.20 per 1,000 executions
- DynamoDB: ~$0.25 per million writes

**Cost Optimization Tips:**
- Use pay-per-request DynamoDB billing
- Limit Knowledge Base retrieval to 6 chunks
- Single revision cycle per run
- Delete OpenSearch collection when not in use

### Monitor Costs

1. Go to AWS Cost Explorer:
   https://console.aws.amazon.com/cost-management/home

2. Filter by service:
   - Amazon Bedrock
   - AWS Lambda
   - Amazon DynamoDB
   - Amazon OpenSearch Service

3. Set up billing alerts:
   - Go to CloudWatch → Alarms
   - Create alarm for estimated charges
   - Set threshold (e.g., $50/month)

## Cleanup

To remove all resources and avoid ongoing charges:

```bash
./scripts/cleanup.sh
```

This will:
- Empty S3 bucket
- Destroy CDK stack
- Provide instructions for manual cleanup

**Manual cleanup required:**
- Knowledge Base (AWS Console)
- OpenSearch Serverless collection (AWS Console)
- Amplify app (if deployed)

## Troubleshooting

### Common Issues

**1. CDK deployment fails**
- Check AWS credentials: `aws sts get-caller-identity`
- Verify region is us-east-1
- Check CloudFormation console for error details

**2. Knowledge Base retrieval returns no results**
- Verify sync completed successfully
- Check PDFs contain relevant keywords
- Test retrieval in AWS Console

**3. Frontend can't connect to API**
- Verify `NEXT_PUBLIC_API_BASE_URL` is set correctly
- Check API Gateway CORS configuration
- Inspect browser console for errors

**4. Lambda timeout**
- Check CloudWatch logs for slow operations
- Verify Bedrock API latency
- Consider increasing timeout beyond 60s

**5. High costs**
- Check OpenSearch Serverless usage (largest cost)
- Monitor Bedrock API calls
- Review CloudWatch metrics

### Getting Help

- AWS Documentation: https://docs.aws.amazon.com/
- Bedrock Documentation: https://docs.aws.amazon.com/bedrock/
- CDK Documentation: https://docs.aws.amazon.com/cdk/
- Next.js Documentation: https://nextjs.org/docs

## Next Steps

After successful deployment:

1. **Customize PDFs**: Replace sample PDFs with your actual company documentation

2. **Adjust Prompts**: Modify prompts in `backend/src/prompts.py` for your use case

3. **Add Authentication**: Implement Cognito or IAM authentication for API Gateway

4. **Enable Monitoring**: Set up CloudWatch dashboards and alarms

5. **Implement CI/CD**: Automate deployments with GitHub Actions or AWS CodePipeline

6. **Scale Testing**: Test with higher volumes and optimize performance

7. **Production Hardening**: Add rate limiting, input validation, error handling

## Success Criteria

Your deployment is successful when:

✅ Infrastructure deployed without errors
✅ Knowledge Base returns relevant results
✅ Backend API responds with 200 status
✅ Self-correction loop triggers correctly
✅ Frontend displays agent timeline
✅ Final proposal renders in Markdown
✅ Cost estimate displays correctly
✅ All tests pass

Congratulations! Your BidFlow system is now deployed and operational! 🎉
