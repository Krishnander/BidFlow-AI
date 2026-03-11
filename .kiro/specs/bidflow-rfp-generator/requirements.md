# Requirements Document

## Introduction

BidFlow is an end-to-end agentic AI SaaS RFP proposal generator that automates the creation of compliant proposal responses. The system accepts RFP text input, orchestrates a multi-agent pipeline (Extractor → Researcher → Strategist → Writer → Critic) to generate proposals, implements RAG using Amazon Bedrock Knowledge Bases for evidence retrieval, and includes a self-correction loop where the Critic agent can reject drafts and trigger revisions. The system targets deployment in AWS us-east-1 region with optimization for AWS Free Tier usage.

## Glossary

- **BidFlow_System**: The complete agentic AI proposal generation platform
- **Extractor_Agent**: AI agent that parses RFP text into structured requirements using Amazon Nova Lite
- **Researcher_Agent**: AI agent that retrieves evidence from company documents using Bedrock Knowledge Base
- **Strategist_Agent**: AI agent that creates win themes and response plans using Claude 3.5 Sonnet
- **Writer_Agent**: AI agent that drafts proposal responses using Claude 3.5 Sonnet
- **Critic_Agent**: AI agent that audits proposals for compliance using Amazon Nova Lite
- **Knowledge_Base**: Amazon Bedrock Knowledge Base containing company documentation PDFs
- **Run_History**: DynamoDB records of pipeline executions and generated artifacts
- **Agent_Timeline**: UI component displaying sequential agent execution steps
- **Compliance_Requirements**: ISO 27001, SOC 2, SSO (SAML/OIDC), and SLA requirements
- **Self_Correction_Loop**: Process where Critic_Agent rejects drafts and Writer_Agent revises

## Requirements

### Requirement 1: RFP Input Processing

**User Story:** As a proposal manager, I want to submit RFP text to the system, so that I can initiate automated proposal generation.

#### Acceptance Criteria

1. THE BidFlow_System SHALL accept RFP text input through a Next.js web interface
2. WHEN RFP text is submitted, THE BidFlow_System SHALL validate that the input is not empty
3. THE BidFlow_System SHALL provide a demo RFP loading function for testing purposes
4. WHEN an empty RFP is submitted, THE BidFlow_System SHALL return an error message within 200 milliseconds

### Requirement 2: Multi-Agent Pipeline Orchestration

**User Story:** As a proposal manager, I want the system to orchestrate multiple AI agents in sequence, so that proposals are generated through a structured workflow.

#### Acceptance Criteria

1. WHEN an RFP is submitted, THE BidFlow_System SHALL execute agents in this order: Extractor_Agent, Researcher_Agent, Strategist_Agent, Writer_Agent, Critic_Agent
2. THE BidFlow_System SHALL pass output from each agent as input to the next agent in the pipeline
3. THE BidFlow_System SHALL record each agent execution step in the Agent_Timeline
4. THE BidFlow_System SHALL complete the full pipeline execution within 60 seconds
5. IF any agent fails, THEN THE BidFlow_System SHALL log the error and return a descriptive error message

### Requirement 3: RFP Requirements Extraction

**User Story:** As a proposal manager, I want the system to extract structured requirements from RFP text, so that compliance criteria are identified automatically.

#### Acceptance Criteria

1. WHEN the Extractor_Agent processes RFP text, THE Extractor_Agent SHALL return a JSON object containing must_include_terms, must_cover_sections, compliance requirements, non_functional requirements, integration requirements, timeline_required flag, and word_limit
2. THE Extractor_Agent SHALL use Amazon Nova Lite model for extraction
3. THE Extractor_Agent SHALL identify ISO 27001, SOC 2, SSO (SAML/OIDC), and SLA requirements when present in the RFP
4. IF the Extractor_Agent output is not valid JSON, THEN THE BidFlow_System SHALL use a default checklist structure

### Requirement 4: Evidence Retrieval from Company Documents

