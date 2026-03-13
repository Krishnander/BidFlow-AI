# BidFlow UI

Next.js frontend for BidFlow - Agentic AI RFP Proposal Generator.

## Features

- 3-column responsive layout
- Real-time agent timeline with animated log entries
- Markdown rendering for final proposals
- Tab navigation for viewing intermediate artifacts
- Cost and time savings badges
- Demo RFP loading for quick testing
- Error handling and loading states

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **react-markdown** - Markdown rendering
- **remark-gfm** - GitHub Flavored Markdown support

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Backend API deployed and accessible

### Installation

```bash
cd frontend/bidflow-ui
npm install
```

### Configuration

Create `.env.local` file:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com
```

Replace with your actual API Gateway URL from CDK deployment.

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## UI Layout

### Left Column: Input Panel
- RFP text input (520px height)
- "Load Demo RFP" button
- "Generate" button (disabled while running)
- Cost estimate badge (emerald)
- Time saved badge (violet)
- Error display

### Middle Column: Agent Timeline
- Animated log entries (450ms delay between entries)
- Format: `[Agent Name] Message`
- Scrollable container (600px height)
- Empty state message

### Right Column: Output Panel
- Tab navigation: Final, Checklist, Evidence, Strategy, Draft1, Critic1, Draft2, Critic2
- Markdown rendering for Final tab (react-markdown + remark-gfm)
- JSON/text display for other tabs
- Scrollable container (520px height)

## API Integration

### POST /run

Executes the agent pipeline:

```typescript
const response = await fetch(`${apiBase}/run`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ 
    project_id: "demo-001", 
    rfp_text: rfp 
  })
});

const data = await response.json();
// data.log - timeline entries
// data.artifacts - intermediate outputs
// data.final_markdown - final proposal
// data.cost_estimate_usd - estimated cost
```

### GET /runs

Queries run history (not currently used in UI):

```typescript
const response = await fetch(`${apiBase}/runs?project_id=demo-001`);
const data = await response.json();
// data.runs - array of run summaries
```

## Demo RFP

The built-in demo RFP is designed to trigger the self-correction loop:

```
We are a B2B SaaS company looking for a partner to modernize our platform.

Must include:
- Explicit mention of ISO 27001 and SOC 2 alignment
- SSO via SAML 2.0 or OIDC
- SLA: 99.9% uptime
- A delivery timeline with phases (Discovery, Build, Security review, Launch)
- References to relevant past SaaS projects
```

This RFP will cause the Critic to reject the first draft (missing compliance terms), then the Writer will revise, and the Critic will approve the second draft.

## Timeline Animation

Log entries are animated with a 450ms delay between each entry to create a smooth, sequential reveal effect:

```typescript
useEffect(() => {
  setAnimatedLog([]);
  if (log.length === 0) return;
  
  let i = 0;
  const timer = setInterval(() => {
    i++;
    setAnimatedLog(log.slice(0, i));
    if (i >= log.length) clearInterval(timer);
  }, 450);
  
  return () => clearInterval(timer);
}, [log]);
```

## Deployment on AWS Amplify

### Prerequisites

- Git repository with frontend code
- AWS account with Amplify access

### Steps

1. **Connect Repository**
   - Go to AWS Amplify Console
   - Click "New app" → "Host web app"
   - Connect your Git provider (GitHub, GitLab, etc.)
   - Select repository and branch

2. **Configure Build Settings**
   - Amplify auto-detects Next.js
   - Default build settings should work:
     ```yaml
     version: 1
     frontend:
       phases:
         preBuild:
           commands:
             - npm ci
         build:
           commands:
             - npm run build
       artifacts:
         baseDirectory: .next
         files:
           - '**/*'
       cache:
         paths:
           - node_modules/**/*
     ```

3. **Set Environment Variables**
   - In Amplify Console → App settings → Environment variables
   - Add: `NEXT_PUBLIC_API_BASE_URL` = `https://your-api-id.execute-api.us-east-1.amazonaws.com`

4. **Deploy**
   - Click "Save and deploy"
   - Amplify will build and deploy automatically
   - Access your app at the provided Amplify URL

5. **Continuous Deployment**
   - Amplify automatically rebuilds on Git push
   - Zero-downtime deployments

## Troubleshooting

### API calls fail with CORS error

- Verify API Gateway has CORS enabled
- Check that backend returns CORS headers
- Ensure `NEXT_PUBLIC_API_BASE_URL` is set correctly

### Timeline doesn't animate

- Check browser console for errors
- Verify `log` array is populated in API response
- Check that `useEffect` dependency array includes `log`

### Markdown doesn't render

- Verify `react-markdown` and `remark-gfm` are installed
- Check that `final_markdown` contains valid Markdown
- Inspect browser console for rendering errors

### Environment variable not working

- Ensure variable name starts with `NEXT_PUBLIC_`
- Restart dev server after changing `.env.local`
- For Amplify, set in Console → Environment variables

## Project Structure

```
frontend/bidflow-ui/
├── app/
│   ├── globals.css          # Tailwind styles
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Main application page
├── public/                   # Static assets
├── .env.local.example        # Environment variable template
├── .env.local                # Local environment (not committed)
├── next.config.js            # Next.js configuration
├── tailwind.config.ts        # Tailwind configuration
├── tsconfig.json             # TypeScript configuration
├── package.json              # Dependencies
└── README.md                 # This file
```

## License

MIT
