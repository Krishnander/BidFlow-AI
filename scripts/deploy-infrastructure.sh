#!/bin/bash

# BidFlow Infrastructure Deployment Script
# This script deploys the CDK stack to AWS

set -e  # Exit on error

echo "========================================="
echo "BidFlow Infrastructure Deployment"
echo "========================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install AWS CLI v2."
    echo "   Visit: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi
echo "✅ AWS CLI found: $(aws --version)"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js found: $(node --version)"

# Check CDK CLI
if ! command -v cdk &> /dev/null; then
    echo "❌ AWS CDK CLI not found. Installing..."
    npm install -g aws-cdk
fi
echo "✅ AWS CDK found: $(cdk --version)"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found. Please install Python 3.12+."
    exit 1
fi
echo "✅ Python found: $(python3 --version)"

# Check AWS credentials
echo ""
echo "Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured."
    echo "   Run: aws configure"
    exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "us-east-1")
echo "✅ AWS Account: $AWS_ACCOUNT"
echo "✅ AWS Region: $AWS_REGION"

# Verify region is us-east-1
if [ "$AWS_REGION" != "us-east-1" ]; then
    echo "⚠️  Warning: Current region is $AWS_REGION"
    echo "   BidFlow is designed for us-east-1 (Bedrock model availability)"
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
fi

# Check Bedrock model access
echo ""
echo "Checking Bedrock model access..."
echo "⚠️  Please ensure you have requested access to these models in us-east-1:"
echo "   - Claude 3.5 Sonnet (anthropic.claude-3-5-sonnet-20240620-v1:0)"
echo "   - Amazon Nova Lite (amazon.nova-lite-v1:0)"
echo "   - Titan Embeddings v2 (amazon.titan-embed-text-v2:0)"
echo ""
echo "   To request access:"
echo "   1. Go to AWS Console → Amazon Bedrock → Model access"
echo "   2. Select us-east-1 region"
echo "   3. Click 'Manage model access'"
echo "   4. Enable the models listed above"
echo "   5. Wait for access to be granted (usually instant)"
echo ""
read -p "Have you enabled Bedrock model access? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please enable Bedrock model access first, then re-run this script."
    exit 1
fi

# Navigate to infra directory
echo ""
echo "Navigating to infrastructure directory..."
cd "$(dirname "$0")/../infra" || exit 1

# Install dependencies
echo ""
echo "Installing CDK dependencies..."
npm install

# Bootstrap CDK (if needed)
echo ""
echo "Checking CDK bootstrap status..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region us-east-1 &> /dev/null; then
    echo "CDK not bootstrapped. Bootstrapping now..."
    cdk bootstrap aws://$AWS_ACCOUNT/us-east-1
else
    echo "✅ CDK already bootstrapped"
fi

# Synthesize CloudFormation template
echo ""
echo "Synthesizing CloudFormation template..."
cdk synth

# Deploy stack
echo ""
echo "Deploying BidFlow stack..."
echo "This will create:"
echo "  - S3 bucket: bidflow-documents"
echo "  - DynamoDB table: BidProjectState"
echo "  - Lambda function: AgentOrchestrator"
echo "  - API Gateway HTTP API"
echo ""
read -p "Proceed with deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

cdk deploy --require-approval never

# Extract outputs
echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Stack outputs:"
aws cloudformation describe-stacks \
    --stack-name BidFlowStack \
    --region us-east-1 \
    --query 'Stacks[0].Outputs' \
    --output table

# Save outputs to file
echo ""
echo "Saving outputs to deployment-outputs.json..."
aws cloudformation describe-stacks \
    --stack-name BidFlowStack \
    --region us-east-1 \
    --query 'Stacks[0].Outputs' \
    --output json > ../deployment-outputs.json

echo "✅ Outputs saved to deployment-outputs.json"
echo ""
echo "Next steps:"
echo "1. Create Knowledge Base (run: ./scripts/setup-knowledge-base.sh)"
echo "2. Upload company documentation PDFs"
echo "3. Update Lambda environment variable with Knowledge Base ID"
echo "4. Deploy frontend (run: ./scripts/deploy-frontend.sh)"
