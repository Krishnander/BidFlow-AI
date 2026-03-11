"""
BidFlow Cost Estimation Module

Provides cost estimation for pipeline runs based on:
- Bedrock model usage (Claude 3.5 Sonnet, Amazon Nova Lite)
- Knowledge Base retrieval
- Self-correction loop iterations
"""

from typing import Optional


# Approximate pricing (as of 2024, subject to change)
# Claude 3.5 Sonnet: ~$3/MTok input, ~$15/MTok output
# Amazon Nova Lite: ~$0.06/MTok input, ~$0.24/MTok output
# Knowledge Base retrieval: ~$0.10 per 1000 queries

# Simplified cost model for prototype
CLAUDE_BASE_COST = 0.015  # Per invocation (strategy + draft)
NOVA_BASE_COST = 0.003    # Per invocation (extractor + critic)
KB_RETRIEVAL_COST = 0.002  # Per retrieval
REVISION_COST = 0.01      # Additional cost for revision cycle


def estimate_cost(
    strategy: str,
    draft_v1: str,
    draft_v2: Optional[str],
    critic_v1: str,
    critic_v2: Optional[str]
) -> float:
    """
    Estimate the cost of a pipeline run in USD.
    
    This is a simplified heuristic estimate for the prototype.
    For production, implement token-based calculation using actual
    input/output token counts from Bedrock responses.
    
    Args:
        strategy: Strategy text from Strategist agent
        draft_v1: First draft from Writer agent
        draft_v2: Revised draft (None if no revision)
        critic_v1: First audit from Critic agent
        critic_v2: Second audit (None if no revision)
    
    Returns:
        Estimated cost in USD with 2 decimal places
    """
    # Base costs for single-pass execution
    base_cost = 0.0
    
    # Extractor (Nova Lite)
    base_cost += NOVA_BASE_COST
    
    # Knowledge Base retrieval
    base_cost += KB_RETRIEVAL_COST
    
    # Strategist (Claude Sonnet)
    base_cost += CLAUDE_BASE_COST
    
    # Writer v1 (Claude Sonnet)
    base_cost += CLAUDE_BASE_COST
    
    # Critic v1 (Nova Lite)
    base_cost += NOVA_BASE_COST
    
    # Add revision costs if self-correction loop executed
    revision_cost = 0.0
    if draft_v2 is not None:
        # Writer v2 (Claude Sonnet)
        revision_cost += CLAUDE_BASE_COST
        
        # Critic v2 (Nova Lite)
        revision_cost += NOVA_BASE_COST
    
    total_cost = base_cost + revision_cost
    
    return round(total_cost, 2)


def estimate_cost_detailed(
    extractor_tokens: int,
    retrieval_count: int,
    strategist_tokens: int,
    writer_v1_tokens: int,
    critic_v1_tokens: int,
    writer_v2_tokens: int = 0,
    critic_v2_tokens: int = 0
) -> dict:
    """
    Detailed cost estimation based on actual token counts.
    
    This function provides a more accurate cost breakdown for production use.
    Token counts should be extracted from Bedrock API responses.
    
    Args:
        extractor_tokens: Total tokens (input + output) for Extractor
        retrieval_count: Number of KB retrieval queries
        strategist_tokens: Total tokens for Strategist
        writer_v1_tokens: Total tokens for Writer v1
        critic_v1_tokens: Total tokens for Critic v1
        writer_v2_tokens: Total tokens for Writer v2 (0 if no revision)
        critic_v2_tokens: Total tokens for Critic v2 (0 if no revision)
    
    Returns:
        Dict with cost breakdown:
        - extractor_cost: Cost for Extractor agent
        - retrieval_cost: Cost for KB retrieval
        - strategist_cost: Cost for Strategist agent
        - writer_cost: Cost for Writer agent(s)
        - critic_cost: Cost for Critic agent(s)
        - total_cost: Total estimated cost
    """
    # Nova Lite pricing (approximate)
    nova_cost_per_1k = 0.0003  # $0.0003 per 1K tokens
    
    # Claude Sonnet pricing (approximate)
    claude_cost_per_1k = 0.003  # $0.003 per 1K tokens
    
    # KB retrieval pricing
    kb_cost_per_query = 0.0001  # $0.0001 per query
    
    extractor_cost = (extractor_tokens / 1000) * nova_cost_per_1k
    retrieval_cost = retrieval_count * kb_cost_per_query
    strategist_cost = (strategist_tokens / 1000) * claude_cost_per_1k
    writer_cost = ((writer_v1_tokens + writer_v2_tokens) / 1000) * claude_cost_per_1k
    critic_cost = ((critic_v1_tokens + critic_v2_tokens) / 1000) * nova_cost_per_1k
    
    total_cost = (
        extractor_cost +
        retrieval_cost +
        strategist_cost +
        writer_cost +
        critic_cost
    )
    
    return {
        "extractor_cost": round(extractor_cost, 4),
        "retrieval_cost": round(retrieval_cost, 4),
        "strategist_cost": round(strategist_cost, 4),
        "writer_cost": round(writer_cost, 4),
        "critic_cost": round(critic_cost, 4),
        "total_cost": round(total_cost, 2)
    }
