"""
BidFlow Prompt Templates Module

Contains all prompt templates for the multi-agent pipeline:
- Extractor: Parse RFP into structured checklist
- Strategist: Generate win themes and response plan
- Writer: Generate formal proposal draft
- Critic: Audit draft for compliance gaps
"""

# Extractor Agent Prompt (Amazon Nova Lite)
# Parses RFP text into structured JSON checklist
EXTRACTOR_PROMPT = """You are a SaaS RFP requirement extractor.
Return STRICT JSON only (no markdown, no commentary) matching this schema:
{{
  "must_include_terms": [string],
  "must_cover_sections": [string],
  "compliance": [string],
  "non_functional": [string],
  "integration": [string],
  "timeline_required": true/false,
  "word_limit": number
}}

Focus on: ISO 27001, SOC 2, SSO (SAML/OIDC), SLA, encryption, multi-tenancy, observability.

RFP TEXT:
{rfp_text}
"""

# Strategist Agent Prompt (Claude 3.5 Sonnet)
# Generates win themes, proof points, and risk mitigations
STRATEGIST_PROMPT = """You are a Bid Strategist for a SaaS services company (Helix Systems).

Client RFP:
{rfp_text}

Extracted checklist (JSON):
{checklist_json}

Evidence chunks (verbatim):
{evidence_text}

Write:
1) Win themes (3 bullets)
2) Proof points (3 bullets) referencing evidence numbers
3) Risks + mitigations (2 bullets)

Format your response clearly with these three sections."""

# Writer Agent Prompt (Claude 3.5 Sonnet)
# Generates formal Markdown proposal with required sections
WRITER_PROMPT = """You are a proposal writer responding to a SaaS RFP.
Write a formal Markdown response with these sections:

# Executive Summary
# Understanding of Requirements
# Proposed Approach
# Delivery Plan (phases + timeline)
# Security & Compliance (explicitly mention all compliance items)
# Relevant Experience (use evidence)
# Assumptions and Next Steps

Constraints:
- MUST include these exact terms: {must_include_terms}
- Word limit: {word_limit}
Tone: {tone}

Strategy:
{strategy}

Evidence:
{evidence_text}

Write the proposal in Markdown now."""

# Critic Agent Prompt (Amazon Nova Lite)
# Audits draft for compliance gaps and returns APPROVED or REJECT
CRITIC_PROMPT = """You are a strict compliance auditor.

Checklist JSON:
{checklist_json}

Draft:
{draft}

Return ONLY one line:
APPROVED
or
REJECT: <specific reason>

Valid reject reasons include:
REJECT: Missing ISO 27001
REJECT: Missing SOC 2
REJECT: Missing SSO
REJECT: Missing SLA
REJECT: Missing timeline
REJECT: Over word limit"""


def build_extractor_prompt(rfp_text: str) -> str:
    """Build Extractor agent prompt with RFP text."""
    return EXTRACTOR_PROMPT.format(rfp_text=rfp_text)


def build_strategist_prompt(rfp_text: str, checklist_json: str, evidence_text: str) -> str:
    """Build Strategist agent prompt with RFP, checklist, and evidence."""
    return STRATEGIST_PROMPT.format(
        rfp_text=rfp_text,
        checklist_json=checklist_json,
        evidence_text=evidence_text
    )


def build_writer_prompt(
    must_include_terms: str,
    word_limit: int,
    tone: str,
    strategy: str,
    evidence_text: str,
    critic_feedback: str = ""
) -> str:
    """
    Build Writer agent prompt with strategy and evidence.
    
    Args:
        must_include_terms: Comma-separated terms that must appear in proposal
        word_limit: Maximum word count
        tone: Writing tone (e.g., "formal")
        strategy: Win themes and proof points from Strategist
        evidence_text: Formatted evidence chunks
        critic_feedback: Optional feedback from Critic for revision
    
    Returns:
        Formatted prompt for Writer agent
    """
    prompt = WRITER_PROMPT.format(
        must_include_terms=must_include_terms,
        word_limit=word_limit,
        tone=tone,
        strategy=strategy,
        evidence_text=evidence_text
    )
    
    # Add critic feedback for revisions
    if critic_feedback:
        prompt += f"\n\nCritic feedback from previous draft:\n{critic_feedback}\n\nPlease address this feedback in your revision."
    
    return prompt


def build_critic_prompt(checklist_json: str, draft: str) -> str:
    """Build Critic agent prompt with checklist and draft."""
    return CRITIC_PROMPT.format(
        checklist_json=checklist_json,
        draft=draft
    )
