"""
BidFlow Bedrock API Integration Module

Provides functions for:
- Invoking Claude 3.5 Sonnet for strategy and writing
- Invoking Amazon Nova Lite for extraction and auditing
- Retrieving evidence from Bedrock Knowledge Base
"""

import json
import os
import boto3
from typing import List, Dict, Any

# Environment configuration
REGION = os.environ.get("REGION", "us-east-1")

# Initialize Bedrock clients
bedrock_runtime = boto3.client("bedrock-runtime", region_name=REGION)
bedrock_agent_runtime = boto3.client("bedrock-agent-runtime", region_name=REGION)

# Model IDs from environment
CLAUDE_MODEL_ID = os.environ.get(
    "CLAUDE_MODEL_ID", 
    "anthropic.claude-3-5-sonnet-20240620-v1:0"
)
NOVA_LITE_MODEL_ID = os.environ.get(
    "NOVA_LITE_MODEL_ID", 
    "amazon.nova-lite-v1:0"
)


def invoke_claude(
    messages: List[Dict[str, str]], 
    max_tokens: int = 900, 
    temperature: float = 0.2
) -> str:
    """
    Invoke Claude 3.5 Sonnet model for high-quality reasoning and writing.
    
    Args:
        messages: List of message dicts with 'role' and 'content' keys
        max_tokens: Maximum tokens to generate (default: 900)
        temperature: Sampling temperature 0.0-1.0 (default: 0.2)
    
    Returns:
        Generated text response from Claude
    
    Raises:
        Exception: If Bedrock API call fails
    """
    try:
        print(f"[DEBUG] Invoking Claude with model ID: {CLAUDE_MODEL_ID}")
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": messages
        })
        
        print(f"[DEBUG] Request body length: {len(body)} bytes")
        
        response = bedrock_runtime.invoke_model(
            modelId=CLAUDE_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=body
        )
        
        print(f"[DEBUG] Claude response received")
        response_body = json.loads(response["body"].read())
        return response_body["content"][0]["text"]
    
    except Exception as e:
        print(f"[ERROR] Claude invocation failed: {str(e)}")
        raise Exception(f"Claude invocation failed: {str(e)}")


def invoke_nova(
    prompt: str, 
    max_tokens: int = 600, 
    temperature: float = 0.0
) -> str:
    """
    Invoke Amazon Nova Lite model for fast, cost-effective extraction and auditing.
    
    Args:
        prompt: Input prompt text
        max_tokens: Maximum tokens to generate (default: 600)
        temperature: Sampling temperature 0.0-1.0 (default: 0.0 for deterministic)
    
    Returns:
        Generated text response from Nova Lite
    
    Raises:
        Exception: If Bedrock API call fails
    """
    try:
        print(f"[DEBUG] Invoking Nova with model ID: {NOVA_LITE_MODEL_ID}")
        body = json.dumps({
            "schemaVersion": "messages-v1",
            "messages": [
                {
                    "role": "user",
                    "content": [{"text": prompt}]
                }
            ],
            "inferenceConfig": {
                "maxTokens": max_tokens,
                "temperature": temperature,
                "topP": 0.9
            }
        })
        
        print(f"[DEBUG] Request body length: {len(body)} bytes")
        
        response = bedrock_runtime.invoke_model(
            modelId=NOVA_LITE_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=body
        )
        
        print(f"[DEBUG] Nova response received")
        response_body = json.loads(response["body"].read())
        return response_body["output"]["message"]["content"][0]["text"]
    
    except Exception as e:
        print(f"[ERROR] Nova invocation failed: {str(e)}")
        raise Exception(f"Nova Lite invocation failed: {str(e)}")


def kb_retrieve(
    knowledge_base_id: str, 
    query_text: str, 
    top_k: int = 6
) -> List[Dict[str, Any]]:
    """
    Retrieve relevant evidence chunks from Bedrock Knowledge Base.
    
    Uses the Bedrock Agent Runtime Retrieve API for RAG-based evidence retrieval.
    
    Args:
        knowledge_base_id: ID of the Knowledge Base to query
        query_text: Search query text
        top_k: Number of results to retrieve (default: 6)
    
    Returns:
        List of retrieval results, each containing:
        - content: Dict with 'text' key containing chunk content
        - location: Dict with 's3Location' containing source URI
        - score: Relevance score
    
    Raises:
        Exception: If Knowledge Base retrieval fails
    """
    try:
        response = bedrock_agent_runtime.retrieve(
            knowledgeBaseId=knowledge_base_id,
            retrievalQuery={"text": query_text},
            retrievalConfiguration={
                "vectorSearchConfiguration": {
                    "numberOfResults": top_k
                }
            }
        )
        
        return response.get("retrievalResults", [])
    
    except Exception as e:
        raise Exception(f"Knowledge Base retrieval failed: {str(e)}")


def format_evidence(results: List[Dict[str, Any]]) -> str:
    """
    Format retrieval results into readable evidence text with source citations.
    
    Args:
        results: List of retrieval results from kb_retrieve()
    
    Returns:
        Formatted evidence text with numbered chunks and source URIs
    """
    parts = []
    for i, result in enumerate(results):
        text = result.get("content", {}).get("text", "")
        source = result.get("location", {}).get("s3Location", {}).get("uri", "unknown")
        parts.append(f"[Evidence {i+1} | {source}]\n{text}")
    
    return "\n\n".join(parts)


def slim_evidence(results: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """
    Convert retrieval results to slim format for storage.
    
    Args:
        results: List of retrieval results from kb_retrieve()
    
    Returns:
        List of dicts with 'text' and 'source' keys
    """
    return [
        {
            "text": r.get("content", {}).get("text", ""),
            "source": r.get("location", {}).get("s3Location", {}).get("uri", "")
        }
        for r in results
    ]
