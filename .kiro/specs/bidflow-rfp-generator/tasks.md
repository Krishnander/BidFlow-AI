# Implementation Plan: BidFlow RFP Generator

## Overview

This implementation plan breaks down the BidFlow RFP Generator into five phases following the project plan: Infrastructure (CDK), Knowledge Base setup, Backend implementation (multi-agent pipeline), Frontend implementation (Next.js UI), and Testing/Documentation. The system orchestrates five AI agents (Extractor → Researcher → Strategist → Writer → Critic) with a self-correction loop, RAG-based evidence retrieval, and real-time timeline visualization.

## Tasks

### Phase A: Infrastructure Setup

- [-] 1. Generate and deploy CDK infrastructure stack
  - [x] 1.1 Create CDK stack with S3 bucket, DynamoDB table, Lambda function, and API Gateway
    - Use TypeScript with aws-cdk-lib v2
    - Configure S3 bucket: bidflow-documents with block public access and SSE-S3 encryption
    - Configure DynamoDB table: BidProjectState with project_id (PK) and timestamp (SK), pay-per-request billing
    - Configure Lambda: Python 3.12 runtime, 60s timeout, 1024MB memory
    - Configure API Gateway: HTTP API with CORS enabled, POST /run and GET /runs routes
    - Add IAM permissions: Bedrock InvokeModel, Bedrock Agent Runtime Retrieve, S3 read/write, DynamoDB read/write, CloudWatch Logs
    - Add stack outputs: API Gateway URL, S3 bucket name, DynamoDB table name
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 14.1, 14.2, 14.3, 14.4, 14.5, 13.3, 18.1, 18.2, 18.3, 17.1, 17.3_
  
  - [ ]* 1.2 Write property test for CDK stack synthesis
    - **Property 23: Run Persistence**
    - **Validates: Requirements 9.1, 9.2**
  
  - [ ] 1.3 Deploy CDK stack to AWS us-east-1
    - Run cdk bootstrap (first time only)
    - Run cdk deploy
    - Capture and document stack outputs (API Gateway URL, bucket name, table name)
    - _Requirements: 15.5, 17.1_

### Phase B: Knowledge Base Setup

- [ ] 2. Create and configure Amazon Bedrock Knowledge Base
  - [ ] 2.1 Create company documentation PDFs
    - Create 5 PDFs with SaaS-focused content: company-profile.pdf, case-study-saas-migration.pdf, case-study-sso-integration.pdf, case-study-security-audit.pdf, capabilities-deck-saas-delivery.pdf
    - Include content covering ISO 27001, SOC 2, SSO (SAML/OIDC), SLA commitments, and security practices
    - _Requirements: 4.4, 20.2_
  
  - [ ] 2.2 Upload PDFs to S3 bucket and create Knowledge Base
    - Upload all 5 PDFs to s3://bidflow-documents/
    - Create Knowledge Base in AWS Console: name "BidFlowCompanyMemory"
    - Configure data source: S3 bucket bidflow-documents
    - Configure embedding model: Titan Embeddings v2 (amazon.titan-embed-text-v2:0)
    - Configure vector store: OpenSearch Serverless (quick-create)
    - Configure chunking: Default (300 tokens with 20% overlap)
    - _Requirements: 4.4, 4.5, 4.6, 17.2_
  
  - [ ] 2.3 Sync Knowledge Base and test retrieval
    - Trigger Knowledge Base sync in AWS Console
    - Wait for sync completion
    - Test retrieval with sample query: "ISO 27001 compliance"
    - Verify 6 chunks returned with source URIs
    - Document Knowledge Base ID for Lambda configuration
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [ ] 2.4 Update Lambda environment variable with Knowledge Base ID
    - Update Lambda function environment variable: KNOWLEDGE_BASE_ID
    - Redeploy Lambda or update via AWS Console
    - _Requirements: 15.4_


### Phase C: Backend Implementation

