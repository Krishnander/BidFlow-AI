#!/bin/bash

# BidFlow Prerequisites Checker
# This script verifies all prerequisites are installed and configured

# Parse command line arguments
AWS_PROFILE_ARG=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --profile)
            AWS_PROFILE_ARG="--profile $2"
            export AWS_PROFILE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--profile profile-name]"
            exit 1
            ;;
    esac
done

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
    PYTHON_VERSION=$(python3 --version 2>&1 | grep -oP '\d+\.\d+\.\d+' | head -n1)
    if [ -n "$PYTHON_VERSION" ]; then
        PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
        PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)
        if [ -n "$PYTHON_MAJOR" ] && [ -n "$PYTHON_MINOR" ]; then
            if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 12 ]); then
                echo "⚠️  Warning: Python 3.12+ recommended (you have $PYTHON_VERSION)"
                WARNINGS=$((WARNINGS + 1))
            fi
        fi
    fi
elif command -v python &> /dev/null; then
    echo "⚠️  'python3' not found, trying 'python'..."
    PYTHON_VERSION=$(python --version 2>&1 | grep -oP '\d+\.\d+\.\d+' | head -n1)
    if [ -n "$PYTHON_VERSION" ]; then
        echo "✅ Python found: Python $PYTHON_VERSION"
        PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
        PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)
        if [ -n "$PYTHON_MAJOR" ] && [ -n "$PYTHON_MINOR" ]; then
            if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 12 ]); then
                echo "⚠️  Warning: Python 3.12+ recommended (you have $PYTHON_VERSION)"
                WARNINGS=$((WARNINGS + 1))
            fi
        fi
    else
        echo "❌ Python not found or not properly installed"
        echo "   Windows: Download from https://www.python.org/downloads/"
        echo "   Make sure to check 'Add Python to PATH' during installation"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo "❌ Python not found"
    echo "   Windows: Download from https://www.python.org/downloads/"
    echo "   Make sure to check 'Add Python to PATH' during installation"
    ERRORS=$((ERRORS + 1))
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
if aws sts get-caller-identity $AWS_PROFILE_ARG &> /dev/null; then
    AWS_ACCOUNT=$(aws sts get-caller-identity $AWS_PROFILE_ARG --query Account --output text)
    AWS_USER=$(aws sts get-caller-identity $AWS_PROFILE_ARG --query Arn --output text)
    AWS_REGION=$(aws configure get region $AWS_PROFILE_ARG || echo "not set")
    
    echo "✅ AWS credentials configured"
    echo "   Account: $AWS_ACCOUNT"
    echo "   User: $AWS_USER"
    echo "   Region: $AWS_REGION"
    if [ -n "$AWS_PROFILE" ]; then
        echo "   Profile: $AWS_PROFILE"
    fi
    
    if [ "$AWS_REGION" != "us-east-1" ]; then
        echo "⚠️  Warning: Region is $AWS_REGION, but BidFlow is designed for us-east-1"
        echo "   Bedrock model availability varies by region"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "❌ AWS credentials not configured or SSO token expired"
    echo ""
    echo "   Option 1: Use a different profile"
    echo "   Run: $0 --profile personal"
    echo ""
    echo "   Option 2: Configure new credentials"
    echo "   Run: aws configure --profile personal"
    echo ""
    echo "   Option 3: Set environment variables"
    echo "   export AWS_ACCESS_KEY_ID=your-key"
    echo "   export AWS_SECRET_ACCESS_KEY=your-secret"
    echo "   export AWS_DEFAULT_REGION=us-east-1"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check Bedrock access (best effort)
echo "Checking Bedrock access..."
echo "ℹ️  Bedrock models are now automatically enabled on first use"
echo "   BidFlow uses these models in us-east-1:"
echo "   - Claude 3.5 Sonnet (anthropic.claude-3-5-sonnet-20241022-v2:0)"
echo "   - Amazon Nova Lite (us.amazon.nova-lite-v1:0)"
echo "   - Titan Embeddings v2 (amazon.titan-embed-text-v2:0)"
echo ""
echo "   Note: First-time Anthropic users may need to submit use case details"
echo "   Models will activate automatically when the Lambda function runs"
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
    echo "1. Run: ./scripts/deploy-infrastructure.sh"
    echo "2. Models will auto-enable on first Lambda invocation"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  Prerequisites met with $WARNINGS warning(s)"
    echo ""
    echo "You can proceed, but review the warnings above."
    echo ""
    echo "Next steps:"
    echo "1. Run: ./scripts/deploy-infrastructure.sh"
    echo "2. Models will auto-enable on first Lambda invocation"
    exit 0
else
    echo "❌ $ERRORS error(s) and $WARNINGS warning(s) found"
    echo ""
    echo "Please install missing prerequisites before deploying."
    echo ""
    echo "See DEPLOYMENT.md for detailed installation instructions."
    exit 1
fi
