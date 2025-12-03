"""AI Workflow schemas for processing AI-suggested workflows."""

from typing import Any
from pydantic import BaseModel, Field


class AIComponent(BaseModel):
    """AI-suggested component specification."""
    
    id: str = Field(..., description="Logical ID for the component")
    type: str = Field(..., description="Component type (e.g., 'OpenAIModel', 'PromptTemplate')")
    label: str | None = Field(None, description="Human-readable label for the component")
    parameters: dict[str, Any] | None = Field(None, description="Component parameters and configuration")


class AIConnection(BaseModel):
    """AI-suggested connection between components."""
    
    from_component: str = Field(..., description="Source component ID")
    to_component: str = Field(..., description="Target component ID")
    from_handle: str | None = Field(None, description="Optional source handle name")
    to_handle: str | None = Field(None, description="Optional target handle name")


class AISuggestedWorkflow(BaseModel):
    """Simplified workflow structure from AI responses."""
    
    name: str = Field("AI Generated Workflow", description="Human-readable workflow name")
    description: str = Field("", description="Human-readable workflow description")
    components: list[AIComponent] = Field(..., description="List of components in the workflow")
    connections: list[AIConnection] = Field(..., description="List of connections between components")


class ProcessAIWorkflowRequest(BaseModel):
    """Request to process an AI-suggested workflow."""
    
    workflow_data: dict[str, Any] = Field(..., description="AI-suggested workflow data")


class ProcessAIWorkflowResponse(BaseModel):
    """Response from processing an AI-suggested workflow."""
    
    success: bool = Field(True, description="Whether the processing was successful")
    flow_data: dict[str, Any] | None = Field(None, description="Processed flow data ready for creation")
    message: str | None = Field(None, description="Status message")
    error: str | None = Field(None, description="Error message if processing failed")


class EditAIWorkflowRequest(BaseModel):
    """Request to edit an existing workflow using AI."""
    
    workflow_data: dict[str, Any] = Field(..., description="Modified AI-suggested workflow data")


class EditAIWorkflowResponse(BaseModel):
    """Response from editing a workflow using AI."""
    
    success: bool = Field(True, description="Whether the edit was successful")
    flow_data: dict[str, Any] | None = Field(None, description="Updated flow data")
    message: str | None = Field(None, description="Status message")
    error: str | None = Field(None, description="Error message if editing failed")
