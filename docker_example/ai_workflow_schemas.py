from typing import Any, List
from pydantic import BaseModel, Field


class AIComponent(BaseModel):
    """AI-suggested component specification."""
    
    id: str = Field(..., description="Logical ID for the component")
    type: str = Field(..., description="Component type (e.g., 'OpenAIModel', 'PromptTemplate')")
    label: str | None = Field(None, description="Human-readable label for the component")
    parameters: dict[str, Any] | None = Field(None, description="Component parameters and configuration")


class AIConnection(BaseModel):
    """AI-suggested connection between components."""
    
    from_component: str = Field(..., description="Logical ID of the source component")
    to_component: str = Field(..., description="Logical ID of the target component")
    from_handle: str | None = Field(None, description="Source handle name (optional)")
    to_handle: str | None = Field(None, description="Target handle name (optional)")


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