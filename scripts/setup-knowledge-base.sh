#!/bin/bash

# BidFlow Knowledge Base Setup Script
# This script provides instructions for setting up the Bedrock Knowledge Base

set -e

echo "========================================="
echo "BidFlow Knowledge Base Setup"
echo "========================================="
echo ""

# Check if deployment outputs exist
if [ ! -f "deployment-outputs.json" ]; then
    echo "❌ deployment-outputs.json not found."
    echo "   Please run ./scripts/deploy-infrastructure.sh first."
    exit 1
fi

# Extract bucket name from outputs
BUCKET_NAME=$(jq -r '.[] | select(.OutputKey=="BucketName") | .OutputValue' deployment-outputs.json)

if [ -z "$BUCKET_NAME" ] || [ "$BUCKET_NAME" == "null" ]; then
    echo "❌ Could not find S3 bucket name in deployment outputs."
    exit 1
fi

echo "S3 Bucket: $BUCKET_NAME"
echo ""

# Check if sample PDFs directory exists
if [ ! -d "docs/sample-pdfs" ]; then
    echo "Creating sample PDFs directory..."
    mkdir -p docs/sample-pdfs
fi

echo "========================================="
echo "Step 1: Create Company Documentation PDFs"
echo "========================================="
echo ""
echo "You need to create 5 PDF files with SaaS-focused content:"
echo ""
echo "1. company-profile.pdf"
echo "   - Company overview"
echo "   - Explicitly mention ISO 27001 & SOC 2 alignment practices"
echo "   - Security certifications and compliance"
echo ""
echo "2. case-study-saas-migration.pdf"
echo "   - SaaS cloud migration project"
echo "   - SLA outcomes (99.9% uptime)"
echo "   - Observability and monitoring"
echo ""
echo "3. case-study-sso-integration.pdf"
echo "   - SSO implementation (SAML/OIDC)"
echo "   - Identity provider integration"
echo "   - Multi-factor authentication"
echo ""
echo "4. case-study-security-audit.pdf"
echo "   - Security audit and hardening"
echo "   - ISO 27001 and SOC 2 compliance"
echo "   - Penetration testing results"
echo ""
echo "5. capabilities-deck-saas-delivery.pdf"
echo "   - SaaS delivery capabilities"
echo "   - Multi-tenancy architecture"
echo "   - Encryption at rest and in transit"
echo "   - DevSecOps practices"
echo ""
echo "Place these PDFs in: docs/sample-pdfs/"
echo ""
read -p "Have you created the PDF files? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Please create the PDF files first, then re-run this script."
    echo ""
    echo "Tip: You can use any word processor to create these documents,"
    echo "     then export as PDF. Focus on including the key terms:"
    echo "     ISO 27001, SOC 2, SSO, SAML, OIDC, SLA, multi-tenancy, encryption"
    exit 1
fi

echo ""
echo "========================================="
echo "Step 2: Upload PDFs to S3"
echo "========================================="
echo ""

# Check if PDFs exist
PDF_COUNT=$(ls docs/sample-pdfs/*.pdf 2>/dev/null | wc -l)
if [ "$PDF_COUNT" -lt 5 ]; then
    echo "⚠️  Warning: Found only $PDF_COUNT PDF files in docs/sample-pdfs/"
    echo "   Expected at least 5 PDFs."
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "Uploading PDFs to S3 bucket: $BUCKET_NAME"
aws s3 sync docs/sample-pdfs/ s3://$BUCKET_NAME/ --exclude "*" --include "*.pdf"

echo ""
echo "✅ PDFs uploaded successfully"
echo ""

# List uploaded files
echo "Uploaded files:"
aws s3 ls s3://$BUCKET_NAME/

echo ""
echo "========================================="
echo "Step 3: Create Knowledge Base (Manual)"
echo "========================================="
echo ""
echo "⚠️  This step must be done manually in the AWS Console:"
echo ""
echo "1. Open AWS Console → Amazon Bedrock → Knowledge Bases"
echo "2. Click 'Create knowledge base'"
echo "3. Configuration:"
echo "   - Name: BidFlowCompanyMemory"
echo "   - IAM permissions: Create and use a new service role"
echo "   - Click 'Next'"
echo ""
echo "4. Data source configuration:"
echo "   - Data source name: BidFlowDocs"
echo "   - S3 URI: s3://$BUCKET_NAME/"
echo "   - Click 'Next'"
echo ""
echo "5. Embeddings model:"
echo "   - Select: Titan Embeddings G1 - Text v2"
echo "   - Click 'Next'"
echo ""
echo "6. Vector database:"
echo "   - Select: Quick create a new vector store"
echo "   - This will create an OpenSearch Serverless collection"
echo "   - Click 'Next'"
echo ""
echo "7. Review and create:"
echo "   - Review all settings"
echo "   - Click 'Create knowledge base'"
echo ""
echo "8. Wait for creation to complete (2-3 minutes)"
echo ""
echo "9. Sync the data source:"
echo "   - In the Knowledge Base details page"
echo "   - Go to 'Data source' tab"
echo "   - Click 'Sync' button"
echo "   - Wait for sync to complete (1-2 minutes)"
echo ""
echo "10. Test the Knowledge Base:"
echo "    - Click 'Test' button"
echo "    - Enter query: 'ISO 27001 compliance'"
echo "    - Verify results are returned"
echo ""
echo "11. Copy the Knowledge Base ID:"
echo "    - It's shown at the top of the page"
echo "    - Format: XXXXXXXXXX (10 characters)"
echo ""
read -p "Press Enter when you have created and synced the Knowledge Base..."
echo ""

# Prompt for Knowledge Base ID
echo "========================================="
echo "Step 4: Update Lambda Configuration"
echo "========================================="
echo ""
read -p "Enter your Knowledge Base ID: " KB_ID

if [ -z "$KB_ID" ]; then
    echo "❌ Knowledge Base ID cannot be empty."
    exit 1
fi

echo ""
echo "Updating Lambda function environment variables..."

# Get current environment variables
CURRENT_ENV=$(aws lambda get-function-configuration \
    --function-name AgentOrchestrator \
    --region us-east-1 \
    --query 'Environment.Variables' \
    --output json)

# Update KNOWLEDGE_BASE_ID
UPDATED_ENV=$(echo $CURRENT_ENV | jq --arg kb_id "$KB_ID" '.KNOWLEDGE_BASE_ID = $kb_id')

# Update Lambda function
aws lambda update-function-configuration \
    --function-name AgentOrchestrator \
    --region us-east-1 \
    --environment "Variables=$UPDATED_ENV" \
    > /dev/null

echo "✅ Lambda function updated with Knowledge Base ID: $KB_ID"
echo ""

# Save KB ID to file
echo "$KB_ID" > knowledge-base-id.txt
echo "✅ Knowledge Base ID saved to knowledge-base-id.txt"

echo ""
echo "========================================="
echo "Knowledge Base Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Test the backend API (run: ./scripts/test-backend.sh)"
echo "2. Deploy frontend (run: ./scripts/deploy-frontend.sh)"
