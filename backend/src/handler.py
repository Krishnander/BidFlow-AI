"""
BidFlow Lambda Handler

Main entry point for the multi-agent pipeline orchestration.
Routes POST /run and GET /runs requests.

Pipeline: Extractor → Researcher → Strategist → Writer → Critic → Self-Correction
"""

import json
import os
import time
import uuid
from typing import Dict, List, Any, Tuple

# Import BidFlow modules
from bedrock import invoke_claude, invoke_nova, kb_retrieve, format_evidence, slim_evidence
from prompts import (
    build_extractor_prompt,
    build_strategist_prompt,
    build_writer_prompt,
    build_critic_prompt
)
from dynamo import save_run, query_runs
from cost import estimate_cost

# Environment configuration
KNOWLEDGE_BASE_ID = os.environ.get("KNOWLEDGE_BASE_ID", "PLACEHOLDER")


def _response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """
    Build HTTP response with CORS headers.
    
    Args:
        status_code: HTTP status code
        body: Response body dict
    
    Returns:
        Lambda response dict with headers and JSON body
    """
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "*",
        },
        "body": json.dumps(body)
    }


def _safe_json_parse(text: str) -> Dict[str, Any]:
    """
    Safely parse JSON from text, with fallback to default checklist.
    
    Args:
        text: Text that should contain JSON
    
    Returns:
        Parsed JSON dict or default checklist if parsing fails
    """
    try:
        # Try to find JSON object in text
        start = text.find("{")
        end = text.rfind("}")
        
        if start == -1 or end == -1:
            raise ValueError("No JSON object found")
        
        return json.loads(text[start:end+1])
    
    except Exception:
        # Return default checklist
        return {
            "must_include_terms": ["ISO 27001", "SOC 2", "SSO", "SLA"],
            "must_cover_sections": ["Security & Compliance", "Delivery Plan"],
            "compliance": ["ISO 27001", "SOC 2"],
            "integration": ["SSO (SAML/OIDC)"],
            "non_functional": ["SLA 99.9%", "Observability"],
            "timeline_required": True,
            "word_limit": 650
        }


def _build_retrieval_query(checklist: Dict[str, Any], rfp_text: str) -> str:
    """
    Build retrieval query from checklist and RFP text.
    
    Args:
        checklist: Extracted requirements checklist
        rfp_text: Original RFP text
    
    Returns:
        Query string for Knowledge Base retrieval
    """
    keywords = []
    keywords.extend(checklist.get("compliance", []))
    keywords.extend(checklist.get("integration", []))
    keywords.extend(checklist.get("non_functional", []))
    
    # Limit to first 12 keywords
    kw_str = ", ".join(keywords[:12])
    
    # Combine with RFP excerpt
    rfp_excerpt = rfp_text[:500]
    
    return f"SaaS experience: {kw_str}. Include SSO, SLA, compliance, multi-tenancy, encryption. RFP: {rfp_excerpt}"