- [x] 3. Implement Bedrock API integration module
  - [x] 3.1 Create bedrock.py with model invocation functions
    - Implement invoke_model() function for Claude 3.5 Sonnet and Amazon Nova Lite
    - Implement retrieve_from_kb() function for Knowledge Base retrieval using bedrock-agent-runtime
    - Add error handling for throttling and API failures
    - Use boto3 bedrock-runtime and bedrock-agent-runtime clients
    - _Requirements: 3.2, 4.1, 5.4, 6.2, 7.5, 17.2_
  
  - [ ]* 3.2 Write property tests for Bedrock integration
    - **Property 5: Error Logging and Propagation**
    - **Validates: Requirements 2.5, 19.1, 19.5**
  
  - [ ]* 3.3 Write property test for retrieval
    - **Property 9: Researcher Result Count and Format**
    - **Validates: Requirements 4.2, 4.3**

- [x] 4. Implement prompt templates module
  - [x] 4.1 Create prompts.py with all agent prompt templates
    - Define EXTRACTOR_PROMPT: Parse RFP into JSON checklist with must_include_terms, compliance, integration, timeline_required, word_limit
    - Define STRATEGIST_PROMPT: Generate 3 win themes, 3 proof points, 2 risks with mitigations
    - Define WRITER_PROMPT: Generate Markdown proposal with 7 required sections
    - Define WRITER_REVISION_PROMPT: Incorporate critic feedback into revision
    - Define CRITIC_PROMPT: Audit draft for compliance, return APPROVED or REJECT with reason
    - _Requirements: 3.1, 5.1, 5.2, 5.3, 6.1, 7.1, 7.2, 7.3, 8.2_
  
  - [ ]* 4.2 Write property test for prompt structure
    - **Property 6: Extractor Output Structure**
    - **Validates: Requirements 3.1**

- [x] 5. Implement DynamoDB persistence module
  - [x] 5.1 Create dynamo.py with save and query functions
    - Implement save_run() function: PutItem with project_id, timestamp, trace_id, artifacts
    - Implement query_runs() function: Query with project_id, limit 10, descending order
    - Add error handling for throttling and persistence failures
    - Use boto3 dynamodb client
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ]* 5.2 Write property test for run persistence
    - **Property 23: Run Persistence**
    - **Validates: Requirements 9.1, 9.2**
  
  - [ ]* 5.3 Write property test for run history query
    - **Property 24: Run History Query**
    - **Validates: Requirements 9.4**

- [x] 6. Implement cost estimation module
  - [x] 6.1 Create cost.py with cost calculation logic
    - Implement calculate_cost() function: Estimate based on model usage (Claude Sonnet, Nova Lite)
    - Include input/output token counts for each agent
    - Add revision costs when draft_v2 exists
    - Return cost in USD with 2 decimal places
    - _Requirements: 10.1, 10.2_
  
  - [ ]* 6.2 Write property test for cost calculation
    - **Property 25: Cost Calculation Presence**
    - **Validates: Requirements 10.1**
  
  - [ ]* 6.3 Write property test for revision cost inclusion
    - **Property 26: Revision Cost Inclusion**
    - **Validates: Requirements 10.2**

- [x] 7. Implement Lambda handler and agent orchestration
  - [x] 7.1 Create handler.py with Lambda entry point
    - Implement handler() function: Route POST /run and GET /runs
    - Add input validation: Check rfp_text not empty, return 400 if invalid
    - Generate trace_id for each request using uuid4
    - Add CORS headers to all responses
    - _Requirements: 1.1, 1.2, 1.4, 13.1, 13.2, 13.4, 13.5, 19.4_
  
  - [ ]* 7.2 Write property test for input validation
    - **Property 1: Input Validation Rejects Empty Content**
    - **Validates: Requirements 1.2**
  
  - [ ]* 7.3 Write property test for CORS headers
    - **Property 29: CORS Headers**
    - **Validates: Requirements 13.4**
  
  - [ ]* 7.4 Write property test for JSON response format
    - **Property 30: JSON Response Format**
    - **Validates: Requirements 13.5**


