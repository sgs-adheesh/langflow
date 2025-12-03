/**
 * AI Workflow Converter Utilities
 * 
 * Converts between full Langflow workflow format (nodes/edges) 
 * and simplified AI-friendly format (components/connections)
 */

import type { FlowType } from "@/types/flow";

/**
 * Simplified workflow format for AI processing
 */
export type SimplifiedWorkflow = {
  name: string;
  description: string;
  components: SimplifiedComponent[];
  connections: SimplifiedConnection[];
};

export type SimplifiedComponent = {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, any>;
};

export type SimplifiedConnection = {
  from_component: string;
  to_component: string;
  from_handle?: string;
  to_handle?: string;
};

/**
 * Convert full workflow to simplified format for AI
 */
export function convertFlowToSimplified(flow: FlowType): SimplifiedWorkflow {
  if (!flow?.data) {
    throw new Error("Invalid flow data");
  }

  const components: SimplifiedComponent[] = flow.data.nodes?.map((node) => {
    const component: SimplifiedComponent = {
      id: node.id,
      type: node.data?.type || "Unknown",
    };

    // Add display name if different from type
    if (node.data?.node?.display_name) {
      component.label = node.data.node.display_name;
    }

    // Extract modified parameters (non-default values)
    const modifiedParams = extractModifiedParameters(node.data);
    if (Object.keys(modifiedParams).length > 0) {
      component.parameters = modifiedParams;
    }

    return component;
  }) || [];

  const connections: SimplifiedConnection[] = flow.data.edges?.map((edge) => {
    const connection: SimplifiedConnection = {
      from_component: edge.source,
      to_component: edge.target,
    };

    // Add handle information if available
    if (edge.sourceHandle) {
      connection.from_handle = typeof edge.sourceHandle === 'string' 
        ? edge.sourceHandle 
        : (edge.sourceHandle as any)?.name;
    }
    
    if (edge.targetHandle) {
      connection.to_handle = typeof edge.targetHandle === 'string'
        ? edge.targetHandle
        : (edge.targetHandle as any)?.fieldName;
    }

    return connection;
  }) || [];

  return {
    name: flow.name || "Unnamed Workflow",
    description: flow.description || "",
    components,
    connections,
  };
}

/**
 * Extract only user-modified parameters from a node
 * (excludes default/template values to reduce payload size)
 */
export function extractModifiedParameters(nodeData: any): Record<string, any> {
  const modified: Record<string, any> = {};

  if (!nodeData?.node?.template) {
    return modified;
  }

  const template = nodeData.node.template;

  // Iterate through template fields
  Object.keys(template).forEach((key) => {
    const field = template[key];
    
    // Skip non-user fields
    if (field.advanced || field.password || !field.show) {
      return;
    }

    // Check if value differs from default
    const currentValue = field.value;
    const defaultValue = field.default;

    // Include if value exists and differs from default
    if (
      currentValue !== undefined &&
      currentValue !== null &&
      currentValue !== defaultValue &&
      currentValue !== ""
    ) {
      modified[key] = currentValue;
    }
  });

  return modified;
}

/**
 * Format simplified workflow as a string for AI context
 */
export function formatSimplifiedWorkflowForAI(workflow: SimplifiedWorkflow): string {
  return JSON.stringify(workflow, null, 2);
}

/**
 * Validate simplified workflow structure
 */
export function validateSimplifiedWorkflow(workflow: any): workflow is SimplifiedWorkflow {
  return (
    workflow &&
    typeof workflow === "object" &&
    typeof workflow.name === "string" &&
    typeof workflow.description === "string" &&
    Array.isArray(workflow.components) &&
    Array.isArray(workflow.connections)
  );
}
