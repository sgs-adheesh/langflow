"""AI Workflow Edit API endpoint for Langflow.

This module provides API endpoint for editing existing workflows using AI.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from langflow.api.utils import get_current_active_user
from langflow.api.v1.ai_workflow_schemas import EditAIWorkflowRequest, EditAIWorkflowResponse
from langflow.services.database.models.user import User
from langflow.services.deps import get_session, get_settings_service
from sqlmodel.ext.asyncio.session import AsyncSession

router = APIRouter(prefix="/ai_workflows", tags=["AI Workflows Edit"])


@router.post("/edit/{flow_id}", response_model=EditAIWorkflowResponse)
async def edit_workflow_with_ai(
    flow_id: UUID,
    request: EditAIWorkflowRequest,
    user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_session),
):
    """Edit an existing workflow using AI-suggested modifications.
    
    This endpoint:
    1. Validates the workflow belongs to the user
    2. Processes AI modifications through the existing workflow processor
    3. Updates the workflow with the modified data
    
    Args:
        flow_id: UUID of the workflow to edit
        request: Modified workflow data in simplified format
        user: Current authenticated user
        session: Database session
        
    Returns:
        Updated flow data
        
    Raises:
        HTTPException: If workflow not found, unauthorized, or processing fails
    """
    try:
        # Lazy imports
        from langflow.agentic.utils.ai_workflow_processor import process_ai_workflow
        from langflow.interface.components import get_and_cache_all_types_dict
        from langflow.services.database.models.flow.model import Flow
        
        # Validate that we have workflow data
        if not request.workflow_data:
            raise HTTPException(
                status_code=400,
                detail="Missing workflow_data in request"
            )
        
        # Load the existing flow
        logger.info(f"Loading flow {flow_id} for user {user.id}")
        flow = await session.get(Flow, flow_id)
        
        if not flow:
            raise HTTPException(
                status_code=404,
                detail=f"Flow {flow_id} not found"
            )
        
        # Check ownership
        if flow.user_id != user.id:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to edit this workflow"
            )
        
        # Load component templates
        logger.info("Loading component templates")
        component_templates = await get_and_cache_all_types_dict(
            settings_service=get_settings_service()
        )
        logger.info(f"Loaded {len(component_templates)} component categories")
        
        # Process the AI modifications using the existing processor
        logger.info("Processing AI workflow modifications")
        processed_result = await process_ai_workflow(
            ai_response=request.workflow_data,
            user_id=user.id,
            component_templates=component_templates
        )
        
        if not processed_result.get("success"):
            raise ValueError(processed_result.get("message", "Unknown error"))
        
        flow_data = processed_result["flow_data"]
        
        # Update the flow
        logger.info(f"Updating flow {flow_id}")
        flow.name = flow_data.get("name", flow.name)
        flow.description = flow_data.get("description", flow.description)
        flow.data = flow_data.get("data", flow.data)
        
        session.add(flow)
        await session.commit()
        await session.refresh(flow)
        
        logger.info(f"Successfully updated flow {flow_id} using AI")
        
        # Return the updated flow
        return EditAIWorkflowResponse(
            success=True,
            flow_data=flow.model_dump(),
            message="Workflow updated successfully"
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except ValueError as e:
        # Handle validation errors
        logger.warning(f"Invalid AI workflow data: {e}")
        return EditAIWorkflowResponse(
            success=False,
            error=str(e),
            message="Invalid workflow data provided"
        )
    except Exception as e:
        # Handle unexpected errors
        logger.error(f"Error editing workflow with AI: {e}")
        return EditAIWorkflowResponse(
            success=False,
            error=str(e),
            message="Failed to edit workflow"
        )
