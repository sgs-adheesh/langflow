"""AI Workflow Processor for converting AI-suggested workflows into structured flow data."""

import asyncio
import json
import logging
import uuid
from typing import Any, Dict, List, Optional, Union

from langflow.logger import logger
from langflow.models.db import Flow
from langflow.services.database.utils import session_scope
from langflow.utils.util import async_create_langflow_client

from .schemas import AISuggestedWorkflow


class WorkflowProcessor:
    """Processor for converting AI-suggested workflows into structured flow data."""

    def __init__(self, session=None):
        """Initialize workflow processor.
        
        Args:
            session: Database session (optional)
        """
        self.session = session
        self.client = None

    async def _ensure_client(self):
        """Ensure langflow client is available."""
        if self.client is None:
            self.client = await async_create_langflow_client()

    async def _process_components(
        self, components: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Process AI components into flow nodes.
        
        Args:
            components: List of AI-suggested components
            
        Returns:
            List of flow nodes
            
        Raises:
            ValueError: If component processing fails
        """
        await self._ensure_client()
        nodes = []
        
        # Track component_id to node_id mapping for connections
        component_to_node_map = {}
        
        for i, component in enumerate(components):
            try:
                component_type = component["type"]
                component_id = component["id"]
                
                # Create node using the same logic as manual creation
                node_data = await self.client.create_node_from_component(
                    component_type=component_type,
                    position={"x": 300 * (i % 3), "y": 200 * (i // 3)},
                )
                
                # Update node with component ID for mapping
                node_data["data"]["component_id"] = component_id
                node_data["data"]["node_id"] = node_data["id"]
                
                # Store mapping for connection processing
                component_to_node_map[component_id] = node_data["id"]
                
                logger.info(f"Created node {node_data['id']} for component {component_id}")
                nodes.append(node_data)
                
            except Exception as e:
                logger.error(f"Error processing component {i}: {e}")
                raise ValueError(f"Invalid component {i}: {str(e)}")
        
        return nodes

    async def _process_connections(
        self, connections: List[Dict[str, Any]], nodes: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Process AI connections into flow edges.
        
        Args:
            connections: List of AI-suggested connections
            nodes: List of created nodes
            
        Returns:
            List of flow edges
            
        Raises:
            ValueError: If connection processing fails
        """
        # Create lookup for nodes by component_id
        node_lookup = {node["data"]["component_id"]: node for node in nodes}
        edges = []
        
        for i, connection in enumerate(connections):
            try:
                from_component = connection["from_component"]
                to_component = connection["to_component"]
                
                # Get source and target nodes using component_id mapping
                source_node = node_lookup.get(from_component)
                target_node = node_lookup.get(to_component)
                
                if not source_node:
                    raise ValueError(f"Source component {from_component} not found")
                    
                if not target_node:
                    raise ValueError(f"Target component {to_component} not found")
                
                source_node_id = source_node["id"]
                target_node_id = target_node["id"]
                
                # Create proper source and target handles like manual workflows do
                source_handle = self._create_source_handle(source_node, connection.get("from_handle"))
                target_handle = self._create_target_handle(target_node, connection.get("to_handle"))
                
                # Create edge with proper handle structure matching frontend exactly
                edge_id = f"reactflow__edge-{source_node_id}{source_handle['serialized']}-{target_node_id}{target_handle['serialized']}"
                
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
        
        # Create handle data - match frontend exactly
        handle_data = {
            "id": node["id"],
            "name": handle_hint or "output",
            "output_types": output_types,
            "dataType": node_type,
        }
        
        # Serialize handle for use in edge - using the special character the frontend expects
        # Match frontend exactly: customStringify then replace quotes with 'œ'
        serialized_handle = self._scaped_json_stringify(handle_data)
        
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
        
        # Create handle data - match frontend exactly
        handle_data = {
            "id": node["id"],
            "fieldName": field_name,
            "type": field_type,
            "inputTypes": input_types,
        }
        
        # Serialize handle for use in edge - using the special character the frontend expects
        # Match frontend exactly: customStringify then replace quotes with 'œ'
        serialized_handle = self._scaped_json_stringify(handle_data)
        
        return {
            "data": handle_data,
            "serialized": serialized_handle
        }

    def _custom_stringify(self, obj: Any) -> str:
        """Custom JSON stringify that matches frontend implementation.
        
        Args:
            obj: Object to stringify
            
        Returns:
            Stringified object
        """
        # Handle None/undefined values
        if obj is None:
            return "null"
            
        # Handle non-object types using json.dumps like frontend
        if not isinstance(obj, (dict, list)):
            if isinstance(obj, bool):
                return "true" if obj else "false"
            # Use json.dumps for all other types to match frontend behavior exactly
            return json.dumps(obj)
            
        # Handle arrays
        if isinstance(obj, list):
            array_items = [self._custom_stringify(item) for item in obj]
            return f"[{','.join(array_items)}]"
            
        # Handle objects (dictionaries) - sort keys like frontend
        keys = sorted(obj.keys())
        key_value_pairs = []
        for key in keys:
            # Use json.dumps to properly escape the key like frontend does
            key_str = json.dumps(str(key))
            value_str = self._custom_stringify(obj[key])
            key_value_pairs.append(f"{key_str}:{value_str}")
        return "{" + ",".join(key_value_pairs) + "}"

    def _scaped_json_stringify(self, obj: Any) -> str:
        """Serialize JSON object with 'œ' replacing quotes to match frontend.
        
        Args:
            obj: Object to serialize
            
        Returns:
            Serialized string with 'œ' replacing quotes
        """
        json_str = self._custom_stringify(obj)
        return json_str.replace('"', 'œ')

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
            
            # Process connections into edges
            edges = await self._process_connections(
                ai_workflow.connections, nodes
            )
            
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
            await logger.awarning(f"Invalid AI workflow data: {e}")
            raise
        except Exception as e:
            await logger.aerror(f"Error processing AI workflow: {e}")
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

    def _position_nodes(self, nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Calculate positions for nodes in the flow.
        
        Args:
            nodes: List of nodes to position
            
        Returns:
            List of positioned nodes
        """
        positioned_nodes = []
        
        for i, node in enumerate(nodes):
            # Simple grid positioning
            column = i % 3
            row = i // 3
            
            positioned_node = node.copy()
            positioned_node["position"] = {"x": column * 300, "y": row * 200}
            
            positioned_nodes.append(positioned_node)
            
        return positioned_nodes


# Utility functions for external use
async def process_ai_workflow(
    ai_response: Dict[str, Any], user_id: Union[str, uuid.UUID]
) -> Dict[str, Any]:
    """Process AI workflow response into structured flow data.
    
    Args:
        ai_response: Dictionary containing AI-suggested workflow
        user_id: User ID for flow ownership
        
    Returns:
        Dictionary with processed flow data ready for creation
        
    Raises:
        ValueError: If workflow data is invalid
        Exception: If processing fails
    """
    try:
        # Use the session_scope context manager properly
        async with session_scope() as session:
            processor = WorkflowProcessor(session)
            ai_workflow = AISuggestedWorkflow.from_dict(ai_response)
            return await processor.process_workflow(ai_workflow, user_id)
    except ValueError:
        # Re-raise validation errors
        raise
    except Exception as e:
        # Log and re-raise other errors
        await logger.aerror(f"Failed to process AI workflow: {e}")
        raise