**User Story:** As a proposal manager, I want the system to retrieve relevant evidence from company documents, so that proposals are grounded in actual company capabilities.

#### Acceptance Criteria

1. WHEN the Researcher_Agent executes, THE Researcher_Agent SHALL query the Knowledge_Base using the Bedrock Agent Runtime Retrieve API
2. THE Researcher_Agent SHALL retrieve the top 6 most relevant document chunks based on the RFP requirements
3. THE Researcher_Agent SHALL format retrieved evidence with source document URIs
4. THE Knowledge_Base SHALL contain company documentation PDFs stored in S3
5. THE Knowledge_Base SHALL use Titan Embeddings v2 for vector embeddings
6. THE Knowledge_Base SHALL use OpenSearch Serverless as the vector store

### Requirement 5: Win Theme and Strategy Generation

**User Story:** As a proposal manager, I want the system to generate win themes and response strategies, so that proposals are strategically positioned.

#### Acceptance Criteria

1. WHEN the Strategist_Agent executes, THE Strategist_Agent SHALL generate 3 win themes based on RFP requirements and retrieved evidence
2. THE Strategist_Agent SHALL generate 3 proof points referencing specific evidence chunks
3. THE Strategist_Agent SHALL identify 2 risks with corresponding mitigations
4. THE Strategist_Agent SHALL use Claude 3.5 Sonnet model for strategy generation
5. THE Strategist_Agent SHALL complete strategy generation within 700 tokens

### Requirement 6: Proposal Draft Generation

**User Story:** As a proposal manager, I want the system to generate a formal proposal draft, so that I have a structured response document.

#### Acceptance Criteria

1. WHEN the Writer_Agent executes, THE Writer_Agent SHALL generate a Markdown proposal with these sections: Executive Summary, Understanding of Requirements, Proposed Approach, Delivery Plan, Security & Compliance, Relevant Experience, Assumptions and Next Steps
2. THE Writer_Agent SHALL use Claude 3.5 Sonnet model for draft generation
3. THE Writer_Agent SHALL include all must_include_terms from the extracted checklist
4. THE Writer_Agent SHALL respect the word_limit specified in the extracted checklist
5. THE Writer_Agent SHALL reference retrieved evidence in the Relevant Experience section

### Requirement 7: Compliance Auditing

**User Story:** As a proposal manager, I want the system to audit proposals for compliance gaps, so that submissions meet all requirements.

#### Acceptance Criteria

1. WHEN the Critic_Agent executes, THE Critic_Agent SHALL audit the draft against the extracted checklist
2. THE Critic_Agent SHALL return either "APPROVED" or "REJECT: <specific reason>"
3. THE Critic_Agent SHALL check for presence of ISO 27001, SOC 2, SSO, SLA, and timeline requirements
4. THE Critic_Agent SHALL check that the draft does not exceed the word_limit
5. THE Critic_Agent SHALL use Amazon Nova Lite model for auditing
6. THE Critic_Agent SHALL complete auditing within 80 tokens

### Requirement 8: Self-Correction Loop

**User Story:** As a proposal manager, I want the system to automatically revise rejected drafts, so that compliance issues are corrected without manual intervention.

#### Acceptance Criteria

1. WHEN the Critic_Agent returns a REJECT status, THE BidFlow_System SHALL trigger the Writer_Agent to generate a revised draft
2. THE Writer_Agent SHALL incorporate the Critic_Agent feedback into the revision prompt
3. WHEN the Writer_Agent completes the revision, THE BidFlow_System SHALL trigger the Critic_Agent to re-audit the revised draft
4. THE BidFlow_System SHALL perform a maximum of one revision cycle per run
5. IF the revised draft is rejected, THEN THE BidFlow_System SHALL return the revised draft with a human review flag

### Requirement 9: Run History and Artifact Storage

**User Story:** As a proposal manager, I want the system to store run history and generated artifacts, so that I can review past proposal generations.

#### Acceptance Criteria

