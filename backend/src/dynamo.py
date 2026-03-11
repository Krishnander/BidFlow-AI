"""
BidFlow DynamoDB Persistence Module

Provides functions for:
- Saving run records with artifacts to DynamoDB
- Querying run history for a project
"""

import os
import time
import boto3
from boto3.dynamodb.conditions import Key
from typing import Dict, List, Any

# Environment configuration
TABLE_NAME = os.environ.get("TABLE_NAME", "BidProjectState")

# Initialize DynamoDB resource
ddb = boto3.resource("dynamodb")
table = ddb.Table(TABLE_NAME)


def save_run(record: Dict[str, Any]) -> None:
    """
    Save a pipeline run record to DynamoDB.
    
    Automatically adds timestamp if not present.
    
    Args:
        record: Dict containing run data with at minimum:
            - project_id: Project identifier (partition key)
            - trace_id: Unique run identifier
            - rfp_text: Original RFP input
            - checklist: Extracted requirements
            - evidence: Retrieved evidence chunks
            - strategy: Generated strategy
            - draft_v1: First draft
            - critic_v1: First audit result
            - draft_v2: Revised draft (if applicable)
            - critic_v2: Second audit result (if applicable)
            - final_markdown: Final approved proposal
            - cost_estimate_usd: Estimated cost
            - elapsed_seconds: Execution time
    
    Raises:
        Exception: If DynamoDB PutItem operation fails
    """
    try:
        # Add timestamp if not present (sort key)
        if "timestamp" not in record:
            record["timestamp"] = str(int(time.time()))
        
        table.put_item(Item=record)
    
    except Exception as e:
        raise Exception(f"DynamoDB save failed: {str(e)}")


def query_runs(project_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Query run history for a project.
    
    Returns the most recent runs in descending order by timestamp.
    
    Args:
        project_id: Project identifier to query
        limit: Maximum number of runs to return (default: 10)
    
    Returns:
        List of run summary dicts containing:
        - timestamp: Run timestamp
        - trace_id: Unique run identifier
        - elapsed_seconds: Execution time
        - cost_estimate_usd: Estimated cost
    
    Raises:
        Exception: If DynamoDB Query operation fails
    """
    try:
        response = table.query(
            KeyConditionExpression=Key("project_id").eq(project_id),
            ScanIndexForward=False,  # Descending order (newest first)
            Limit=limit
        )
        
        items = response.get("Items", [])
        
        # Return summary information only (not full artifacts)
        return [
            {
                "timestamp": item.get("timestamp"),
                "trace_id": item.get("trace_id"),
                "elapsed_seconds": item.get("elapsed_seconds"),
                "cost_estimate_usd": item.get("cost_estimate_usd")
            }
            for item in items
        ]
    
    except Exception as e:
        raise Exception(f"DynamoDB query failed: {str(e)}")


def get_run(project_id: str, timestamp: str) -> Dict[str, Any]:
    """
    Get a specific run record with full artifacts.
    
    Args:
        project_id: Project identifier
        timestamp: Run timestamp (sort key)
    
    Returns:
        Full run record dict with all artifacts
    
    Raises:
        Exception: If DynamoDB GetItem operation fails or item not found
    """
    try:
        response = table.get_item(
            Key={
                "project_id": project_id,
                "timestamp": timestamp
            }
        )
        
        if "Item" not in response:
            raise Exception(f"Run not found: {project_id}/{timestamp}")
        
        return response["Item"]
    
    except Exception as e:
        raise Exception(f"DynamoDB get failed: {str(e)}")