- [x] 8. Implement Extractor agent
  - [x] 8.1 Add extract_requirements() function to handler.py
    - Call invoke_model() with Nova Lite and EXTRACTOR_PROMPT
    - Parse JSON response, validate required fields
    - Implement fallback: Use default checklist if JSON parsing fails
    - Log extraction step to timeline
    - Return checklist dict
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 2.3, 19.2_
  
  - [ ]* 8.2 Write property test for Extractor output structure
    - **Property 6: Extractor Output Structure**
    - **Validates: Requirements 3.1**
  
  - [ ]* 8.3 Write property test for compliance detection
    - **Property 7: Extractor Compliance Detection**
    - **Validates: Requirements 3.3**
  
  - [ ]* 8.4 Write property test for fallback behavior
    - **Property 8: Extractor Fallback Behavior**
    - **Validates: Requirements 3.4, 19.2**

- [x] 9. Implement Researcher agent
  - [x] 9.1 Add retrieve_evidence() function to handler.py
    - Construct query from checklist compliance, integration, and non_functional fields
    - Call retrieve_from_kb() with query, numberOfResults=6
    - Format evidence chunks with text and source URI
    - Log retrieval step to timeline
    - Handle retrieval failures with error logging
    - Return evidence array
    - _Requirements: 4.1, 4.2, 4.3, 2.3, 19.3_
  
  - [ ]* 9.2 Write property test for result count and format
    - **Property 9: Researcher Result Count and Format**
    - **Validates: Requirements 4.2, 4.3**
  
  - [ ]* 9.3 Write property test for retrieval failure handling
    - **Property 28: Retrieval Failure Handling**
    - **Validates: Requirements 19.3**

- [x] 10. Implement Strategist agent
  - [x] 10.1 Add generate_strategy() function to handler.py
    - Call invoke_model() with Claude Sonnet and STRATEGIST_PROMPT
    - Pass rfp_text, checklist, and evidence as context
    - Validate output contains 3 win themes, 3 proof points, 2 risks
    - Log strategy generation step to timeline
    - Return strategy text
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 2.3_
  
  - [ ]* 10.2 Write property test for Strategist output structure
    - **Property 10: Strategist Output Structure**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.5**

- [x] 11. Implement Writer agent
  - [x] 11.1 Add generate_draft() function to handler.py
    - Call invoke_model() with Claude Sonnet and WRITER_PROMPT
    - Pass strategy, evidence, checklist (must_include_terms, word_limit) as context
    - Validate output contains all 7 required sections
    - Log draft generation step to timeline
    - Return draft Markdown
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 2.3_
  
  - [ ]* 11.2 Write property test for section completeness
    - **Property 11: Writer Section Completeness**
    - **Validates: Requirements 6.1**
  
  - [ ]* 11.3 Write property test for term inclusion
    - **Property 12: Writer Term Inclusion**
    - **Validates: Requirements 6.3**
  
  - [ ]* 11.4 Write property test for word limit compliance
    - **Property 13: Writer Word Limit Compliance**
    - **Validates: Requirements 6.4**
  
  - [ ]* 11.5 Write property test for evidence references
    - **Property 14: Writer Evidence References**
    - **Validates: Requirements 6.5**

- [x] 12. Implement Critic agent
  - [x] 12.1 Add audit_draft() function to handler.py
    - Call invoke_model() with Nova Lite and CRITIC_PROMPT
    - Pass checklist and draft as context
    - Validate output matches "APPROVED" or "REJECT: <reason>" pattern
    - Check for ISO 27001, SOC 2, SSO, SLA, timeline presence
    - Check word limit compliance
    - Log audit step to timeline
    - Return critic response
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 2.3_
  
  - [ ]* 12.2 Write property test for Critic output format
    - **Property 15: Critic Output Format**
    - **Validates: Requirements 7.2**
  
  - [ ]* 12.3 Write property test for compliance checking
    - **Property 16: Critic Compliance Checking**
    - **Validates: Requirements 7.3**
  
  - [ ]* 12.4 Write property test for word limit enforcement
    - **Property 17: Critic Word Limit Enforcement**
    - **Validates: Requirements 7.4**
  
  - [ ]* 12.5 Write property test for token limit
    - **Property 18: Critic Token Limit**
    - **Validates: Requirements 7.6**


