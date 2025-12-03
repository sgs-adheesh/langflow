"""AI Workflow Processor for Langflow.

This module implements the Logic-Injection approach to separate AI logic
from structural implementation by processing simplified AI responses
into fully structured flows.
"""

from __future__ import annotations

import json
import uuid
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Union
from uuid import UUID

# Use a simpler logger import
import logging

from langflow.services.deps import session_scope
from langflow.api.v1.ai_workflow_schemas import AISuggestedWorkflow as AISuggestedWorkflowSchema
from langflow.interface.components import get_and_cache_all_types_dict
from langflow.services.deps import get_settings_service

if TYPE_CHECKING:
    from langflow.services.database.models.flow.model import FlowCreate
    from sqlmodel.ext.asyncio.session import AsyncSession


# Simple logger for this module
logger = logging.getLogger(__name__)


class AISuggestedWorkflow:
    """Simplified workflow structure from AI responses."""

    def __init__(
        self,
        name: str,
        description: str,
        components: List[Dict[str, Any]],
        connections: List[Dict[str, Any]],
    ):
        """Initialize with simplified workflow data.
        
        Args:
            name: Human-readable workflow name
            description: Human-readable workflow description
            components: List of component specifications
            connections: List of component connections
        """
        self.name = name
        self.description = description
        self.components = components
        self.connections = connections

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> AISuggestedWorkflow:
        """Create instance from dictionary data."""
        # Validate required fields
        if "components" not in data:
            raise ValueError("Missing required field: components")
        
        if not isinstance(data["components"], list):
            raise ValueError("Components must be a list")
            
        if "connections" not in data:
            raise ValueError("Missing required field: connections")
            
        if not isinstance(data["connections"], list):
            raise ValueError("Connections must be a list")
        
        return cls(
            name=data.get("name", "AI Generated Workflow"),
            description=data.get("description", ""),
            components=data.get("components", []),
            connections=data.get("connections", []),
        )


