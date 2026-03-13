"""
BidFlow DynamoDB Persistence Module

Provides functions for:
- Saving run records with artifacts to DynamoDB
- Querying run history for a project
"""

import os
import time
import re
import boto3
from boto3.dynamodb.conditions import Key
from decimal import Decimal
from typing import Dict, List, Any


def _sanitize_text(text: str) -> str:
    """
    Remove emojis and non-ASCII characters that cause DynamoDB encoding issues.
    
    Args:
        text: Input text that may contain emojis
    
    Returns:
        Sanitized text with emojis removed
    """
    if not text:
        return text
    
    # Remove emojis and other non-ASCII characters
    # Keep only ASCII printable characters and common whitespace
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"  # emoticons
        "\U0001F300-\U0001F5FF"  # symbols & pictographs
        "\U0001F680-\U0001F6FF"  # transport & map symbols
        "\U0001F1E0-\U0001F1FF"  # flags (iOS)
        "\U00002702-\U000027B0"
        "\U000024C2-\U0001F251"
        "\U0001F900-\U0001F9FF"  # supplemental symbols
        "\U0001FA00-\U0001FA6F"  # chess symbols
        "\U0001FA70-\U0001FAFF"  # symbols and pictographs extended-a
        "\U00002600-\U000026FF"  # miscellaneous symbols
        "\U00002700-\U000027BF"  # dingbats
        "]+",
        flags=re.UNICODE
    )
    
    return emoji_pattern.sub('', text)


def _sanitize_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """
    Recursively sanitize all string values in a record.
    
    Args:
        record: Dict that may contain strings with emojis
    
    Returns:
        Sanitized record
    """
    sanitized = {}
    
    for key, value in record.items():
        if isinstance(value, str):
            sanitized[key] = _sanitize_text(value)
        elif isinstance(value, dict):
            sanitized[key] = _sanitize_record(value)
        elif isinstance(value, list):
            sanitized[key] = [
                _sanitize_record(item) if isinstance(item, dict)
                else _sanitize_text(item) if isinstance(item, str)
                else item
                for item in value
            ]
        else:
            sanitized[key] = value
    
    return sanitized

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
        # Sanitize all text fields to remove emojis
        print(f"[DEBUG] Sanitizing record before save")
        record = _sanitize_record(record)
        
        # Add timestamp if not present (sort key)
        if "timestamp" not in record:
            record["timestamp"] = str(int(time.time()))
        
        # Convert float values to Decimal for DynamoDB
        if "cost_estimate_usd" in record and isinstance(record["cost_estimate_usd"], float):
            record["cost_estimate_usd"] = Decimal(str(record["cost_estimate_usd"]))
        
        if "elapsed_seconds" in record and isinstance(record["elapsed_seconds"], (int, float)):
            record["elapsed_seconds"] = Decimal(str(record["elapsed_seconds"]))
        
        print(f"[DEBUG] Saving run to DynamoDB: project_id={record.get('project_id')}, trace_id={record.get('trace_id')}")
        table.put_item(Item=record)
        print(f"[DEBUG] DynamoDB save successful")
    
    except Exception as e:
        print(f"[ERROR] DynamoDB save failed: {str(e)}")
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
        - timestamp: Run timestamp (run_id)
        - status: Run status (pending, processing, completed, failed)
        - elapsed_seconds: Execution time (if completed)
        - cost_estimate_usd: Estimated cost (if completed)
        - created_at: Creation timestamp
        - completed_at: Completion timestamp (if completed)
    
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
                "run_id": item.get("timestamp"),
                "status": item.get("status", "unknown"),
                "elapsed_seconds": item.get("elapsed_seconds"),
                "cost_estimate_usd": item.get("cost_estimate_usd"),
                "created_at": item.get("created_at"),
                "completed_at": item.get("completed_at"),
                "error": item.get("error")
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
        timestamp: Run timestamp (sort key / run_id)
    
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


def update_run_status(project_id: str, timestamp: str, status: str) -> None:
    """
    Update the status of a run record.
    
    Args:
        project_id: Project identifier
        timestamp: Run timestamp (sort key / run_id)
        status: New status (pending, processing, completed, failed)
    
    Raises:
        Exception: If DynamoDB UpdateItem operation fails
    """
    try:
        print(f"[DEBUG] Updating run status: project_id={project_id}, run_id={timestamp}, status={status}")
        
        table.update_item(
            Key={
                "project_id": project_id,
                "timestamp": timestamp
            },
            UpdateExpression="SET #status = :status, updated_at = :updated_at",
            ExpressionAttributeNames={
                "#status": "status"
            },
            ExpressionAttributeValues={
                ":status": status,
                ":updated_at": int(time.time())
            }
        )
        
        print(f"[DEBUG] Status update successful")
    
    except Exception as e:
        print(f"[ERROR] Status update failed: {str(e)}")
        raise Exception(f"DynamoDB update failed: {str(e)}")