1. WHEN a pipeline execution completes, THE BidFlow_System SHALL store a record in DynamoDB with project_id as partition key and timestamp as sort key
2. THE BidFlow_System SHALL store these artifacts: checklist, evidence chunks, strategy, draft_v1, critic_v1, draft_v2, critic_v2, and final_markdown
3. THE BidFlow_System SHALL use pay-per-request billing mode for the DynamoDB table
4. WHEN a user queries run history, THE BidFlow_System SHALL return the 10 most recent runs for the specified project_id
5. THE BidFlow_System SHALL return run summaries within 500 milliseconds

### Requirement 10: Cost and Time Estimation

**User Story:** As a proposal manager, I want to see estimated costs and time saved, so that I can understand the business value of the system.

#### Acceptance Criteria

1. WHEN a pipeline execution completes, THE BidFlow_System SHALL calculate an estimated cost in USD
2. THE BidFlow_System SHALL include revision costs when a self-correction loop executes
3. THE BidFlow_System SHALL display the cost estimate in the UI with a currency badge
4. THE BidFlow_System SHALL display a time saved estimate comparing manual proposal writing to automated generation
5. THE BidFlow_System SHALL label cost estimates as "Estimated" in the UI

### Requirement 11: Agent Timeline Visualization

**User Story:** As a proposal manager, I want to see a live timeline of agent execution steps, so that I can understand the proposal generation process.

#### Acceptance Criteria

1. WHEN a pipeline executes, THE BidFlow_System SHALL emit log entries for each agent step
2. THE BidFlow_System SHALL include agent name and message in each log entry
3. THE UI SHALL animate log entries with a 450 millisecond delay between entries
4. THE UI SHALL display log entries in chronological order
5. THE UI SHALL highlight the current agent being executed

### Requirement 12: Final Proposal Output

**User Story:** As a proposal manager, I want to view the final proposal in formatted Markdown, so that I can review and export the generated content.

#### Acceptance Criteria

1. WHEN a pipeline execution completes, THE BidFlow_System SHALL return the final approved proposal in Markdown format
2. THE UI SHALL render Markdown with support for headings, lists, bold, italic, and tables
3. THE UI SHALL provide tabs to view intermediate artifacts: checklist, evidence, strategy, draft_v1, critic_v1, draft_v2, critic_v2
4. THE UI SHALL display the final proposal in a scrollable container with minimum height of 520 pixels
5. THE UI SHALL use the react-markdown library with remark-gfm plugin for rendering

### Requirement 13: API Gateway Integration

**User Story:** As a system integrator, I want RESTful API endpoints for proposal generation and history retrieval, so that the frontend can communicate with the backend.

#### Acceptance Criteria

1. THE BidFlow_System SHALL expose a POST /run endpoint that accepts project_id and rfp_text
2. THE BidFlow_System SHALL expose a GET /runs endpoint that accepts project_id as a query parameter
3. THE BidFlow_System SHALL use API Gateway HTTP API for routing
4. THE BidFlow_System SHALL return responses with CORS headers allowing all origins
5. THE BidFlow_System SHALL return JSON responses with appropriate HTTP status codes

### Requirement 14: AWS Lambda Orchestration

**User Story:** As a system administrator, I want the agent orchestrator to run on AWS Lambda, so that the system scales automatically and minimizes costs.

#### Acceptance Criteria

1. THE BidFlow_System SHALL deploy the agent orchestrator as an AWS Lambda function
2. THE Lambda function SHALL use Python 3.12 runtime
3. THE Lambda function SHALL have a timeout of 60 seconds
4. THE Lambda function SHALL have 1024 MB of memory allocated
5. THE Lambda function SHALL have IAM permissions for bedrock:InvokeModel, bedrock-agent-runtime:Retrieve, s3:GetObject, s3:PutObject, dynamodb:PutItem, and dynamodb:Query

### Requirement 15: Infrastructure as Code with CDK

**User Story:** As a developer, I want infrastructure defined as code using AWS CDK, so that the system can be deployed consistently.

