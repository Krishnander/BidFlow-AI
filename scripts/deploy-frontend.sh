#!/bin/bash

# BidFlow Frontend Deployment Script
# This script helps deploy the Next.js frontend

set -e

echo "========================================="
echo "BidFlow Frontend Deployment"
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

# Remove trailing slash
API_URL=${API_URL%/}

echo "API URL: $API_URL"
echo ""

# Navigate to frontend directory
cd "$(dirname "$0")/../frontend/bidflow-ui" || exit 1

echo "========================================="
echo "Step 1: Install Dependencies"
echo "========================================="
echo ""

if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

echo ""
echo "========================================="
echo "Step 2: Configure Environment"
echo "========================================="
echo ""

# Create .env.local file
echo "Creating .env.local file..."
cat > .env.local << EOF
# BidFlow API Configuration
NEXT_PUBLIC_API_BASE_URL=$API_URL
EOF

echo "✅ Environment configured"
echo "   API URL: $API_URL"

echo ""
echo "========================================="
echo "Step 3: Test Locally (Optional)"
echo "========================================="
echo ""
echo "You can test the frontend locally before deploying:"
echo ""
echo "  cd frontend/bidflow-ui"
echo "  npm run dev"
echo ""
echo "Then open http://localhost:3000 in your browser."
echo ""
read -p "Would you like to test locally now? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Starting development server..."
    echo "Press Ctrl+C to stop the server when done testing."
    echo ""
    npm run dev
fi

echo ""
echo "========================================="
echo "Step 4: Build for Production"
echo "========================================="
echo ""

echo "Building Next.js application..."
npm run build

echo ""
echo "✅ Build successful!"

echo ""
echo "========================================="
echo "Step 5: Deployment Options"
echo "========================================="
echo ""
echo "Choose a deployment method:"
echo ""
echo "Option A: AWS Amplify (Recommended)"
echo "  - Automatic deployments from Git"
echo "  - Built-in CI/CD"
echo "  - Custom domain support"
echo "  - Free tier: 1000 build minutes/month"
echo ""
echo "Option B: Local Server"
echo "  - Run on your local machine"
echo "  - Good for testing"
echo "  - Not suitable for production"
echo ""
read -p "Select option (A/B): " -n 1 -r
echo

if [[ $REPLY =~ ^[Aa]$ ]]; then
    echo ""
    echo "========================================="
    echo "AWS Amplify Deployment Instructions"
    echo "========================================="
    echo ""
    echo "1. Push your code to a Git repository (GitHub, GitLab, etc.)"
    echo ""
    echo "2. Go to AWS Amplify Console:"
    echo "   https://console.aws.amazon.com/amplify/home?region=us-east-1"
    echo ""
    echo "3. Click 'New app' → 'Host web app'"
    echo ""
    echo "4. Connect your Git provider and select your repository"
    echo ""
    echo "5. Configure build settings:"
    echo "   - Amplify will auto-detect Next.js"
    echo "   - Accept the default build settings"
    echo ""
    echo "6. Add environment variable:"
    echo "   - Key: NEXT_PUBLIC_API_BASE_URL"
    echo "   - Value: $API_URL"
    echo ""
    echo "7. Click 'Save and deploy'"
    echo ""
    echo "8. Wait for deployment to complete (5-10 minutes)"
    echo ""
    echo "9. Access your app at the provided Amplify URL"
    echo ""
    echo "Note: Future Git pushes will automatically trigger redeployment"
    echo ""
    
elif [[ $REPLY =~ ^[Bb]$ ]]; then
    echo ""
    echo "========================================="
    echo "Starting Local Server"
    echo "========================================="
    echo ""
    echo "Starting production server on http://localhost:3000"
    echo "Press Ctrl+C to stop the server."
    echo ""
    npm start
else
    echo ""
    echo "Invalid option. Exiting."
    exit 1
fi

echo ""
echo "========================================="
echo "Frontend Deployment Complete!"
echo "========================================="
echo ""
echo "Your BidFlow application is now ready to use!"
echo ""
echo "To test the complete system:"
echo "1. Open the frontend URL in your browser"
echo "2. Click 'Load Demo RFP'"
echo "3. Click 'Generate'"
echo "4. Watch the agent timeline"
echo "5. View the final proposal"