class WorkflowProcessor:
    """Processes AI-suggested workflows into structured flows."""

    def __init__(self, session: AsyncSession):
        """Initialize with database session."""
        self.session = session

    async def process_workflow(
        self, ai_workflow: AISuggestedWorkflow, user_id: Union[str, uuid.UUID]
    ) -> Dict[str, Any]:
        """Process AI workflow into structured flow data.
        
        Args:
            ai_workflow: AI-suggested workflow structure
            user_id: User ID for flow ownership
            
        Returns:
            Dictionary with processed flow data ready for creation
            
        Raises:
            ValueError: If workflow data is invalid
            Exception: If processing fails
        """
        try:
            # Validate workflow data
            self._validate_workflow(ai_workflow)
            
            # Process components into nodes
            nodes = await self._process_components(ai_workflow.components)
            
            # Filter out invalid connections and process valid ones into edges
            valid_connections = self._filter_valid_connections(ai_workflow.connections, ai_workflow.components)
            edges = await self._process_connections(valid_connections, nodes)
            
            # Generate positions for nodes
            positioned_nodes = self._position_nodes(nodes)
            
            # Create flow data structure
            flow_data = {
                "nodes": positioned_nodes,
                "edges": edges,
                "viewport": {"x": 0, "y": 0, "zoom": 1},
            }
            
            return {
                "name": ai_workflow.name,
                "description": ai_workflow.description,
                "data": flow_data,
                "user_id": str(user_id),
            }
            
        except ValueError as e:
            logger.warning(f"Invalid AI workflow data: {e}")
            raise
        except Exception as e:
            logger.error(f"Error processing AI workflow: {e}")
            raise

    def _validate_workflow(self, ai_workflow: AISuggestedWorkflow) -> None:
        """Validate AI workflow data.
        
        Args:
            ai_workflow: AI-suggested workflow to validate
            
        Raises:
            ValueError: If workflow data is invalid
        """
        if not ai_workflow.components:
            raise ValueError("Workflow must have at least one component")
            
        # Validate components
        for i, component in enumerate(ai_workflow.components):
            if not isinstance(component, dict):
                raise ValueError(f"Component {i} must be a dictionary")
                
            if "type" not in component:
                raise ValueError(f"Component {i} missing required field: type")
                
            if not isinstance(component["type"], str):
                raise ValueError(f"Component {i} type must be a string")
                
            if "id" not in component:
                raise ValueError(f"Component {i} missing required field: id")
                
            if not isinstance(component["id"], str):
                raise ValueError(f"Component {i} id must be a string")
        
        # Validate connections
        for i, connection in enumerate(ai_workflow.connections):
            if not isinstance(connection, dict):
                raise ValueError(f"Connection {i} must be a dictionary")
                
            if "from_component" not in connection:
                raise ValueError(f"Connection {i} missing required field: from_component")
                
            if "to_component" not in connection:
                raise ValueError(f"Connection {i} missing required field: to_component")
                
            if not isinstance(connection["from_component"], str):
                raise ValueError(f"Connection {i} from_component must be a string")
                
            if not isinstance(connection["to_component"], str):
                raise ValueError(f"Connection {i} to_component must be a string")

    def _filter_valid_connections(self, connections: List[Dict[str, Any]], components: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filter out invalid connections like cycles and self-references.
        
        Args:
            connections: List of AI-suggested connections
            components: List of components
            
        Returns:
            List of valid connections
        """
        valid_connections = []
        component_ids = {comp["id"] for comp in components}
        
        for i, connection in enumerate(connections):
            from_comp = connection["from_component"]
            to_comp = connection["to_component"]
            
            # Skip if either component doesn't exist
            if from_comp not in component_ids or to_comp not in component_ids:
                logger.warning(f"Skipping connection {i}: Component not found ({from_comp} -> {to_comp})")
                continue
                
            # Skip self-references
            if from_comp == to_comp:
                logger.warning(f"Skipping connection {i}: Self-reference ({from_comp} -> {to_comp})")
                continue
                
            # Skip obviously invalid patterns (like output->input)
            if self._is_invalid_connection_pattern(from_comp, to_comp):
                logger.warning(f"Skipping connection {i}: Invalid pattern ({from_comp} -> {to_comp})")
                continue
                
            valid_connections.append(connection)
            
        logger.info(f"Filtered connections: {len(connections)} total, {len(valid_connections)} valid")
        return valid_connections

    def _is_invalid_connection_pattern(self, from_comp: str, to_comp: str) -> bool:
        """Check if a connection pattern is obviously invalid.
        
        Args:
            from_comp: Source component ID
            to_comp: Target component ID
            
        Returns:
            True if the connection pattern is invalid, False otherwise
        """
        # Check for obvious invalid patterns
        from_comp_type = from_comp.split('-')[0] if '-' in from_comp else from_comp
        to_comp_type = to_comp.split('-')[0] if '-' in to_comp else to_comp
        
        # Output to Input is typically invalid
        if 'output' in from_comp_type.lower() and 'input' in to_comp_type.lower():
            return True
            
        return False

    async def _process_components(
        self, components: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Convert AI components to flow nodes.
        
        Args:
            components: List of AI-suggested components
            
        Returns:
            List of flow nodes
        """
        nodes = []
        
        # Get all component types from the cache
        all_types_dict = await get_and_cache_all_types_dict(get_settings_service())
        
        for i, component in enumerate(components):
            try:
                # Create a basic node structure
                node_id = str(uuid.uuid4())
                
                # Get the component type and ID from the AI suggestion
                component_type = component.get("type", "UnknownComponent")
                component_id = component["id"]  # Already validated to exist
                
                # Try to find the component in our component cache
                component_template = None
                original_component_name = component_type
                
                # Look for the component in all types
                for category, category_components in all_types_dict.items():
                    if component_type in category_components:
                        component_template = category_components[component_type]
                        original_component_name = component_type
                        break
                
                # If we couldn't find it by exact name, try to find it by display name
                if not component_template:
                    for category, category_components in all_types_dict.items():
                        for name, comp_data in category_components.items():
                            if comp_data.get("display_name", "") == component_type:
                                component_template = comp_data
                                original_component_name = name
                                break
                        if component_template:
                            break
                
                # If we still couldn't find it, create a basic template
                if not component_template:
                    logger.warning(f"Component template not found for '{component_type}', creating basic template")
                    node = {
                        "id": node_id,
                        "type": "genericNode",
                        "position": {"x": 0, "y": 0},
                        "data": {
                            "id": node_id,
                            "type": component_type,
                            "node": {
                                "id": component_id,
                                "display_name": component.get("label", component_type),
                                "template": self._create_template(component),
                                "type": component_type,
                                "base_classes": [],  # Will be populated by Langflow
                            },
                            "outputs": [],
                            # Store the original component ID for connection mapping
                            "original_component_id": component_id,
                        },
                    }
                else:
                    # Create a node with the full component template
                    logger.info(f"Found component template for '{component_type}'")
                    node_template = component_template.get("template", {}).copy()
                    
                    # Apply any parameters from the AI suggestion
                    if "parameters" in component and isinstance(component["parameters"], dict):
                        for key, value in component["parameters"].items():
                            if key in node_template:
                                node_template[key]["value"] = value
                    
                    node = {
                        "id": node_id,
                        "type": "genericNode",
                        "position": {"x": 0, "y": 0},
                        "data": {
                            "id": node_id,
                            "type": original_component_name,  # Use the original component name
                            "node": {
                                "id": component_id,
                                "display_name": component.get("label", component_template.get("display_name", component_type)),
                                "template": node_template,
                                "type": original_component_name,
                                "description": component_template.get("description", ""),
                                "base_classes": component_template.get("base_classes", []),
                                "documentation": component_template.get("documentation", ""),
                                "outputs": component_template.get("outputs", []),
                                "output_types": component_template.get("output_types", []),
                            },
                            "outputs": component_template.get("outputs", []),
                            # Store the original component ID for connection mapping
                            "original_component_id": component_id,
                        },
                    }
                
                logger.info(f"Created node: {node_id} ({component_type}) with original ID: {component_id}")
                nodes.append(node)
                
            except Exception as e:
                logger.error(f"Error processing component {i} ({component_type}): {e}")
                raise ValueError(f"Invalid component {i}: {str(e)}")
        
        return nodes

    def _create_template(self, component: Dict[str, Any]) -> Dict[str, Any]:
        """Create template for a component.
        
        Args:
            component: AI-suggested component
            
        Returns:
            Component template
        """
        template = {}
        
        # Add parameters to template
        if "parameters" in component and isinstance(component["parameters"], dict):
            for key, value in component["parameters"].items():
                template[key] = {
                    "type": type(value).__name__,
                    "value": value,
                }
        
        # Add default fields that Langflow expects
        template["_type"] = component.get("type", "UnknownComponent")
        
        # Add required template fields
        template["display_name"] = component.get("label", component.get("type", "Component"))
        template["type"] = component.get("type", "UnknownComponent")
        
        # Add default values for common fields
        if "ChatInput" in component.get("type", ""):
            template["input_value"] = {"type": "str", "value": ""}
            template["input_key"] = {"type": "str", "value": "text"}
        elif "ChatOutput" in component.get("type", ""):
            template["text"] = {"type": "str", "value": ""}
        elif "File" in component.get("type", ""):
            template["path"] = {"type": "str", "value": ""}
        elif "PromptTemplate" in component.get("type", ""):
            if "template" not in template:
                template["template"] = {"type": "str", "value": ""}
        
        return template

    async def _process_connections(
        self, connections: List[Dict[str, Any]], nodes: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Convert AI connections to flow edges.
        
        Args:
            connections: List of AI-suggested connections
            nodes: List of processed nodes
            
        Returns:
            List of flow edges
        """
        edges = []
        # Create mapping from original component IDs to new node IDs
        node_map = {}
        # Create reverse mapping from node IDs to node data for handle creation
        node_data_map = {}
        
        # Log all node mappings for debugging
        logger.info("Creating node mappings:")
        for node in nodes:
            original_id = node["data"].get("original_component_id")
            if original_id:
                node_map[original_id] = node["id"]
                node_data_map[node["id"]] = node
                logger.info(f"  Mapped '{original_id}' -> '{node['id']}'")
            else:
                logger.warning(f"  Node missing original_component_id: {node}")
        
        logger.info(f"Processing {len(connections)} connections:")
        for i, connection in enumerate(connections):
            try:
                from_component_id = connection["from_component"]
                to_component_id = connection["to_component"]
                
                logger.info(f"  Connection {i}: '{from_component_id}' -> '{to_component_id}'")
                
                # Map logical IDs to actual node IDs
                if from_component_id not in node_map:
                    error_msg = f"Source component '{from_component_id}' not found in node_map. Available mappings: {list(node_map.keys())}"
                    logger.error(error_msg)
                    raise ValueError(error_msg)
                    
                if to_component_id not in node_map:
                    error_msg = f"Target component '{to_component_id}' not found in node_map. Available mappings: {list(node_map.keys())}"
                    logger.error(error_msg)
                    raise ValueError(error_msg)
                
                source_node_id = node_map[from_component_id]
                target_node_id = node_map[to_component_id]
                
                logger.info(f"    Mapped to: '{source_node_id}' -> '{target_node_id}'")
                
                # Get node data for handle creation
                source_node = node_data_map[source_node_id]
                target_node = node_data_map[target_node_id]
                
                # Create proper source and target handles
                source_handle = self._create_source_handle(source_node, connection.get("from_handle"))
                target_handle = self._create_target_handle(target_node, connection.get("to_handle"))
                
                edge_id = str(uuid.uuid4())
                edge = {
                    "id": edge_id,
                    "source": source_node_id,
                    "target": target_node_id,
                    "sourceHandle": source_handle["serialized"],
                    "targetHandle": target_handle["serialized"],
                    "type": "default",
                    "data": {
                        "sourceHandle": source_handle["data"],
                        "targetHandle": target_handle["data"],
                    }
                }
                
                logger.info(f"    Created edge: {edge_id}")
                edges.append(edge)
                
            except Exception as e:
                logger.error(f"Error processing connection {i}: {e}")
                raise ValueError(f"Invalid connection {i}: {str(e)}")
        
        logger.info(f"Created {len(edges)} edges")
        return edges

    def _create_source_handle(self, node: Dict[str, Any], handle_hint: Optional[str] = None) -> Dict[str, Any]:
        """Create a proper source handle for a node.
        
        Args:
            node: Node data
            handle_hint: Optional hint for selecting the handle
            
        Returns:
            Dictionary with serialized handle and data
        """
        node_data = node["data"]
        node_type = node_data.get("type", "")
        
        # Get output types from the node
        output_types = []
        if node_data.get("node", {}).get("output_types"):
            output_types = node_data["node"]["output_types"]
        elif node_data.get("node", {}).get("base_classes"):
            output_types = node_data["node"]["base_classes"]
        else:
            # Default output types
            output_types = ["Message"] if "Chat" in node_type else ["Data"]
        
        # Create handle data
        handle_data = {
            "id": node["id"],
            "name": handle_hint or "output",
            "output_types": output_types,
            "dataType": node_type,
        }
        
        # Serialize handle for use in edge - using the special character the frontend expects
        serialized_handle = json.dumps(handle_data).replace('"', 'œ')
        
        return {
            "data": handle_data,
            "serialized": serialized_handle
        }

    def _create_target_handle(self, node: Dict[str, Any], handle_hint: Optional[str] = None) -> Dict[str, Any]:
        """Create a proper target handle for a node.
        
        Args:
            node: Node data
            handle_hint: Optional hint for selecting the handle
            
        Returns:
            Dictionary with serialized handle and data
        """
        node_data = node["data"]
        node_type = node_data.get("type", "")
        
        # Try to determine field name from hint or use default
        field_name = handle_hint or "input_value"
        
        # Try to get field type from template
        field_type = "str"
        input_types = ["Message"] if "Chat" in node_type else ["Data"]
        
        if node_data.get("node", {}).get("template", {}).get(field_name):
            field_template = node_data["node"]["template"][field_name]
            field_type = field_template.get("type", field_type)
            if field_template.get("input_types"):
                input_types = field_template["input_types"]
        
        # Create handle data
        handle_data = {
            "id": node["id"],
            "fieldName": field_name,
            "type": field_type,
            "inputTypes": input_types,
        }
        
        # Serialize handle for use in edge - using the special character the frontend expects
        serialized_handle = json.dumps(handle_data).replace('"', 'œ')
        
        return {
            "data": handle_data,
            "serialized": serialized_handle
        }

    def _position_nodes(self, nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Position nodes in a visually appealing layout.
        
        Args:
            nodes: List of nodes to position
            
        Returns:
            List of positioned nodes
        """
        # Simple vertical layout for now
        for i, node in enumerate(nodes):
            node["position"] = {
                "x": 200 * (i % 3),
                "y": 200 * (i // 3),
            }
        
        return nodes


async def process_ai_workflow(
    ai_response: Dict[str, Any], user_id: Union[str, uuid.UUID]
) -> Dict[str, Any]:
    """Process AI workflow response into structured flow data.
    
    This function implements the Logic-Injection approach by separating
    AI logic (what components and connections) from structural implementation
    (IDs, positions, proper JSON structure).
    
    Args:
        ai_response: AI-generated workflow data with components and connections
        user_id: User ID for flow ownership
        
    Returns:
        Dictionary with processed flow data ready for creation
        
    Raises:
        ValueError: If AI response data is invalid
        Exception: If processing fails
    """
    try:
        # Use the session_scope context manager properly
        async with session_scope() as session:
            processor = WorkflowProcessor(session)
            
            # Convert AI response to our internal format
            ai_workflow = AISuggestedWorkflow.from_dict(ai_response)
            
            # Process into structured flow
            flow_result = await processor.process_workflow(ai_workflow, user_id)
            
            # Return in the format expected by the frontend
            return {
                "success": True,
                "flow_data": {
                    "name": flow_result["name"],
                    "description": flow_result["description"],
                    "data": flow_result["data"],
                    "user_id": flow_result["user_id"]
                },
                "message": "AI workflow processed successfully",
                "error": None
            }
            
    except ValueError:
        # Re-raise validation errors
        raise
    except Exception as e:
        # Log and re-raise other errors
        logger.error(f"Error in process_ai_workflow: {e}")
        raise