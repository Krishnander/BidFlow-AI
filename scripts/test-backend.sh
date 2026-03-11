#!/bin/bash

# BidFlow Backend Testing Script
# This script tests the deployed backend API

set -e

echo "========================================="
echo "BidFlow Backend API Testing"
echo "========================================="
echo ""

# Check if deployment outputs exist
if [ ! -f "deployment-outputs.json" ]; then
    echo "❌ deployment-outputs.json not found."
    echo "   Please run ./scripts/deploy-infrastructure.sh first."
    exit 1
fi

# Extract API URL from outputs
API_URL=$(jq -r '.[] | select(.OutputKey=="HttpApiUrl") | .OutputValue' deployment-outputs.json)

if [ -z "$API_URL" ] || [ "$API_URL" == "null" ]; then
    echo "❌ Could not find API URL in deployment outputs."
    exit 1
fi

# Remove trailing slash if present
API_URL=${API_URL%/}

echo "API URL: $API_URL"
echo ""

# Test demo RFP
DEMO_RFP="We are a B2B SaaS company looking for a partner to modernize our platform.

Must include:
- Explicit mention of ISO 27001 and SOC 2 alignment
- SSO via SAML 2.0 or OIDC
- SLA: 99.9% uptime
- A delivery timeline with phases (Discovery, Build, Security review, Launch)
- References to relevant past SaaS projects"

echo "========================================="
echo "Test 1: POST /run (Execute Pipeline)"
echo "========================================="
echo ""
echo "Sending demo RFP to pipeline..."
echo "This will take 30-60 seconds..."
echo ""

# Create request payload
REQUEST_PAYLOAD=$(jq -n \
    --arg project_id "test-$(date +%s)" \
    --arg rfp_text "$DEMO_RFP" \
    '{project_id: $project_id, rfp_text: $rfp_text}')

# Make API call
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/run" \
    -H "Content-Type: application/json" \
    -d "$REQUEST_PAYLOAD")

# Extract HTTP status code
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ API call failed!"
    echo "Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 1
fi

echo "✅ API call successful!"
echo ""

# Parse response
TRACE_ID=$(echo "$BODY" | jq -r '.trace_id')
LOG_COUNT=$(echo "$BODY" | jq '.log | length')
COST=$(echo "$BODY" | jq -r '.cost_estimate_usd')
ELAPSED=$(echo "$BODY" | jq -r '.elapsed_seconds')

echo "Results:"
echo "  Trace ID: $TRACE_ID"
echo "  Log entries: $LOG_COUNT"
echo "  Cost estimate: \$$COST"
echo "  Elapsed time: ${ELAPSED}s"
echo ""

# Check for self-correction loop
DRAFT_V2=$(echo "$BODY" | jq -r '.artifacts.draft_v2')
if [ "$DRAFT_V2" != "null" ] && [ -n "$DRAFT_V2" ]; then
    echo "✅ Self-correction loop triggered (draft_v2 exists)"
else
    echo "ℹ️  No self-correction loop (draft approved on first attempt)"
fi

echo ""
echo "Agent Timeline:"
echo "$BODY" | jq -r '.log[] | "  [\(.agent)] \(.msg)"'

echo ""
echo "Final Proposal Preview (first 500 chars):"
echo "$BODY" | jq -r '.final_markdown' | head -c 500
echo "..."
echo ""

# Save full response
echo "$BODY" | jq '.' > test-response.json
echo "✅ Full response saved to test-response.json"

echo ""
echo "========================================="
echo "Test 2: GET /runs (Query History)"
echo "========================================="
echo ""

# Extract project_id from request
PROJECT_ID=$(echo "$REQUEST_PAYLOAD" | jq -r '.project_id')

echo "Querying run history for project: $PROJECT_ID"
echo ""

# Make API call
HISTORY_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/runs?project_id=$PROJECT_ID")

# Extract HTTP status code
HTTP_CODE=$(echo "$HISTORY_RESPONSE" | tail -n1)
HISTORY_BODY=$(echo "$HISTORY_RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" != "200" ]; then
    echo "❌ API call failed!"
    echo "Response:"
    echo "$HISTORY_BODY" | jq '.' 2>/dev/null || echo "$HISTORY_BODY"
    exit 1
fi

echo "✅ API call successful!"
echo ""

# Parse response
RUN_COUNT=$(echo "$HISTORY_BODY" | jq '.runs | length')

echo "Results:"
echo "  Project ID: $(echo "$HISTORY_BODY" | jq -r '.project_id')"
echo "  Run count: $RUN_COUNT"
echo ""

if [ "$RUN_COUNT" -gt 0 ]; then
    echo "Recent runs:"
    echo "$HISTORY_BODY" | jq -r '.runs[] | "  \(.timestamp) - \(.trace_id) - $\(.cost_estimate_usd) - \(.elapsed_seconds)s"'
fi

echo ""
echo "========================================="
echo "Backend Testing Complete!"
echo "========================================="
echo ""
echo "✅ All tests passed!"
echo ""
echo "Next steps:"
echo "1. Review test-response.json for full pipeline output"
echo "2. Deploy frontend (run: ./scripts/deploy-frontend.sh)"
