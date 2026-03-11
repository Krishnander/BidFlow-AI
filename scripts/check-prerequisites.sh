#!/bin/bash

# BidFlow Prerequisites Checker
# This script verifies all prerequisites are installed and configured

echo "========================================="
echo "BidFlow Prerequisites Checker"
echo "========================================="
echo ""

ERRORS=0
WARNINGS=0

# Function to check command existence
check_command() {
    if command -v $1 &> /dev/null; then
        echo "✅ $2 found: $($1 $3 2>&1 | head -n1)"
        return 0
    else
        echo "❌ $2 not found"
        echo "   Install: $4"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Check AWS CLI
echo "Checking AWS CLI..."
check_command "aws" "AWS CLI" "--version" "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
echo ""

# Check Node.js
echo "Checking Node.js..."
if check_command "node" "Node.js" "--version" "https://nodejs.org/"; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo "⚠️  Warning: Node.js version should be 18 or higher"
        WARNINGS=$((WARNINGS + 1))
    fi
fi
echo ""

# Check npm
echo "Checking npm..."
check_command "npm" "npm" "--version" "Comes with Node.js"
echo ""

# Check Python
echo "Checking Python..."
if check_command "python3" "Python 3" "--version" "https://www.python.org/downloads/"; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
    PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
    PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)
    if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 12 ]); then
        echo "⚠️  Warning: Python 3.12+ recommended (you have $PYTHON_VERSION)"
        WARNINGS=$((WARNINGS + 1))
    fi
fi
echo ""

# Check Git
echo "Checking Git..."
check_command "git" "Git" "--version" "https://git-scm.com/downloads"
echo ""

# Check AWS CDK
echo "Checking AWS CDK..."
if ! check_command "cdk" "AWS CDK" "--version" "npm install -g aws-cdk"; then
    echo "   Run: npm install -g aws-cdk"
fi
echo ""

# Check jq (for JSON parsing in scripts)
echo "Checking jq..."
if ! check_command "jq" "jq (JSON processor)" "--version" "https://stedolan.github.io/jq/download/"; then
    echo "   macOS: brew install jq"
    echo "   Ubuntu: sudo apt-get install jq"
    echo "   Windows: Download from https://stedolan.github.io/jq/download/"
fi
echo ""

# Check AWS credentials
echo "Checking AWS credentials..."
if aws sts get-caller-identity &> /dev/null; then
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    AWS_USER=$(aws sts get-caller-identity --query Arn --output text)
    AWS_REGION=$(aws configure get region || echo "not set")
    
    echo "✅ AWS credentials configured"
    echo "   Account: $AWS_ACCOUNT"
    echo "   User: $AWS_USER"
    echo "   Region: $AWS_REGION"
    
    if [ "$AWS_REGION" != "us-east-1" ]; then
        echo "⚠️  Warning: Region is $AWS_REGION, but BidFlow is designed for us-east-1"
        echo "   Bedrock model availability varies by region"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "❌ AWS credentials not configured"
    echo "   Run: aws configure"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check Bedrock access (best effort)
echo "Checking Bedrock access..."
echo "⚠️  Cannot automatically verify Bedrock model access"
echo "   Please ensure you have enabled these models in us-east-1:"
echo "   - Claude 3.5 Sonnet"
echo "   - Amazon Nova Lite"
echo "   - Titan Embeddings v2"
echo ""
echo "   To enable: https://console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess"
echo ""

# Summary
echo "========================================="
echo "Summary"
echo "========================================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ All prerequisites met!"
    echo ""
    echo "You're ready to deploy BidFlow."
    echo ""
    echo "Next steps:"
    echo "1. Enable Bedrock model access (see link above)"
    echo "2. Run: ./scripts/deploy-infrastructure.sh"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  Prerequisites met with $WARNINGS warning(s)"
    echo ""
    echo "You can proceed, but review the warnings above."
    echo ""
    echo "Next steps:"
    echo "1. Enable Bedrock model access"
    echo "2. Run: ./scripts/deploy-infrastructure.sh"
    exit 0
else
    echo "❌ $ERRORS error(s) and $WARNINGS warning(s) found"
    echo ""
    echo "Please install missing prerequisites before deploying."
    echo ""
    echo "See DEPLOYMENT.md for detailed installation instructions."
    exit 1
fi