- [x] 13. Implement self-correction loop
  - [x] 13.1 Add revision logic to handler.py orchestration
    - Check if critic_v1 starts with "REJECT"
    - If rejected, call generate_draft() with WRITER_REVISION_PROMPT and critic feedback
    - Call audit_draft() to re-audit draft_v2
    - Limit to one revision cycle maximum
    - If draft_v2 rejected, set human_review_required flag
    - Log revision steps to timeline
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 2.3_
  
  - [ ]* 13.2 Write property test for self-correction trigger
    - **Property 19: Self-Correction Trigger**
    - **Validates: Requirements 8.1, 8.2**
  
  - [ ]* 13.3 Write property test for re-audit
    - **Property 20: Self-Correction Re-Audit**
    - **Validates: Requirements 8.3**
  
  - [ ]* 13.4 Write property test for single revision limit
    - **Property 21: Single Revision Limit**
    - **Validates: Requirements 8.4**
  
  - [ ]* 13.5 Write property test for human review flag
    - **Property 22: Human Review Flag**
    - **Validates: Requirements 8.5**

- [x] 14. Implement pipeline orchestration
  - [x] 14.1 Add orchestrate_pipeline() function to handler.py
    - Execute agents in order: Extractor → Researcher → Strategist → Writer → Critic
    - Pass output from each agent to next agent
    - Collect all log entries in chronological order
    - Handle agent failures with error logging and descriptive messages
    - Calculate elapsed time and cost estimate
    - Determine final_markdown (draft_v2 if exists and approved, else draft_v1)
    - Save run record to DynamoDB with all artifacts
    - Return response with log, artifacts, final_markdown, cost, elapsed_seconds
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.1, 9.2, 10.1, 10.2, 11.1, 11.2_
  
  - [ ]* 14.2 Write property test for agent execution order
    - **Property 2: Agent Execution Order Preservation**
    - **Validates: Requirements 2.1**
  
  - [ ]* 14.3 Write property test for agent output propagation
    - **Property 3: Agent Output Propagation**
    - **Validates: Requirements 2.2**
  
  - [ ]* 14.4 Write property test for timeline logging completeness
    - **Property 4: Timeline Logging Completeness**
    - **Validates: Requirements 2.3, 11.1, 11.2, 11.4**
  
  - [ ]* 14.5 Write property test for error logging
    - **Property 5: Error Logging and Propagation**
    - **Validates: Requirements 2.5, 19.1, 19.5**
  
  - [ ]* 14.6 Write property test for trace ID propagation
    - **Property 27: Trace ID Propagation**
    - **Validates: Requirements 19.4**
  
  - [ ]* 14.7 Write property test for final output Markdown format
    - **Property 31: Final Output Markdown Format**
    - **Validates: Requirements 12.1**

- [ ] 15. Checkpoint - Backend integration testing
  - Deploy Lambda function with all modules
  - Test POST /run with demo RFP via curl
  - Verify all agents execute in order
  - Verify self-correction loop triggers
  - Verify DynamoDB record created
  - Test GET /runs via curl
  - Ensure all tests pass, ask the user if questions arise.

### Phase D: Frontend Implementation

- [x] 16. Create Next.js application structure
  - [x] 16.1 Initialize Next.js app with TypeScript and Tailwind CSS
    - Run: npx create-next-app@latest bidflow-ui --typescript --tailwind --app
    - Install dependencies: react-markdown, remark-gfm
    - Configure Tailwind CSS with custom colors
    - _Requirements: 1.1, 12.2, 12.5_
  
  - [x] 16.2 Create app/layout.tsx with root layout
    - Define metadata: title "BidFlow RFP Generator", description
    - Import globals.css
    - Set up HTML structure with lang="en"
    - _Requirements: 1.1_

