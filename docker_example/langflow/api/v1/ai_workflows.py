"""AI Workflows API endpoints for Langflow.

This module provides API endpoints for processing AI-suggested workflows
using the Logic-Injection approach.
"""

from typing import Any, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from loguru import logger

from langflow.api.utils import get_current_active_user
from langflow.api.v1.ai_workflow_schemas import ProcessAIWorkflowRequest, ProcessAIWorkflowResponse
from langflow.services.database.models.user import User
from langflow.services.deps import get_session, get_variable_service, get_settings_service

router = APIRouter(prefix="/ai_workflows", tags=["AI Workflows"])


@router.post("/process", response_model=ProcessAIWorkflowResponse)
async def process_ai_workflow_endpoint(
    request: ProcessAIWorkflowRequest,
    user: User = Depends(get_current_active_user),
):
    """Process an AI-suggested workflow into a structured flow.
    
    This endpoint implements the Logic-Injection approach by separating
    AI logic (what components and connections) from structural implementation
    (IDs, positions, proper JSON structure).
    
    This endpoint works exactly like manual workflow creation:
    1. Loads component templates from /api/v1/all (same as frontend)
    2. Swaps AI component names with actual template components
    3. Creates nodes with full template structure
    4. Forms edges with proper handle types
    
    Args:
        request: AI workflow data containing components and connections
        user: Current authenticated user
        
    Returns:
        Processed flow data ready for creation
        
    Raises:
        HTTPException: If processing fails
    """
    try:
        # Validate that we have workflow data
        if not request.workflow_data:
            raise HTTPException(
                status_code=400,
                detail="Missing workflow_data in request"
            )
        
        # Lazy imports to avoid circular dependencies and expensive module loading
        from langflow.agentic.utils.ai_workflow_processor import process_ai_workflow
        from langflow.interface.components import get_and_cache_all_types_dict
        
        # Load component templates from /api/v1/all (same as manual workflow creation)
        # This is the SAME data that frontend uses from useTypesStore
        logger.info("Loading component templates from /api/v1/all")
        component_templates = await get_and_cache_all_types_dict(
            settings_service=get_settings_service()
        )
        logger.info(f"Loaded {len(component_templates)} component categories")
            
        # Process the AI workflow using our new processor WITH templates
        # This ensures AI workflow creation works EXACTLY like manual creation
        processed_result = await process_ai_workflow(
            ai_response=request.workflow_data,
            user_id=user.id,
            component_templates=component_templates  # Pass templates for node swapping
        )
        
        # The processor returns {"success": True, "flow_data": {...}, "message": "..."}
        # Extract the actual flow data
        if not processed_result.get("success"):
            raise ValueError(processed_result.get("message", "Unknown error"))
        
        # Return the response directly since process_ai_workflow already wraps it correctly
        return ProcessAIWorkflowResponse(
            success=processed_result["success"],
            flow_data=processed_result["flow_data"],
            message=processed_result["message"]
        )
        
    except ValueError as e:
        # Handle validation errors
        logger.warning(f"Invalid AI workflow data: {e}")
        return ProcessAIWorkflowResponse(
            success=False,
            error=str(e),
            message="Invalid workflow data provided"
        )
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Error processing AI workflow: {e}")
        return ProcessAIWorkflowResponse(
            success=False,
            error=str(e),
            message="Failed to process AI workflow"
        )