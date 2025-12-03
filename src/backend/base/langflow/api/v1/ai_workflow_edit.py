"""AI Workflow Edit API endpoint for Langflow.

This module provides API endpoint for editing existing workflows using AI.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger

from langflow.api.utils import get_current_active_user
from langflow.api.v1.schemas import EditAIWorkflowRequest, EditAIWorkflowResponse
from langflow.database.models.user import User
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
    
    This endpoint receives already-processed workflow data from the frontend
    and updates the existing workflow in the database.
    
    Args:
        flow_id: UUID of the workflow to edit
        request: Processed full workflow data (not simplified format)
        user: Current authenticated user
        session: Database session
        
    Returns:
        Updated flow data
        
    Raises:
        HTTPException: If workflow not found, unauthorized, or update fails
    """
    try:
        # Lazy imports
        from langflow.services.database.models.flow.model import Flow
        
        # Validate that we have workflow data
        if not request.workflow_data:
            raise HTTPException(
                status_code=400,
                detail="Missing workflow_data in request"
            )
        
        # The workflow_data is already processed by /api/v1/ai_workflows/process
        # It comes in the format: {name, description, data: {nodes, edges, viewport}}
        flow_data = request.workflow_data
        
        await logger.adebug(f"Received flow data keys: {flow_data.keys()}")
        
        # Load the existing flow
        await logger.adebug(f"Loading flow {flow_id} for user {user.id}")
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
        
        # Update the flow with the processed data
        await logger.adebug(f"Updating flow {flow_id}")
        
        # Update flow fields from the processed data
        if "name" in flow_data:
            flow.name = flow_data["name"]
        if "description" in flow_data:
            flow.description = flow_data["description"]
        if "data" in flow_data:
            flow.data = flow_data["data"]
        
        session.add(flow)
        await session.commit()
        await session.refresh(flow)
        
        await logger.ainfo(f"Successfully updated flow {flow_id} using AI")
        
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