- [x] 17. Implement main application page
  - [x] 17.1 Create app/page.tsx with state management
    - Define state: rfp, running, log, animatedLog, finalMd, cost, artifacts, tab
    - Initialize with demo RFP content
    - Add TypeScript interfaces: LogItem, TabType, ApiResponse
    - _Requirements: 1.1, 1.3, 11.1, 12.3_
  
  - [x] 17.2 Implement API integration functions
    - Add handleGenerate() function: POST /run with project_id and rfp_text
    - Add handleLoadDemo() function: Load demo RFP into textarea
    - Add error handling for API failures
    - Add loading state management
    - _Requirements: 13.1, 13.2, 1.3_
  
  - [x] 17.3 Implement timeline animation logic
    - Add useEffect to animate log entries with 450ms delay
    - Progressively reveal log entries from API response
    - Clear animation on new run
    - _Requirements: 11.3, 11.4_


- [x] 18. Implement UI layout and components
  - [x] 18.1 Create 3-column grid layout in page.tsx
    - Left column: RFP input textarea (520px height), Load Demo button, Generate button
    - Middle column: Agent timeline with scrollable log entries
    - Right column: Output panel with tab navigation and Markdown rendering
    - Use Tailwind CSS grid and responsive design
    - _Requirements: 1.1, 11.1, 12.1, 12.3_
  
  - [x] 18.2 Implement input panel components
    - Add textarea for RFP input with placeholder text
    - Add "Load Demo RFP" button with onClick handler
    - Add "Generate" button with loading state (disabled while running)
    - Style with Tailwind CSS: borders, padding, rounded corners
    - _Requirements: 1.1, 1.3_
  
  - [x] 18.3 Implement agent timeline component
    - Display log entries in chronological order
    - Format: [Agent Name] Message
    - Add scrollable container with max height
    - Show empty state: "Run to see agent steps…"
    - Highlight current agent with color
    - _Requirements: 11.1, 11.2, 11.4, 11.5_
  
  - [x] 18.4 Implement output panel with tabs
    - Add tab navigation: Final, Checklist, Evidence, Strategy, Draft1, Critic1, Draft2, Critic2
    - Implement tab switching logic
    - Display Markdown rendering for Final tab using react-markdown with remark-gfm
    - Display JSON/text for other tabs with pre-formatted styling
    - Add scrollable container (520px height)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  
  - [x] 18.5 Implement cost and time badges
    - Add cost estimate badge (emerald color) with USD formatting
    - Add time saved badge (violet color) with "vs 8 hours manual" text
    - Display "Estimated" label
    - Position badges below Generate button
    - _Requirements: 10.3, 10.4, 10.5_

- [ ] 19. Configure frontend environment and deployment
  - [ ] 19.1 Create .env.local with API base URL
    - Add NEXT_PUBLIC_API_BASE_URL with API Gateway URL from CDK output
    - Document environment variable in README
    - _Requirements: 13.1, 13.2_
  
  - [ ] 19.2 Test frontend locally
    - Run: npm run dev
    - Test Load Demo RFP button
    - Test Generate button with demo RFP
    - Verify timeline animation
    - Verify Markdown rendering
    - Verify tab switching
    - _Requirements: 1.1, 1.3, 11.3, 12.2_
  
  - [ ] 19.3 Deploy to AWS Amplify
    - Connect Amplify to Git repository
    - Configure build settings (auto-detected for Next.js)
    - Set environment variable: NEXT_PUBLIC_API_BASE_URL
    - Trigger deployment
    - Verify HTTPS access
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [ ] 20. Checkpoint - Frontend integration testing
  - Test full end-to-end flow from UI
  - Verify API calls succeed
  - Verify timeline displays all agent steps
  - Verify self-correction loop visible in timeline
  - Verify final proposal renders correctly
  - Ensure all tests pass, ask the user if questions arise.

### Phase E: Testing and Documentation

- [x] 21. Create demo RFP content
  - [x] 21.1 Write demo RFP that triggers self-correction loop
    - Include requirements for ISO 27001, SOC 2, SSO (SAML/OIDC), SLA 99.9%, delivery timeline
    - Structure to cause first draft to miss compliance term
    - Ensure revised draft includes all compliance terms
    - Save as demo-rfp.txt in frontend/public/
    - _Requirements: 20.1, 20.2, 20.4, 20.5_
  
  - [ ]* 21.2 Write unit test for demo RFP behavior
    - Test that demo RFP triggers Critic rejection on draft_v1
    - Test that draft_v2 receives Critic approval
    - _Requirements: 20.5_

