"""AI Workflow Processor for Langflow.

This module implements the Logic-Injection approach to separate AI logic
from structural implementation by processing simplified AI responses
into fully structured flows.
"""

from __future__ import annotations

import uuid
import json
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Union
from uuid import UUID

from loguru import logger

from langflow.services.deps import session_scope, get_settings_service
from langflow.api.v1.ai_workflow_schemas import AISuggestedWorkflow as AISuggestedWorkflowSchema
from langflow.interface.components import get_and_cache_all_types_dict

if TYPE_CHECKING:
    from langflow.services.database.models.flow.model import FlowCreate
    from sqlmodel.ext.asyncio.session import AsyncSession


class AISuggestedWorkflow:
    """Simplified workflow structure from AI responses."""

    def __init__(
        self,
        name: str,
        description: str,
        components: List[Dict[str, Any]],
        connections: List[Dict[str, Any]],
        positions: Optional[Dict[str, Dict[str, float]]] = None,
    ):
        """Initialize with simplified workflow data.
        
        Args:
            name: Human-readable workflow name
            description: Human-readable workflow description
            components: List of component specifications
            connections: List of component connections
            positions: Optional dictionary of preserved positions {node_id: {x, y}}
        """
        self.name = name
        self.description = description
        self.components = components
        self.connections = connections
        self.positions = positions or {}

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
            positions=data.get("positions", {}),
        )


