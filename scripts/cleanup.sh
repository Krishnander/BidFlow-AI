#!/bin/bash

# BidFlow Cleanup Script
# This script removes all deployed AWS resources

set -e

echo "========================================="
echo "BidFlow Cleanup"
echo "========================================="
echo ""
echo "⚠️  WARNING: This will delete all BidFlow resources!"
echo ""
echo "This includes:"
echo "  - CDK Stack (Lambda, API Gateway, DynamoDB, S3)"
echo "  - Knowledge Base (manual deletion required)"
echo "  - OpenSearch Serverless collection (manual deletion required)"
echo "  - S3 bucket contents"
echo ""
read -p "Are you sure you want to continue? (yes/NO): " -r
echo

if [ "$REPLY" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "========================================="
echo "Step 1: Empty S3 Bucket"
echo "========================================="
echo ""

# Check if deployment outputs exist
if [ -f "deployment-outputs.json" ]; then
    BUCKET_NAME=$(jq -r '.[] | select(.OutputKey=="BucketName") | .OutputValue' deployment-outputs.json)
    
    if [ -n "$BUCKET_NAME" ] && [ "$BUCKET_NAME" != "null" ]; then
        echo "Emptying S3 bucket: $BUCKET_NAME"
        
        # Check if bucket exists
        if aws s3 ls "s3://$BUCKET_NAME" 2>/dev/null; then
            aws s3 rm "s3://$BUCKET_NAME" --recursive
            echo "✅ S3 bucket emptied"
        else
            echo "ℹ️  S3 bucket not found or already deleted"
        fi
    fi
else
    echo "ℹ️  No deployment outputs found, skipping S3 cleanup"
fi

echo ""
echo "========================================="
echo "Step 2: Destroy CDK Stack"
echo "========================================="
echo ""

cd "$(dirname "$0")/../infra" || exit 1

echo "Destroying BidFlow CDK stack..."
cdk destroy --force

echo "✅ CDK stack destroyed"

echo ""
echo "========================================="
echo "Step 3: Manual Cleanup Required"
echo "========================================="
echo ""
echo "The following resources must be deleted manually in AWS Console:"
echo ""
echo "1. Knowledge Base:"
echo "   - Go to: Amazon Bedrock → Knowledge Bases"
echo "   - Select: BidFlowCompanyMemory"
echo "   - Click: Delete"
echo ""
echo "2. OpenSearch Serverless Collection:"
echo "   - Go to: OpenSearch Service → Serverless → Collections"
echo "   - Select the collection created by Knowledge Base"
echo "   - Click: Delete"
echo ""
echo "3. S3 Bucket (if RETAIN policy):"
echo "   - Go to: S3 → Buckets"
echo "   - Select: bidflow-documents"
echo "   - Click: Delete (if it still exists)"
echo ""
echo "4. DynamoDB Table (if RETAIN policy):"
echo "   - Go to: DynamoDB → Tables"
echo "   - Select: BidProjectState"
echo "   - Click: Delete (if it still exists)"
echo ""
echo "5. Amplify App (if deployed):"
echo "   - Go to: AWS Amplify → All apps"
echo "   - Select: bidflow-ui"
echo "   - Click: Delete app"
echo ""

echo ""
echo "========================================="
echo "Step 4: Clean Local Files"
echo "========================================="
echo ""

cd "$(dirname "$0")/.." || exit 1

read -p "Delete local deployment files? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleaning local files..."
    
    # Remove deployment outputs
    [ -f "deployment-outputs.json" ] && rm deployment-outputs.json && echo "  ✅ Removed deployment-outputs.json"
    [ -f "knowledge-base-id.txt" ] && rm knowledge-base-id.txt && echo "  ✅ Removed knowledge-base-id.txt"
    [ -f "test-response.json" ] && rm test-response.json && echo "  ✅ Removed test-response.json"
    
    # Remove CDK outputs
    [ -d "infra/cdk.out" ] && rm -rf infra/cdk.out && echo "  ✅ Removed infra/cdk.out"
    
    # Remove frontend build
    [ -d "frontend/bidflow-ui/.next" ] && rm -rf frontend/bidflow-ui/.next && echo "  ✅ Removed frontend/.next"
    [ -f "frontend/bidflow-ui/.env.local" ] && rm frontend/bidflow-ui/.env.local && echo "  ✅ Removed frontend/.env.local"
    
    echo "✅ Local files cleaned"
fi

echo ""
echo "========================================="
echo "Cleanup Complete!"
echo "========================================="
echo ""
echo "All automated cleanup tasks completed."
echo "Please complete the manual cleanup steps listed above."