#### Acceptance Criteria

1. THE BidFlow_System SHALL provide a CDK stack in TypeScript using aws-cdk-lib v2
2. THE CDK stack SHALL define S3 bucket, DynamoDB table, Lambda function, and API Gateway HTTP API
3. THE CDK stack SHALL output the API Gateway URL, S3 bucket name, and DynamoDB table name
4. THE CDK stack SHALL configure Lambda environment variables for REGION, TABLE_NAME, BUCKET_NAME, KNOWLEDGE_BASE_ID, CLAUDE_MODEL_ID, and NOVA_LITE_MODEL_ID
5. THE CDK stack SHALL be deployable with the cdk deploy command

### Requirement 16: Frontend Deployment on AWS Amplify

**User Story:** As a developer, I want the Next.js frontend deployed on AWS Amplify, so that the UI is hosted with continuous deployment.

#### Acceptance Criteria

1. THE BidFlow_System SHALL deploy the Next.js frontend on AWS Amplify Hosting
2. THE Amplify deployment SHALL connect to a Git repository
3. THE Amplify deployment SHALL set NEXT_PUBLIC_API_BASE_URL environment variable to the API Gateway URL
4. THE Amplify deployment SHALL automatically rebuild and deploy on Git push
5. THE Amplify deployment SHALL serve the application over HTTPS

### Requirement 17: Regional Deployment

**User Story:** As a system administrator, I want all AWS resources deployed in us-east-1, so that model availability and latency are optimized.

#### Acceptance Criteria

1. THE BidFlow_System SHALL deploy all AWS resources in the us-east-1 region
2. THE BidFlow_System SHALL use Bedrock models available in us-east-1: Claude 3.5 Sonnet, Amazon Nova Lite, and Titan Embeddings v2
3. THE BidFlow_System SHALL configure Lambda, DynamoDB, S3, API Gateway, and Knowledge Base in us-east-1
4. THE BidFlow_System SHALL document region-specific model availability requirements

### Requirement 18: Security and Access Control

**User Story:** As a security administrator, I want S3 buckets to block public access and IAM roles to follow least privilege, so that company documents are protected.

#### Acceptance Criteria

1. THE BidFlow_System SHALL configure the S3 bucket with block public access enabled
2. THE Lambda execution role SHALL have permissions scoped to specific resources using ARNs
3. THE Lambda execution role SHALL have permissions for CloudWatch Logs creation
4. THE BidFlow_System SHALL not expose Knowledge_Base documents through public endpoints
5. THE API Gateway SHALL not require authentication for the prototype but SHALL support future authentication integration

### Requirement 19: Error Handling and Logging

**User Story:** As a system administrator, I want comprehensive error handling and logging, so that I can troubleshoot issues effectively.

#### Acceptance Criteria

1. WHEN any agent fails, THE BidFlow_System SHALL log the error to CloudWatch Logs
2. WHEN the Extractor_Agent returns invalid JSON, THE BidFlow_System SHALL use a fallback checklist and log a warning
3. WHEN the Knowledge_Base retrieval fails, THE BidFlow_System SHALL return an error message indicating retrieval failure
4. THE BidFlow_System SHALL include trace_id in all log entries for request correlation
5. THE BidFlow_System SHALL return descriptive error messages to the frontend with appropriate HTTP status codes

### Requirement 20: Demo and Testing Support

**User Story:** As a developer, I want demo RFP content and testing utilities, so that I can validate the system functionality.

#### Acceptance Criteria

1. THE BidFlow_System SHALL provide a demo RFP that triggers the self-correction loop
2. THE demo RFP SHALL include requirements for ISO 27001, SOC 2, SSO, SLA, and timeline
3. THE BidFlow_System SHALL support curl-based API testing
4. THE BidFlow_System SHALL provide a "Load Demo RFP" button in the UI
5. THE demo RFP SHALL produce a Critic_Agent rejection on the first draft followed by approval on the revised draft