- [ ] 22. Implement property-based tests for all correctness properties
  - [ ]* 22.1 Set up property testing framework
    - Install hypothesis for Python backend tests
    - Configure test settings: max_examples=100
    - Create tests/test_properties.py file
    - _Requirements: All requirements_
  
  - [ ]* 22.2 Implement remaining property tests
    - Implement all 31 property tests from design document
    - Tag each test with feature name and property number
    - Run full property test suite
    - _Requirements: All requirements_


- [ ] 23. End-to-end integration testing
  - [ ]* 23.1 Test complete pipeline with demo RFP
    - Deploy full stack (CDK, Lambda, Amplify)
    - Call POST /run with demo RFP
    - Verify response contains all expected artifacts
    - Verify Extractor identifies ISO 27001, SOC 2, SSO, SLA
    - Verify Researcher retrieves 6 evidence chunks
    - Verify Strategist generates 3 win themes, 3 proof points, 2 risks
    - Verify Writer generates draft with 7 sections
    - Verify Critic rejects draft_v1
    - Verify Writer generates draft_v2
    - Verify Critic approves draft_v2
    - Verify final output is valid Markdown
    - Verify DynamoDB record created
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.3, 4.2, 5.1, 5.2, 5.3, 6.1, 7.2, 7.3, 8.1, 8.3, 9.1, 12.1_
  
  - [ ]* 23.2 Test error scenarios
    - Test empty RFP input returns 400
    - Test invalid JSON from Extractor triggers fallback
    - Test Knowledge Base retrieval failure returns 500
    - Test agent failure logs error and returns descriptive message
    - _Requirements: 1.4, 3.4, 19.1, 19.2, 19.3, 19.5_
  
  - [ ]* 23.3 Test run history retrieval
    - Call GET /runs with project_id
    - Verify returns 10 most recent runs
    - Verify response time < 500ms
    - _Requirements: 9.4, 9.5_

- [-] 24. Create documentation and demo materials
  - [x] 24.1 Write README with setup instructions
    - Document prerequisites: AWS CLI, Node.js, CDK CLI
    - Document deployment steps for each phase
    - Document environment variables
    - Document API endpoints and request/response formats
    - Include troubleshooting guide
    - _Requirements: 15.5, 16.3, 17.4_
  
  - [ ] 24.2 Create architecture diagrams
    - Export system architecture diagram from design document
    - Export request flow sequence diagram from design document
    - Export regional deployment diagram from design document
    - Save as PNG/SVG in docs/ folder
    - _Requirements: 17.1, 17.3_
  
  - [x] 24.3 Document cost optimization strategies
    - Document AWS Free Tier usage
    - Document estimated monthly costs
    - Document optimization strategies (pay-per-request, Nova Lite usage, single revision)
    - _Requirements: 9.3, 10.1, 10.2_
  
  - [ ] 24.4 Prepare demo video and screenshots
    - Record demo video showing full pipeline execution
    - Capture screenshots: UI with demo RFP, timeline animation, final proposal, self-correction loop
    - Document demo RFP content and expected behavior
    - _Requirements: 20.1, 20.3, 20.4_

- [ ] 25. Final checkpoint - Complete system validation
  - Verify all 20 requirements are met
  - Verify all 31 correctness properties pass
  - Verify demo RFP produces expected output
  - Verify documentation is complete
  - Verify deployment is reproducible
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at phase boundaries
- Property tests validate universal correctness properties from design document
- Unit tests validate specific examples and error conditions
- Backend uses Python 3.12, infrastructure uses TypeScript CDK, frontend uses Next.js with TypeScript
- All AWS resources deployed in us-east-1 region
- Knowledge Base ID must be manually created and configured in Lambda environment variables
- Self-correction loop limited to one revision cycle to control latency and cost