class WorkflowProcessor:
    """Processes AI-suggested workflows into structured flows."""

    def __init__(self, session: AsyncSession, component_templates: Optional[Dict[str, Any]] = None):
        """Initialize with database session and optional component templates.
        
        Args:
            session: Database session
            component_templates: Pre-loaded component templates from /api/v1/all
        """
        self.session = session
        self.component_to_node_map = {}
        self.component_templates = component_templates or {}
        
        # Create name mapping for common AI-generated names to actual component names
        self.name_mapping = {
            "PromptTemplate": "Prompt",
            "ChatInput": "Chat Input",
            "ChatOutput": "Chat Output",
            "OpenAIModel": "OpenAI",
            "LLM": "OpenAI",
            "Model": "OpenAI",
            "Prompt": "Prompt",
            "TextInput": "Text Input",
            "TextOutput": "Text Output",
        }

    async def _process_components(
        self, components: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Convert AI components to flow nodes using actual component templates.
        
        Args:
            components: List of AI-suggested components
            
        Returns:
            List of flow nodes with proper templates
        """
        nodes = []
        self.component_to_node_map = {}  # Track component ID to node ID mapping
        
        for i, component in enumerate(components):
            try:
                # Create a unique node ID
                node_id = str(uuid.uuid4())
                component_id = component.get("id", f"component_{i}")
                component_type = component.get("type", "UnknownComponent")
                
                # Store the mapping
                self.component_to_node_map[component_id] = node_id
                
                # Find the actual component template
                actual_component_name, component_template = self._find_component_template(component_type)
                
                if component_template:
                    # Use the real component template
                    node = self._create_node_from_template(
                        node_id, 
                        component_id,
                        actual_component_name, 
                        component_template, 
                        component
                    )
                    logger.debug(f"Created node with real template: {actual_component_name}")
                else:
                    # Fallback: create basic node
                    node = self._create_basic_node(node_id, component_id, component_type, component)
                    logger.warning(f"Component template not found for '{component_type}', using basic template")
                
                nodes.append(node)
                
            except Exception as e:
                logger.error(f"Error processing component {component}: {e}")
                # Continue processing other components
                continue
                
        return nodes
    
    def _find_component_template(self, component_type: str) -> tuple[str, Optional[Dict[str, Any]]]:
        """Find the actual component template from the component cache.
        
        Args:
            component_type: AI-suggested component type
            
        Returns:
            Tuple of (actual_component_name, template) or (component_type, None) if not found
        """
        # Try exact match first
        for category, category_components in self.component_templates.items():
            if component_type in category_components:
                return component_type, category_components[component_type]
        
        # Try name mapping
        if component_type in self.name_mapping:
            mapped_name = self.name_mapping[component_type]
            for category, category_components in self.component_templates.items():
                if mapped_name in category_components:
                    return mapped_name, category_components[mapped_name]
        
        # Try fuzzy matching by display name
        component_type_lower = component_type.lower().replace(" ", "").replace("_", "")
        for category, category_components in self.component_templates.items():
            for name, comp_data in category_components.items():
                display_name = comp_data.get("display_name", "")
                display_name_lower = display_name.lower().replace(" ", "").replace("_", "")
                
                # Check if AI name matches display name
                if (component_type_lower == display_name_lower or 
                    component_type_lower in display_name_lower or
                    display_name_lower in component_type_lower):
                    return name, comp_data
        
        return component_type, None
    
    def _create_node_from_template(
        self, 
        node_id: str, 
        component_id: str,
        component_name: str, 
        template: Dict[str, Any], 
        ai_component: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create a node using the real component template.
        
        Args:
            node_id: Generated node ID
            component_id: Original component ID from AI
            component_name: Actual component name
            template: Component template from cache
            ai_component: AI-suggested component data (can include parameters)
            
        Returns:
            Node data structure matching manual workflow creation
            
        Note:
            For Prompt Template nodes, if the template parameter contains variables
            (e.g., "Hello {user_input}!"), this method will automatically process
            the template to create dynamic input fields for those variables.
            This ensures that connections can be made to the prompt template.
        """
        import copy
        
        # Deep clone the template to avoid modifying the cached version
        component_data = copy.deepcopy(template)
        
        # Ensure template fields have proper default values
        if "template" in component_data:
            for field_name, field_value in component_data["template"].items():
                if isinstance(field_value, dict):
                    # Fix file type fields - ensure value is a string (filename) not array
                    if field_value.get("type") == "file":
                        # File fields should have string values (filename), not arrays
                        # file_path can be string or array depending on isList
                        if not isinstance(field_value.get("value"), str):
                            field_value["value"] = ""
                        # Ensure file_path exists and is proper type
                        if "file_path" not in field_value:
                            field_value["file_path"] = "" if not field_value.get("list", False) else []
        
        # Apply AI-suggested parameters to the template if provided
        if "parameters" in ai_component and isinstance(ai_component["parameters"], dict):
            template_fields = component_data.get("template", {})
            for key, value in ai_component["parameters"].items():
                if key in template_fields and isinstance(template_fields[key], dict):
                    template_fields[key]["value"] = value
        
        # Auto-process Prompt Template nodes to create dynamic input fields
        if component_name in ["Prompt", "Prompt Template"]:
            self._process_prompt_template_node(component_data)
        
        # Create node structure that matches manual workflow creation
        # This matches the structure from useAddComponent in use-add-component.ts
        node = {
            "id": node_id,
            "type": "genericNode",  # Must match getNodeRenderType("genericnode")
            "position": {"x": 0, "y": 0},
            "data": {
                "node": component_data,  # The FULL component template (APIClassType)
                "type": component_name,
                "id": node_id,
            },
            "selected": False,
            "positionAbsolute": {"x": 0, "y": 0},
        }
        
        return node
    
    def _process_prompt_template_node(self, component_data: Dict[str, Any]) -> None:
        """Process Prompt Template node to create dynamic input fields from template variables.
        
        This auto-processes the template value (e.g., "Hello {user_input}!")
        to create the corresponding input fields for variables like {user_input}.
        
        Args:
            component_data: Component data dictionary (modified in-place)
        """
        try:
            # Get the template value
            template_field = component_data.get("template", {}).get("template", {})
            template_value = template_field.get("value", "")
            
            # If template has a value with variables, process it
            if template_value and "{" in template_value:
                logger.info(f"Processing prompt template with value: {template_value[:100]}...")
                
                # Initialize custom_fields if not present
                if "custom_fields" not in component_data:
                    component_data["custom_fields"] = {}
                
                # Ensure the custom_fields has a "template" key
                if "template" not in component_data["custom_fields"]:
                    component_data["custom_fields"]["template"] = []
                
                try:
                    # Try importing the proper API utils
                    from lfx.base.prompts.api_utils import process_prompt_template
                    
                    # Process the template to extract variables and create input fields
                    input_variables = process_prompt_template(
                        template=template_value,
                        name="template",
                        custom_fields=component_data["custom_fields"],
                        frontend_node_template=component_data["template"],
                    )
                    
                    logger.info(f"Successfully processed prompt template with variables: {input_variables}")
                except ImportError as import_err:
                    # Fallback: manual variable extraction if import fails
                    logger.warning(f"Could not import process_prompt_template: {import_err}. Using fallback.")
                    self._process_prompt_template_fallback(component_data, template_value)
                    
        except Exception as e:
            # Log the error properly (synchronously) so we can debug
            logger.error(f"Failed to auto-process prompt template: {e}", exc_info=True)
            # Try fallback approach
            try:
                template_value = component_data.get("template", {}).get("template", {}).get("value", "")
                if template_value and "{" in template_value:
                    self._process_prompt_template_fallback(component_data, template_value)
            except Exception as fallback_err:
                logger.error(f"Fallback also failed: {fallback_err}")
    
    def _process_prompt_template_fallback(self, component_data: Dict[str, Any], template_value: str) -> None:
        """Fallback method to manually extract variables from template.
        
        This standalone fallback doesn't require lfx imports.
        
        Args:
            component_data: Component data dictionary
            template_value: Template string with {variables}
        """
        import re
        
        # Extract variables using regex
        variables = re.findall(r"\{(\w+)\}", template_value)
        variables = list(dict.fromkeys(variables))  # Remove duplicates while preserving order
        
        logger.info(f"Fallback: Extracted variables: {variables}")
        
        # Initialize structures
        if "custom_fields" not in component_data:
            component_data["custom_fields"] = {}
        if "template" not in component_data["custom_fields"]:
            component_data["custom_fields"]["template"] = []
        
        # Create input fields for each variable
        for variable in variables:
            if variable not in component_data["template"]:
                # Create a simple field definition matching DefaultPromptField structure
                field_def = {
                    "type": "str",
                    "required": False,
                    "placeholder": "",
                    "list": False,
                    "show": True,
                    "multiline": True,
                    "value": "",
                    "fileTypes": [],
                    "file_path": "",
                    "password": False,
                    "name": variable,
                    "display_name": variable,
                    "advanced": False,
                    "input_types": ["Message", "Text"],
                    "dynamic": False,
                    "info": "",
                    "load_from_db": False,
                    "title_case": False,
                }
                component_data["template"][variable] = field_def
                
                # Add to custom_fields list
                if variable not in component_data["custom_fields"]["template"]:
                    component_data["custom_fields"]["template"].append(variable)
        
        # Update input_variables field if present
        if "input_variables" in component_data["template"]:
            component_data["template"]["input_variables"]["value"] = variables
        
        logger.info(f"Fallback: Created {len(variables)} input fields for prompt template")
    
    def _create_basic_node(
        self, 
        node_id: str, 
        component_id: str,
        component_type: str, 
        ai_component: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create a basic node when template is not found.
        
        Args:
            node_id: Generated node ID
            component_id: Original component ID from AI
            component_type: Component type
            ai_component: AI-suggested component data
            
        Returns:
            Basic node data structure
        """
        # Determine default output types based on component type
        output_types = ["Message"] if "Chat" in component_type or "Input" in component_type or "Output" in component_type else ["Data"]
        
        node = {
            "id": node_id,
            "type": "genericNode",
            "position": {"x": 0, "y": 0},
            "data": {
                "id": node_id,
                "type": component_type,
                "node": {
                    "id": component_id,
                    "type": component_type,
                    "display_name": ai_component.get("label", component_type),
                    "template": ai_component.get("parameters", {}),
                    "base_classes": output_types,
                    "outputs": [
                        {
                            "types": output_types,
                            "selected": output_types[0] if output_types else "Data",
                            "name": "output",
                            "display_name": "Output",
                        }
                    ],
                },
            },
        }
        
        return node
    
    def _are_types_compatible(self, source_types: List[str], target_types: List[str]) -> bool:
        """Check if source output types are compatible with target input types.
        
        Args:
            source_types: List of types that the source outputs
            target_types: List of types that the target accepts
            
        Returns:
            True if types are compatible, False otherwise
        """
        # If either list is empty, assume compatible (permissive)
        if not source_types or not target_types:
            return True
        
        # Message type is considered universal
        if "Message" in source_types or "Message" in target_types:
            return True
        
        # Check for any overlap in types (case-insensitive)
        source_lower = [t.lower() for t in source_types]
        target_lower = [t.lower() for t in target_types]
        
        return any(s in target_lower for s in source_lower)

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
        
        # Create a lookup dictionary for nodes by ID for faster access
        node_lookup = {node["id"]: node for node in nodes}
        node_data_map = {node["id"]: node for node in nodes}
        
        for i, connection in enumerate(connections):
            try:
                from_component_id = connection.get("from_component")
                to_component_id = connection.get("to_component")
                
                # Look up the actual node IDs using our mapping
                source_node_id = self.component_to_node_map.get(from_component_id)
                target_node_id = self.component_to_node_map.get(to_component_id)
                
                # Validate that both nodes exist
                if not source_node_id:
                    logger.warning(f"Source component '{from_component_id}' not found in component mapping")
                    continue
                    
                if not target_node_id:
                    logger.warning(f"Target component '{to_component_id}' not found in component mapping")
                    continue
                
                # Prevent self-connections
                if source_node_id == target_node_id:
                    logger.warning(f"Skipping self-connection from component '{from_component_id}' to itself")
                    continue
                
                # Get the actual source and target nodes
                source_node = node_lookup.get(source_node_id)
                target_node = node_lookup.get(target_node_id)
                
                if not source_node or not target_node:
                    logger.warning(f"Could not find source or target node for connection {from_component_id} -> {to_component_id}")
                    continue
                
                # Create proper source and target handles like manual workflows do
                source_handle = self._create_source_handle(source_node, connection.get("from_handle"))
                target_handle = self._create_target_handle(target_node, connection.get("to_handle"))
                
                # Validate type compatibility
                if not self._are_types_compatible(
                    source_handle["data"].get("output_types", []),
                    target_handle["data"].get("inputTypes", [])
                ):
                    logger.warning(
                        f"Type mismatch in connection {from_component_id} -> {to_component_id}: "
                        f"source outputs {source_handle['data'].get('output_types', [])} "
                        f"but target accepts {target_handle['data'].get('inputTypes', [])}"
                    )
                    # Continue anyway, but log the warning
                
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
                
                edges.append(edge)
                
            except Exception as e:
                logger.error(f"Error processing connection {connection}: {e}")
                # Continue processing other connections
                continue
                
        return edges

    def _create_source_handle(self, node: Dict[str, Any], handle_hint: Optional[str] = None) -> Dict[str, Any]:
        """Create a proper source handle for a node based on its outputs.
        
        Args:
            node: Node data with template
            handle_hint: Optional hint for selecting the handle (output name)
            
        Returns:
            Dictionary with serialized handle and data
        """
        node_data = node["data"]
        node_type = node_data.get("type", "")
        
        # Get outputs from the node template (now stored in data.node)
        outputs = node_data.get("node", {}).get("outputs", [])
        
        # Find the specific output or use the first one
        selected_output = None
        if handle_hint:
            # Try to find output by name
            selected_output = next((out for out in outputs if out.get("name") == handle_hint), None)
        
        if not selected_output and outputs:
            # Use the first output
            selected_output = outputs[0]
        
        # Get output types from the selected output or fall back to defaults
        if selected_output:
            output_types = selected_output.get("types", [])
            output_name = selected_output.get("name", "output")
        else:
            # Fallback for nodes without outputs defined
            output_types = node_data.get("node", {}).get("output_types", [])
            if not output_types:
                output_types = node_data.get("node", {}).get("base_classes", [])
            if not output_types:
                output_types = ["Message"] if "Chat" in node_type or "Input" in node_type else ["Data"]
            output_name = handle_hint or "output"
        
        # Create handle data matching frontend expectations
        handle_data = {
            "id": node["id"],
            "name": output_name,
            "output_types": output_types,
            "dataType": node_type,
        }
        
        # Serialize handle for use in edge
        serialized_handle = self._scaped_json_stringify(handle_data)
        
        return {
            "data": handle_data,
            "serialized": serialized_handle
        }

    def _create_target_handle(self, node: Dict[str, Any], handle_hint: Optional[str] = None) -> Dict[str, Any]:
        """Create a proper target handle for a node based on its template inputs.
        
        Args:
            node: Node data with template
            handle_hint: Optional hint for selecting the handle (field name)
            
        Returns:
            Dictionary with serialized handle and data
        """
        node_data = node["data"]
        node_type = node_data.get("type", "")
        template = node_data.get("node", {}).get("template", {})
        
        # Find the best input field
        field_name = handle_hint
        field_type = "str"
        input_types = []
        
        # If hint is provided, try to use that field
        if field_name and field_name in template:
            field_template = template[field_name]
            field_type = field_template.get("type", "str")
            input_types = field_template.get("input_types", [])
        else:
            # Find the first HandleInput or input field with input_types
            for field_key, field_value in template.items():
                if isinstance(field_value, dict):
                    # Check if this is an input field (has input_types)
                    if field_value.get("input_types"):
                        field_name = field_key
                        field_type = field_value.get("type", "str")
                        input_types = field_value["input_types"]
                        break
            
            # If no input field found, use common defaults
            if not field_name:
                if "input_value" in template:
                    field_name = "input_value"
                    field_template = template["input_value"]
                    field_type = field_template.get("type", "str")
                    input_types = field_template.get("input_types", [])
                else:
                    # Last resort: use a default field name
                    field_name = "input_value"
        
        # If no input_types found, use defaults based on node type
        if not input_types:
            if "Chat" in node_type or "Output" in node_type:
                input_types = ["Message"]
            else:
                input_types = ["Data"]
        
        # Create handle data matching frontend expectations
        handle_data = {
            "id": node["id"],
            "fieldName": field_name,
            "type": field_type,
            "inputTypes": input_types,
        }
        
        # Serialize handle for use in edge
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
        if obj is None or obj is None:
            return "null"
            
        if not isinstance(obj, (dict, list)) or obj is None:
            if isinstance(obj, bool):
                return "true" if obj else "false"
            if isinstance(obj, (int, float)):
                return str(obj)
            if isinstance(obj, str):
                # Escape quotes and backslashes
                escaped = obj.replace('\\', '\\\\').replace('"', '\\"')
                return f'"{escaped}"'
            return json.dumps(obj)
            
        if isinstance(obj, list):
            items = [self._custom_stringify(item) for item in obj]
            return f"[{','.join(items)}]"
            
        # For dictionaries, sort keys and stringify
        keys = sorted(obj.keys())
        pairs = []
        for key in keys:
            value = obj[key]
            key_str = f'"{key}"'
            value_str = self._custom_stringify(value)
            pairs.append(f"{key_str}:{value_str}")
        return "{" + ",".join(pairs) + "}"

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
        self, ai_workflow: AISuggestedWorkflow, user_id: Union[str, uuid.UUID], positions: Optional[Dict[str, Dict[str, float]]] = None
    ) -> Dict[str, Any]:
        """Process AI workflow into structured flow data.
        
        Args:
            ai_workflow: AI-suggested workflow structure
            user_id: User ID for flow ownership
            positions: Optional dictionary of preserved positions {node_id: {x, y}}
            
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
            positioned_nodes = self._position_nodes(nodes, positions)
            
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

    def _position_nodes(self, nodes: List[Dict[str, Any]], positions: Optional[Dict[str, Dict[str, float]]] = None) -> List[Dict[str, Any]]:
        """Calculate positions for nodes in the flow.
        
        Args:
            nodes: List of nodes to position
            positions: Optional dictionary of preserved positions {node_id: {x, y}}
            
        Returns:
            List of positioned nodes
        """
        positioned_nodes = []
        
        for i, node in enumerate(nodes):
            positioned_node = node.copy()
            
            # Use preserved position if available, otherwise generate new position
            node_id = node.get("id")
            if positions and node_id and node_id in positions:
                positioned_node["position"] = positions[node_id]
            else:
                # Simple grid positioning
                column = i % 3
                row = i // 3
                positioned_node["position"] = {"x": column * 300, "y": row * 200}
            
            positioned_nodes.append(positioned_node)
            
        return positioned_nodes


# Utility functions for external use
async def process_ai_workflow(
    ai_response: Dict[str, Any], 
    user_id: Union[str, uuid.UUID],
    component_templates: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Process AI workflow response into structured flow data.
    
    Args:
        ai_response: Dictionary containing AI-suggested workflow
        user_id: User ID for flow ownership
        component_templates: Optional pre-loaded component templates from /api/v1/all
        
    Returns:
        Dictionary with processed flow data ready for creation
        
    Raises:
        ValueError: If workflow data is invalid
        Exception: If processing fails
    """
    try:
        # Load component templates if not provided
        if component_templates is None:
            settings_service = get_settings_service()
            component_templates = await get_and_cache_all_types_dict(settings_service)
        
        # Extract positions if provided
        positions = ai_response.get("positions", None)
        
        # Use the session_scope context manager properly
        async with session_scope() as session:
            processor = WorkflowProcessor(session, component_templates)
            ai_workflow = AISuggestedWorkflow.from_dict(ai_response)
            result = await processor.process_workflow(ai_workflow, user_id, positions)
            
            # Wrap the result in the expected format
            return {
                "success": True,
                "flow_data": result,
                "message": "AI workflow processed successfully"
            }
    except ValueError:
        # Re-raise validation errors
        raise
    except Exception as e:
        # Log and re-raise other errors
        logger.error(f"Failed to process AI workflow: {e}")
        raise
