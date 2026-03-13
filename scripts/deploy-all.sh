#!/bin/bash
# ============================================================
# BidFlow AI — Full Stack Deployment Script
# Deploys backend (CDK) + frontend (S3/CloudFront) to AWS
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info() { echo -e "${CYAN}[→]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$ROOT_DIR/infra"
FRONTEND_DIR="$ROOT_DIR/frontend/bidflow-ui"
STACK_NAME="BidFlowStack"
OUTPUTS_FILE="$ROOT_DIR/deployment-outputs.json"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     BidFlow AI — Full Stack Deploy       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Prerequisites check ──
info "Checking prerequisites..."
command -v aws   >/dev/null 2>&1 || err "AWS CLI not installed"
command -v node  >/dev/null 2>&1 || err "Node.js not installed"
command -v npm   >/dev/null 2>&1 || err "npm not installed"
command -v npx   >/dev/null 2>&1 || err "npx not installed"
aws sts get-caller-identity >/dev/null 2>&1 || err "AWS credentials not configured"
log "All prerequisites met"

# ── 2. Install infra dependencies ──
info "Installing CDK dependencies..."
cd "$INFRA_DIR"
npm install --silent
log "CDK dependencies installed"

# ── 3. CDK Bootstrap (idempotent) ──
info "Bootstrapping CDK (if needed)..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region || echo "us-east-1")
npx cdk bootstrap "aws://$ACCOUNT_ID/$REGION" 2>/dev/null || true
log "CDK bootstrapped"

# ── 4. Deploy CDK stack ──
info "Deploying infrastructure (Lambda, API Gateway, DynamoDB, S3, CloudFront)..."
npx cdk deploy "$STACK_NAME" --require-approval never --outputs-file "$OUTPUTS_FILE"
log "Infrastructure deployed"

# ── 5. Extract outputs ──
info "Reading stack outputs..."
API_URL=$(node -e "const o=require(process.argv[1]);console.log(o['$STACK_NAME']['HttpApiUrl'])" "$OUTPUTS_FILE")
FRONTEND_BUCKET=$(node -e "const o=require(process.argv[1]);console.log(o['$STACK_NAME']['FrontendBucketName'])" "$OUTPUTS_FILE")
FRONTEND_URL=$(node -e "const o=require(process.argv[1]);console.log(o['$STACK_NAME']['FrontendUrl'])" "$OUTPUTS_FILE")

# Remove trailing slash from API URL if present
API_URL="${API_URL%/}"

log "API URL:         $API_URL"
log "Frontend Bucket: $FRONTEND_BUCKET"
log "Frontend URL:    $FRONTEND_URL"

# ── 6. Build frontend with API URL ──
info "Building frontend..."
cd "$FRONTEND_DIR"
npm install --silent

# Write .env.local with API URL
echo "NEXT_PUBLIC_API_BASE_URL=$API_URL" > .env.local
log "Wrote .env.local with API URL"

npm run build
log "Frontend built (static export in /out)"

# ── 7. Deploy frontend to S3 ──
info "Uploading frontend to S3..."
aws s3 sync out/ "s3://$FRONTEND_BUCKET/" --delete --cache-control "public, max-age=31536000, immutable" --exclude "*.html"
aws s3 sync out/ "s3://$FRONTEND_BUCKET/" --delete --cache-control "public, max-age=0, must-revalidate" --include "*.html"
log "Frontend uploaded to S3"

# ── 8. Invalidate CloudFront cache ──
info "Invalidating CloudFront cache..."
DIST_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[?Id=='S3Origin' || contains(DomainName, '$FRONTEND_BUCKET')]].Id" --output text 2>/dev/null | head -1)
if [ -n "$DIST_ID" ] && [ "$DIST_ID" != "None" ]; then
  aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" >/dev/null 2>&1 || true
  log "CloudFront cache invalidated"
else
  warn "Could not find CloudFront distribution ID for cache invalidation"
fi

# ── Done ──
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       Deployment Complete!               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Frontend:${NC}  $FRONTEND_URL"
echo -e "  ${CYAN}API:${NC}       $API_URL"
echo ""
echo -e "  ${YELLOW}Note:${NC} CloudFront may take 5-10 minutes to propagate."
echo ""