def orchestrate_pipeline(project_id: str, rfp_text: str, trace_id: str) -> Tuple[List[Dict], Dict, str, float]:
    """
    Orchestrate the complete multi-agent pipeline.
    
    Pipeline: Extractor → Researcher → Strategist → Writer → Critic → Self-Correction
    
    Args:
        project_id: Project identifier
        rfp_text: RFP text input
        trace_id: Unique trace ID for this run
    
    Returns:
        Tuple of (log_entries, artifacts, final_markdown, cost_estimate)
    
    Raises:
        Exception: If any agent fails
    """
    log = []
    t0 = time.time()
    
    # 1) Extractor Agent (Nova Lite)
    log.append({"agent": "Extractor", "msg": "Parsing RFP into a structured checklist..."})
    
    try:
        extractor_prompt = build_extractor_prompt(rfp_text)
        checklist_raw = invoke_nova(extractor_prompt, max_tokens=600, temperature=0.0)
        checklist = _safe_json_parse(checklist_raw)
    except Exception as e:
        raise Exception(f"Extractor agent failed: {str(e)}")
    
    # 2) Researcher Agent (Knowledge Base)
    log.append({"agent": "Researcher", "msg": "Searching Knowledge Base for relevant evidence..."})
    
    try:
        query = _build_retrieval_query(checklist, rfp_text)
        results = kb_retrieve(KNOWLEDGE_BASE_ID, query_text=query, top_k=6)
        evidence_text = format_evidence(results)
        log.append({"agent": "Researcher", "msg": f"Retrieved {len(results)} evidence chunks."})
    except Exception as e:
        raise Exception(f"Researcher agent failed: {str(e)}")
    
    # 3) Strategist Agent (Claude Sonnet)
    log.append({"agent": "Strategist", "msg": "Creating win themes and response plan..."})
    
    try:
        strategist_prompt = build_strategist_prompt(
            rfp_text=rfp_text,
            checklist_json=json.dumps(checklist),
            evidence_text=evidence_text
        )
        strategy = invoke_claude(
            messages=[{"role": "user", "content": strategist_prompt}],
            max_tokens=700,
            temperature=0.2
        )
    except Exception as e:
        raise Exception(f"Strategist agent failed: {str(e)}")
    
    # 4) Writer Agent v1 (Claude Sonnet)
    log.append({"agent": "Writer", "msg": "Writing proposal draft (v1)..."})
    
    try:
        must_terms = checklist.get("must_include_terms", ["ISO 27001", "SOC 2", "SSO", "SLA"])
        word_limit = checklist.get("word_limit", 650)
        
        writer_prompt = build_writer_prompt(
            must_include_terms=", ".join(must_terms),
            word_limit=word_limit,
            tone="formal",
            strategy=strategy,
            evidence_text=evidence_text
        )
        
        draft_v1 = invoke_claude(
            messages=[{"role": "user", "content": writer_prompt}],
            max_tokens=1100,
            temperature=0.3
        )
    except Exception as e:
        raise Exception(f"Writer agent failed: {str(e)}")
    
    # 5) Critic Agent v1 (Nova Lite)
    log.append({"agent": "Critic", "msg": "Auditing draft for compliance gaps..."})
    
    try:
        critic_prompt = build_critic_prompt(
            checklist_json=json.dumps(checklist),
            draft=draft_v1
        )
        
        critic_v1 = invoke_nova(
            prompt=critic_prompt,
            max_tokens=80,
            temperature=0.0
        ).strip()
    except Exception as e:
        raise Exception(f"Critic agent failed: {str(e)}")
    
    # Initialize revision variables
    draft_v2 = None
    critic_v2 = None
    final = draft_v1
    
    # 6) Self-Correction Loop (one retry maximum)
    if critic_v1.startswith("REJECT"):
        log.append({"agent": "Critic", "msg": critic_v1})
        log.append({"agent": "Writer", "msg": "Rewriting draft to fix issues (v2)..."})
        
        try:
            # Writer revision with critic feedback
            revision_prompt = build_writer_prompt(
                must_include_terms=", ".join(must_terms),
                word_limit=word_limit,
                tone="formal",
                strategy=strategy,
                evidence_text=evidence_text,
                critic_feedback=critic_v1
            )
            
            draft_v2 = invoke_claude(
                messages=[{"role": "user", "content": revision_prompt}],
                max_tokens=1100,
                temperature=0.25
            )
            
            # Critic re-audit
            log.append({"agent": "Critic", "msg": "Re-auditing revised draft..."})
            
            critic_prompt_v2 = build_critic_prompt(
                checklist_json=json.dumps(checklist),
                draft=draft_v2
            )
            
            critic_v2 = invoke_nova(
                prompt=critic_prompt_v2,
                max_tokens=80,
                temperature=0.0
            ).strip()
            
            if critic_v2 == "APPROVED":
                log.append({"agent": "Critic", "msg": "APPROVED"})
                final = draft_v2
            else:
                log.append({"agent": "Critic", "msg": critic_v2})
                log.append({"agent": "Orchestrator", "msg": "Returning best-effort output (needs human review)."})
                final = draft_v2
        
        except Exception as e:
            raise Exception(f"Self-correction loop failed: {str(e)}")
    else:
        log.append({"agent": "Critic", "msg": "APPROVED"})
    
    # Calculate elapsed time and cost
    elapsed = round(time.time() - t0, 2)
    cost = estimate_cost(strategy, draft_v1, draft_v2, critic_v1, critic_v2)
    
    # Build artifacts dict
    artifacts = {
        "checklist": checklist,
        "evidence": slim_evidence(results),
        "strategy": strategy,
        "draft_v1": draft_v1,
        "critic_v1": critic_v1,
        "draft_v2": draft_v2,
        "critic_v2": critic_v2
    }
    
    return log, artifacts, final, cost


def handler(event, context):
    """
    Lambda entry point for BidFlow agent orchestration.
    
    Routes:
    - POST /run: Execute agent pipeline
    - GET /runs: Query run history
    
    Args:
        event: Lambda event dict with requestContext and body
        context: Lambda context object
    
    Returns:
        HTTP response dict with status code, headers, and JSON body
    """
    # Extract request details
    path = event.get("requestContext", {}).get("http", {}).get("path", "")
    method = event.get("requestContext", {}).get("http", {}).get("method", "")
    
    # Route: GET /runs
    if method == "GET" and path.endswith("/runs"):
        try:
            qs = event.get("queryStringParameters") or {}
            project_id = qs.get("project_id", "demo-001")
            
            runs = query_runs(project_id)
            
            return _response(200, {
                "project_id": project_id,
                "runs": runs
            })
        
        except Exception as e:
            return _response(500, {
                "error": f"Failed to query runs: {str(e)}"
            })
    
    # Route: POST /run
    try:
        # Parse request body
        body = json.loads(event.get("body") or "{}")
        project_id = body.get("project_id", "demo-001")
        rfp_text = (body.get("rfp_text") or "").strip()
        
        # Validate input
        if not rfp_text:
            return _response(400, {"error": "rfp_text required"})
        
        # Generate trace ID
        trace_id = str(uuid.uuid4())
        
        # Execute pipeline
        log, artifacts, final_markdown, cost_estimate = orchestrate_pipeline(
            project_id=project_id,
            rfp_text=rfp_text,
            trace_id=trace_id
        )
        
        # Calculate elapsed time
        elapsed = round(time.time() - context.get_remaining_time_in_millis() / 1000, 2) if context else 0
        
        # Save run record to DynamoDB
        record = {
            "trace_id": trace_id,
            "project_id": project_id,
            "elapsed_seconds": elapsed,
            "rfp_text": rfp_text,
            "checklist": artifacts["checklist"],
            "evidence": artifacts["evidence"],
            "strategy": artifacts["strategy"],
            "draft_v1": artifacts["draft_v1"],
            "critic_v1": artifacts["critic_v1"],
            "draft_v2": artifacts["draft_v2"],
            "critic_v2": artifacts["critic_v2"],
            "final_markdown": final_markdown,
            "cost_estimate_usd": cost_estimate
        }
        
        save_run(record)
        
        # Return response
        return _response(200, {
            "trace_id": trace_id,
            "project_id": project_id,
            "log": log,
            "artifacts": artifacts,
            "final_markdown": final_markdown,
            "cost_estimate_usd": cost_estimate,
            "elapsed_seconds": elapsed
        })
    
    except Exception as e:
        return _response(500, {
            "error": f"Pipeline execution failed: {str(e)}"
        })
