import { useEffect, useMemo, useRef, useState } from "react";
import { cloneDeep } from "lodash";
import type { ReactFlowJsonObject } from "@xyflow/react";
import { Loader2 } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeMathjax from "rehype-mathjax/browser";
import { BRAND_NAME, BRAND_TAGLINE } from "@/constants/branding";
import { useCustomNavigate } from "@/customization/hooks/use-custom-navigate";
import { useStreamWorkflow } from "@/hooks/useStreamWorkflow";
import { customGetAccessToken } from "@/customization/utils/custom-get-access-token";
import { useGetTypes } from "@/controllers/API/queries/flows/use-get-types";
import useAddFlow from "@/hooks/flows/use-add-flow";
import { Button } from "@/components/ui/button";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { useTypesStore } from "@/stores/typesStore";
import { getLayoutedNodes } from "@/utils/layoutUtils";
import type {
  APIClassType,
  APITemplateType,
  InputFieldType,
  OutputFieldType,
} from "@/types/api";
import type {
  AllNodeType,
  EdgeType,
  FlowType,
  sourceHandleType,
  targetHandleType,
} from "@/types/flow";
import { getNodeId, scapedJSONStringfy } from "@/utils/reactflowUtils";
import { cn } from "@/utils/utils";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatAssistantProps = {
  variant?: "page" | "dialog";
  onClose?: () => void; // Callback to close dialog
};

type BlueprintNodeInput = {
  id?: string;
  type?: string;
  position?: { x?: number; y?: number };
  data?: Record<string, any>;
  template?: Record<string, any>;
  parameters?: Record<string, any>;
  config?: Record<string, any>;
  settings?: Record<string, any>;
  label?: string;
  name?: string;
  display_name?: string;
};

type BlueprintEdgeInput = {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: unknown;
  targetHandle?: unknown;
  data?: Record<string, any>;
};

type BlueprintGraph = {
  name?: string;
  description?: string;
  nodes?: BlueprintNodeInput[];
  edges?: BlueprintEdgeInput[];
  viewport?: { x?: number; y?: number; zoom?: number };
};

type HandleHint = {
  name?: string;
  fieldName?: string;
  type?: string;
  inputTypes?: string[];
  output_types?: string[];
};

type BlueprintPlan = {
  name?: string;
  description?: string;
  summary: string;
  warnings: string[];
  flowData: ReactFlowJsonObject<AllNodeType, EdgeType>;
};

type BlueprintProcessingResult = {
  finalText: string;
  plan?: BlueprintPlan;
  shouldClearPlan?: boolean;
};

// Add new types for our simplified AI workflow approach
type AIComponent = {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, any>;
};

type AIConnection = {
  from_component: string;
  to_component: string;
  from_handle?: string;
  to_handle?: string;
};

type AISuggestedWorkflow = {
  name: string;
  description: string;
  components: AIComponent[];
  connections: AIConnection[];
};

const ASSISTANT_CONFIG = {
  baseUrl: "http://localhost:7860",
  flowId: "3eba9d9e-b637-4b74-9988-955386f05096",
  apiKey: "sk-2Qzpowa4Xdt7n5C2J4InZDGTR_z9ztaY5latLJenClY",
  sessionId:
    import.meta.env.VITE_ASSISTANT_SESSION_ID ??
    `flow-chat-${Math.random().toString(36).slice(2, 10)}`,
};

const TYPE_ALIASES: Record<string, string> = {
  openaimodel: "OpenAIModel",
  openai: "OpenAIModel",
  llm: "OpenAIModel",
  prompt: "PromptTemplate",
  prompttemplate: "PromptTemplate",
  embeddings: "OpenAIEmbeddings",
  openaiembeddings: "OpenAIEmbeddings",
  retriever: "VectorStoreRetriever",
  chroma: "Chroma",
  vectorstore: "Chroma",
  file: "File",
  agent: "Agent",
  chatinput: "ChatInput",
  chatoutput: "ChatOutput",
};

const DEFAULT_SOURCE_NAMES = [
  "text_output",
  "output",
  "response",
  "message",
  "result",
];

const DEFAULT_TARGET_FIELDS = [
  "input_value",
  "user_input",
  "input",
  "prompt",
  "text",
  "query",
];

const normalizeKey = (value?: string) =>
  value?.replace(/[\s_-]/g, "").toLowerCase() ?? "";

const pluralize = (word: string, count: number) =>
  `${word}${count === 1 ? "" : "s"}`;

const resolveComponentDefinition = (
  desiredType: string | undefined,
  templates: Record<string, APIClassType>,
):
  | {
      type: string;
      component: APIClassType;
    }
  | null => {
  if (!desiredType) return null;
  const normalized = normalizeKey(desiredType);
  const directKey = Object.keys(templates).find(
    (key) => normalizeKey(key) === normalized,
  );
  if (directKey) {
    return { type: directKey, component: templates[directKey] };
  }
  const aliasKey = TYPE_ALIASES[normalized];
  if (aliasKey && templates[aliasKey]) {
    return { type: aliasKey, component: templates[aliasKey] };
  }
  const displayMatch = Object.entries(templates).find(
    ([, component]) =>
      component.display_name &&
      normalizeKey(component.display_name) === normalized,
  );
  if (displayMatch) {
    return { type: displayMatch[0], component: displayMatch[1] };
  }
  const baseClassMatch = Object.entries(templates).find(([, component]) =>
    component.base_classes?.some(
      (baseClass) => normalizeKey(baseClass) === normalized,
    ),
  );
  if (baseClassMatch) {
    return { type: baseClassMatch[0], component: baseClassMatch[1] };
  }
  return null;
};

const collectOverrides = (node: BlueprintNodeInput) => {
  const sources = [
    node.template,
    node.parameters,
    node.config,
    node.settings,
    node.data?.template,
    node.data?.parameters,
    node.data?.config,
    node.data?.node?.template,
  ];
  return sources.reduce((acc, source) => {
    if (source && typeof source === "object" && !Array.isArray(source)) {
      Object.entries(source).forEach(([key, value]) => {
        if (value === undefined) return;
        if (
          typeof value === "object" &&
          value !== null &&
          "value" in value &&
          Object.keys(value).length === 1
        ) {
          acc[key] = (value as { value: unknown }).value;
        } else {
          acc[key] = value;
        }
      });
    }
    return acc;
  }, {} as Record<string, unknown>);
};

const applyTemplateOverrides = (
  component: APIClassType,
  overrides: Record<string, unknown>,
) => {
  if (!component?.template || !overrides) return;
  Object.entries(overrides).forEach(([field, fieldValue]) => {
    if (!(field in component.template!)) return;
    if (
      typeof fieldValue === "object" &&
      fieldValue !== null &&
      "value" in fieldValue
    ) {
      component.template![field].value = (fieldValue as { value: unknown }).value;
    } else {
      component.template![field].value = fieldValue as any;
    }
  });
};

const sanitizePosition = (
  position: BlueprintNodeInput["position"],
  index: number,
) => {
  if (
    position &&
    typeof position.x === "number" &&
    typeof position.y === "number"
  ) {
    return { x: position.x, y: position.y };
  }
  // Better spacing: 3 columns with 400px horizontal and 280px vertical spacing
  const column = index % 3;
  const row = Math.floor(index / 3);
  return { x: column * 400, y: row * 280 };
};

const parseHandleHint = (handle: unknown): HandleHint | null => {
  if (!handle) return null;
  if (typeof handle === "string") {
    const trimmed = handle.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        return parsed as HandleHint;
      }
    } catch {
      // best effort
    }
    return { name: trimmed, fieldName: trimmed };
  }
  if (typeof handle === "object") {
    return handle as HandleHint;
  }
  return null;
};

const selectSourceHandle = (
  component: APIClassType,
  preferredName?: string,
  preferredTypes?: string[],
) => {
  const outputs = component.outputs ?? [];
  const normalizedPreferred = normalizeKey(preferredName);
  let match: OutputFieldType | null =
    outputs.find(
      (output) =>
        normalizeKey(output.name) === normalizedPreferred ||
        normalizeKey(output.display_name) === normalizedPreferred,
    ) ?? null;
  if (!match && normalizedPreferred) {
    const preferred = outputs.find((output) =>
      normalizeKey(output.name).includes(normalizedPreferred),
    );
    if (preferred) {
      match = preferred;
    }
  }
  if (!match) {
    const fallback = outputs.find((output) =>
      DEFAULT_SOURCE_NAMES.includes(normalizeKey(output.name)),
    );
    if (fallback) {
      match = fallback;
    }
  }
  if (!match && outputs.length > 0) {
    match = outputs[0] ?? null;
  }

  const outputTypes =
    preferredTypes && preferredTypes.length
      ? preferredTypes
      : match?.types?.length
        ? match.types
        : component.output_types ??
          component.base_classes ??
          ["Message"];

  return {
    name: match?.name ?? match?.display_name ?? preferredName ?? "output",
    output_types: outputTypes,
  };
};

const selectTargetHandle = (
  component: APIClassType,
  preferredField?: string,
  preferredInputTypes?: string[],
  preferredType?: string,
) => {
  const template = component.template ?? {};
  const entries = Object.entries(template) as Array<[string, InputFieldType]>;
  const normalizedPreferred = normalizeKey(preferredField);
  let entry: [string, InputFieldType] | null =
    entries.find(
      ([key, field]) =>
        normalizeKey(key) === normalizedPreferred ||
        normalizeKey(field.display_name) === normalizedPreferred,
    ) ?? null;
  if (!entry) {
    const fallback = entries.find(([key]) =>
      DEFAULT_TARGET_FIELDS.includes(normalizeKey(key)),
    );
    if (fallback) {
      entry = fallback;
    }
  }
  if (!entry && entries.length) {
    entry = entries[0] ?? null;
  }
  if (entry) {
    const [fieldName, field] = entry;
    return {
      fieldName,
      type: preferredType ?? field?.type ?? "str",
      inputTypes:
        preferredInputTypes && preferredInputTypes.length
          ? preferredInputTypes
          : field?.input_types?.length
            ? field.input_types
            : ["Message"],
    };
  }
  return {
    fieldName: preferredField ?? "input_value",
    type: preferredType ?? "str",
    inputTypes:
      preferredInputTypes && preferredInputTypes.length
        ? preferredInputTypes
        : ["Message"],
  };
};

// Check if two types are compatible for connection
const areTypesCompatible = (
  sourceTypes: string[],
  targetTypes: string[],
): boolean => {
  if (!sourceTypes?.length || !targetTypes?.length) {
    return true; // If either is empty, assume compatible
  }
  // Check if there's any overlap between source and target types
  return sourceTypes.some((sourceType) =>
    targetTypes.some(
      (targetType) =>
        sourceType === targetType ||
        sourceType.toLowerCase() === targetType.toLowerCase() ||
        sourceType === "Message" ||
        targetType === "Message",
    ),
  );
};

const hydrateNodes = (
  blueprintNodes: BlueprintNodeInput[],
  templates: Record<string, APIClassType>,
) => {
  const warnings: string[] = [];
  const nodes: AllNodeType[] = [];
  const lookup = new Map<string, AllNodeType>();
  const blueprintNodeIdMap = new Map<string, string>(); // Maps blueprint IDs to generated IDs

  blueprintNodes.forEach((node, index) => {
    const resolved =
      resolveComponentDefinition(
        node.type ?? node.data?.type ?? node.name,
        templates,
      ) ?? resolveComponentDefinition(node.label, templates);
    if (!resolved) {
      warnings.push(
        `Skipped "${node.type ?? node.id ?? `node ${index + 1}`}" because the component is not available.`,
      );
      return;
    }
    const componentClone = cloneDeep(resolved.component);
    componentClone.edited = true;
    if (resolved.component.lf_version) {
      componentClone.lf_version = resolved.component.lf_version;
    }
    const overrides = collectOverrides(node);
    applyTemplateOverrides(componentClone, overrides);
    if (node.label || node.display_name || node.name) {
      componentClone.display_name =
        node.label || node.display_name || node.name || componentClone.display_name;
    }
    const generatedId = getNodeId(resolved.type);
    const nodeId = node.id ?? generatedId;
    const flowNode: AllNodeType = {
      id: nodeId,
      type: "genericNode",
      position: sanitizePosition(node.position, index),
      data: {
        id: nodeId,
        type: resolved.type,
        node: componentClone,
        showNode: componentClone.minimized ? false : true,
      },
    };
    nodes.push(flowNode);
    // Store mapping from blueprint node ID to generated node ID
    if (node.id) {
      blueprintNodeIdMap.set(node.id, nodeId);
    }
    lookup.set(nodeId, flowNode);
  });

  return { nodes, lookup, blueprintNodeIdMap, warnings };
};

const hydrateEdges = (
  blueprintEdges: BlueprintEdgeInput[] | undefined,
  lookup: Map<string, AllNodeType>,
  blueprintNodeIdMap: Map<string, string>, // Maps blueprint node IDs to generated node IDs
) => {
  const warnings: string[] = [];
  const edges: EdgeType[] = [];

  (blueprintEdges ?? []).forEach((edge, index) => {
    // Resolve the blueprint node IDs to actual generated node IDs
    const sourceNodeId = blueprintNodeIdMap.get(edge.source) ?? edge.source;
    const targetNodeId = blueprintNodeIdMap.get(edge.target) ?? edge.target;
    
    console.log(`[Edge ${index}] source: ${edge.source} -> ${sourceNodeId}, target: ${edge.target} -> ${targetNodeId}`);
    
    const sourceNode = lookup.get(sourceNodeId);
    const targetNode = lookup.get(targetNodeId);
    
    if (!sourceNode || !targetNode) {
      const missing = !sourceNode ? "source" : "target";
      console.warn(`[Edge ${index}] Missing ${missing} node. sourceNode: ${sourceNodeId}, targetNode: ${targetNodeId}`);
      warnings.push(
        `Skipped connection ${edge.source} → ${edge.target} because the ${missing} node was missing.`,
      );
      return;
    }
    
    // Prevent self-connections
    if (sourceNode.id === targetNode.id) {
      warnings.push(
        `Skipped connection: a node cannot connect to itself.`,
      );
      return;
    }
    
    const sourceHint = parseHandleHint(
      edge.sourceHandle ?? edge.data?.sourceHandle,
    );
    const targetHint = parseHandleHint(
      edge.targetHandle ?? edge.data?.targetHandle,
    );
    
    // Get the actual component definitions
    const sourceComponent = sourceNode.data.node;
    const targetComponent = targetNode.data.node;
    
    if (!sourceComponent || !targetComponent) {
      warnings.push(
        `Skipped connection ${edge.source} → ${edge.target} because node component definition is missing.`,
      );
      return;
    }
    
    const sourceHandleSelection = selectSourceHandle(
      sourceComponent,
      sourceHint?.name,
      sourceHint?.output_types,
    );
    const targetHandleSelection = selectTargetHandle(
      targetComponent,
      targetHint?.fieldName ?? targetHint?.name,
      targetHint?.inputTypes,
      targetHint?.type,
    );
    
    // Validate type compatibility
    if (!areTypesCompatible(
      sourceHandleSelection.output_types,
      targetHandleSelection.inputTypes,
    )) {
      warnings.push(
        `Type mismatch: ${sourceNode.data.type} output (${sourceHandleSelection.output_types.join(", ")}) is incompatible with ${targetNode.data.type} input (${targetHandleSelection.inputTypes.join(", ")}). Connection will be attempted anyway.`,
      );
    }
    
    const sourceHandle: sourceHandleType = {
      id: sourceNode.id,
      name: sourceHandleSelection.name,
      output_types: sourceHandleSelection.output_types,
      dataType: sourceNode.data.type,
    };
    const targetHandle: targetHandleType = {
      id: targetNode.id,
      fieldName: targetHandleSelection.fieldName,
      type: targetHandleSelection.type,
      inputTypes: targetHandleSelection.inputTypes,
    };
    
    const edgeId = `reactflow__edge-${sourceNode.id}${scapedJSONStringfy(sourceHandle)}-${targetNode.id}${scapedJSONStringfy(targetHandle)}`;
    
    const edgeObj: EdgeType = {
      id: edge.id ?? edgeId,
      source: sourceNode.id,
      target: targetNode.id,
      type: "default",
      data: {
        sourceHandle,
        targetHandle,
      },
      sourceHandle: scapedJSONStringfy(sourceHandle),
      targetHandle: scapedJSONStringfy(targetHandle),
    };
    
    console.log(`[Edge ${index}] Created successfully:`, edgeObj);
    edges.push(edgeObj);
  });

  console.log(`[hydrateEdges] Total edges created: ${edges.length} out of ${blueprintEdges?.length ?? 0}`);
  return { edges, warnings };
};

const buildPlanFromJson = (
  blueprint: BlueprintGraph,
  templates: Record<string, APIClassType>,
): { plan?: BlueprintPlan; error?: string } => {
  if (!blueprint || !Array.isArray(blueprint.nodes) || blueprint.nodes.length === 0) {
    return { error: "The assistant response did not include any nodes to build." };
  }
  if (!templates || Object.keys(templates).length === 0) {
    return {
      error:
        "Component definitions are still loading. Please open the Flow editor once and try again.",
    };
  }
  const { nodes, lookup, blueprintNodeIdMap, warnings: nodeWarnings } = hydrateNodes(
    blueprint.nodes,
    templates,
  );
  if (nodes.length === 0) {
    return {
      error:
        "None of the suggested components are available in this workspace.",
    };
  }
  
  // Use provided edges or generate/fill them automatically if incomplete
  let edgesInput = blueprint.edges;
  const originalEdgeCount = edgesInput?.length ?? 0;
  
  if (!edgesInput || edgesInput.length === 0) {
    // Auto-generate edges based on sequential node order
    edgesInput = [];
    for (let i = 0; i < blueprint.nodes.length - 1; i++) {
      const sourceNode = blueprint.nodes[i];
      const targetNode = blueprint.nodes[i + 1];
      edgesInput.push({
        source: sourceNode.id || `node-${i}`,
        target: targetNode.id || `node-${i + 1}`,
      });
    }
    console.log(`[buildPlanFromJson] Auto-generated ${edgesInput.length} edges (original: ${originalEdgeCount})`);
  } else if (edgesInput.length < blueprint.nodes.length - 1) {
    // If edges are incomplete, fill in missing sequential connections
    console.log(`[buildPlanFromJson] Incomplete edges detected. Found ${edgesInput.length}, expected at least ${blueprint.nodes.length - 1}`);
    const connectedNodePairs = new Set<string>();
    edgesInput.forEach(edge => {
      connectedNodePairs.add(`${edge.source}-${edge.target}`);
    });
    
    for (let i = 0; i < blueprint.nodes.length - 1; i++) {
      const sourceNode = blueprint.nodes[i];
      const targetNode = blueprint.nodes[i + 1];
      const sourceId = sourceNode.id || `node-${i}`;
      const targetId = targetNode.id || `node-${i + 1}`;
      const pairKey = `${sourceId}-${targetId}`;
      
      if (!connectedNodePairs.has(pairKey)) {
        console.log(`[buildPlanFromJson] Adding missing edge: ${sourceId} -> ${targetId}`);
        edgesInput.push({
          source: sourceId,
          target: targetId,
        });
      }
    }
  }
  const { edges, warnings: edgeWarnings } = hydrateEdges(
    edgesInput,
    lookup,
    blueprintNodeIdMap,
  );
  const plan: BlueprintPlan = {
    name: blueprint.name,
    description: blueprint.description,
    summary: `Blueprint ready: ${nodes.length} ${pluralize(
      "component",
      nodes.length,
    )} and ${edges.length} ${pluralize("connection", edges.length)} mapped to Langflow.`,
    warnings: [...nodeWarnings, ...edgeWarnings],
    flowData: {
      nodes,
      edges,
      viewport: {
        x: blueprint.viewport?.x ?? 0,
        y: blueprint.viewport?.y ?? 0,
        zoom: blueprint.viewport?.zoom ?? 1,
      },
    },
  };
  return { plan };
};

const extractBlueprintJson = (text: string) => {
  if (!text) return null;
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/i;
  const fenceMatch = text.match(fenceRegex);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1]);
      return {
        json: parsed as BlueprintGraph,
        cleanedText: text.replace(fenceMatch[0], "").trim(),
      };
    } catch {
      // ignore and try fallback
    }
  }
  const curlyRegex = /\{[\s\S]*"nodes"[\s\S]*\}/;
  const curlyMatch = text.match(curlyRegex);
  if (curlyMatch) {
    try {
      const parsed = JSON.parse(curlyMatch[0]);
      return {
        json: parsed as BlueprintGraph,
        cleanedText: text.replace(curlyMatch[0], "").trim(),
      };
    } catch {
      return null;
    }
  }
  return null;
};

// Add new function to extract simplified AI workflow
const extractSimplifiedAIWorkflow = (text: string): AISuggestedWorkflow | null => {
  // Look for the "🔧 Building workflow..." indicator
  if (!text.includes("🔧 Building workflow...") && !text.includes('"components"') && !text.includes('"connections"')) {
    return null;
  }
  
  // Remove the "🔧 Building workflow..." line if present
  const cleanText = text.replace("🔧 Building workflow...", "").trim();
  
  // Look for JSON code blocks
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/i;
  const fenceMatch = cleanText.match(fenceRegex);
  
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1]);
      
      // Check if this looks like our simplified workflow format
      if (parsed.components && Array.isArray(parsed.components)) {
        return parsed as AISuggestedWorkflow;
      }
    } catch {
      // ignore and try fallback
    }
  }
  
  // Also check for inline JSON that looks like our format
  // More permissive regex for our workflow structure
  const workflowRegex = /\{[^{]*(?:"name"[^}]*"components"[^}]*"connections"|"components"[^}]*"connections")[^}]*\}/;
  const workflowMatch = cleanText.match(workflowRegex);
  
  if (workflowMatch) {
    try {
      const parsed = JSON.parse(workflowMatch[0]);
      if (parsed.components && Array.isArray(parsed.components)) {
        return parsed as AISuggestedWorkflow;
      }
    } catch {
      // ignore
    }
  }
  
  // Direct check for workflow-like JSON at the beginning of the text
  try {
    const trimmedText = cleanText.trim();
    if (trimmedText.startsWith('{')) {
      // Try to extract a JSON object from the beginning of the text
      let bracketCount = 0;
      let endIndex = -1;
      
      for (let i = 0; i < trimmedText.length; i++) {
        if (trimmedText[i] === '{') {
          bracketCount++;
        } else if (trimmedText[i] === '}') {
          bracketCount--;
          if (bracketCount === 0) {
            endIndex = i + 1;
            break;
          }
        }
      }
      
      if (endIndex > 0) {
        const jsonString = trimmedText.substring(0, endIndex);
        const parsed = JSON.parse(jsonString);
        if (parsed.components && Array.isArray(parsed.components)) {
          return parsed as AISuggestedWorkflow;
        }
      }
    }
  } catch {
    // ignore
  }
  
  return null;
};

const processAssistantText = (
  rawText: string,
  templates: Record<string, APIClassType>,
): BlueprintProcessingResult => {
  // First try to extract simplified AI workflow
  const simplifiedWorkflow = extractSimplifiedAIWorkflow(rawText);
  if (simplifiedWorkflow) {
    // For now, we'll just return the text as-is and indicate we found a workflow
    // In a future enhancement, we could process this through our backend endpoint
    return { 
      finalText: rawText,
      shouldClearPlan: true 
    };
  }
  
  // Fall back to existing blueprint processing
  const extraction = extractBlueprintJson(rawText);
  if (!extraction) {
    return { finalText: rawText };
  }
  const { plan, error } = buildPlanFromJson(extraction.json, templates);
  if (plan) {
    const warningText = plan.warnings.length
      ? `Warnings: ${plan.warnings.join(" ")}`
      : "";
    // Only show the cleaned text (text before JSON) and the summary, skip the warnings
    const finalText = extraction.cleanedText
      ? [extraction.cleanedText, plan.summary].filter(Boolean).join("\n\n")
      : plan.summary;
    return {
      finalText: finalText || plan.summary,
      plan,
      shouldClearPlan: true,
    };
  }
  const fallback = [
    extraction.cleanedText,
    error ?? "Unable to process the assistant blueprint.",
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    finalText: fallback || "Unable to process the assistant blueprint.",
    shouldClearPlan: true,
  };
};

// Add new function to process simplified workflow through backend
const processSimplifiedWorkflow = async (
  workflow: AISuggestedWorkflow,
  signal?: AbortSignal
): Promise<BlueprintPlan | null> => {
  try {
    console.log('Processing simplified workflow:', workflow);
    
    // Get the access token for authentication
    const accessToken = customGetAccessToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add authorization header if available
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    const response = await fetch('/api/v1/ai_workflows/process', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        workflow_data: workflow
      }),
      signal
    });

    console.log('Backend response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const result = await response.json();
    console.log('Backend response data:', result);
    
    if (result.success && result.flow_data) {
      return {
        name: result.flow_data.name,
        description: result.flow_data.description,
        summary: `Workflow processed: ${result.flow_data.name}`,
        warnings: [],
        flowData: result.flow_data.data
      };
    } else {
      console.error('Failed to process workflow:', result.error);
      return null;
    }
  } catch (error) {
    console.error('Error processing simplified workflow:', error);
    return null;
  }
};

const initialMessages: ChatMessage[] = [
  {
    role: "assistant",
    content: `Hi! I'm the ${BRAND_NAME} assistant. Tell me what you want to build and I'll outline the workflow for you.`,
  },
];

export const ChatAssistant = ({ variant = "page", onClose }: ChatAssistantProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blueprintPlan, setBlueprintPlan] = useState<BlueprintPlan | null>(null);
  const [isCreatingFlow, setIsCreatingFlow] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  useGetTypes({ checkCache: true });
  const templates = useTypesStore((state) => state.templates);
  const addFlow = useAddFlow();
  const navigate = useCustomNavigate();
  const { streamWorkflow } = useStreamWorkflow();

  const isConfigReady = useMemo(
    () =>
      Boolean(
        ASSISTANT_CONFIG.baseUrl &&
          ASSISTANT_CONFIG.flowId &&
          ASSISTANT_CONFIG.apiKey,
      ),
    [],
  );

  const containerClasses = cn(
    "flex w-full flex-1 flex-col",
    variant === "page"
      ? "min-h-screen bg-muted/40"
      : "min-h-[60vh] bg-background",
  );
  const contentWidthClass =
    variant === "page" ? "max-w-5xl" : "max-w-3xl lg:max-w-4xl";
  const horizontalPadding = variant === "page" ? "px-4" : "px-6";
  const mainClasses = cn(
    "mx-auto flex w-full flex-1 flex-col gap-4 py-6",
    horizontalPadding,
    contentWidthClass,
    variant === "dialog" && "min-h-0",
  );
  const chatSectionClasses = cn(
    "flex-1 overflow-hidden rounded-md border bg-background shadow-sm m-4",
    variant === "dialog" && "min-h-0",
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleCreateFlow = async () => {
    if (!blueprintPlan) return;
    setIsCreatingFlow(true);
    setCreateError(null);
    
    try {
      // Apply automatic layout to nodes for proper spacing
      let layoutedNodes = blueprintPlan.flowData.nodes;
      if (layoutedNodes && layoutedNodes.length > 0 && blueprintPlan.flowData.edges) {
        try {
          layoutedNodes = await getLayoutedNodes(
            blueprintPlan.flowData.nodes,
            blueprintPlan.flowData.edges
          );
        } catch (error) {
          console.warn("Layout failed, using fallback positioning:", error);
          // Fallback: simple grid layout if ELK fails
          layoutedNodes = blueprintPlan.flowData.nodes.map((node, index) => {
            const column = index % 3;
            const row = Math.floor(index / 3);
            return {
              ...node,
              position: { x: column * 400, y: row * 280 }
            };
          });
        }
      }
      
      const flow: FlowType = {
        id: "",
        name: blueprintPlan.name?.trim() || "AI Generated Flow",
        description:
          blueprintPlan.description?.trim() ||
          "Generated via the Flow Architect assistant",
        data: {
          ...blueprintPlan.flowData,
          nodes: layoutedNodes, // Use layouted nodes with proper spacing
        },
      };
      
      // Create the flow
      const createdId = await addFlow({ flow });
      
      if (createdId) {
        // Close dialog if in dialog mode
        if (variant === "dialog" && onClose) {
          onClose();
        }
        
        // Navigate to flow editor immediately
        navigate(`/flow/${createdId}`);
        
        // Small delay to let the page render, then start streaming animation
        setTimeout(async () => {
          if (layoutedNodes && blueprintPlan.flowData.edges) {
            await streamWorkflow(
              layoutedNodes,
              blueprintPlan.flowData.edges,
              {
                delay: 250,
                animateNodes: true,
                animateEdges: true,
              }
            );
          }
        }, 300); // Wait for page to load before streaming
      }
      
      setBlueprintPlan(null);
      setIsCreatingFlow(false);
    } catch (err) {
      setIsCreatingFlow(false);
      const message =
        err instanceof Error
          ? err.message
          : "Unable to create the flow. Please try again.";
      setCreateError(message);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isSending) return;

    if (!isConfigReady) {
      setError(
        "Assistant is not configured. Set VITE_ASSISTANT_BASE_URL, VITE_ASSISTANT_FLOW_ID, and VITE_ASSISTANT_API_KEY to continue.",
      );
      return;
    }

    const userMessage: ChatMessage = { role: "user", content: inputValue };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsSending(true);
    setError(null);
    try {
      const response = await fetch(
        `${ASSISTANT_CONFIG.baseUrl}/api/v1/run/${ASSISTANT_CONFIG.flowId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ASSISTANT_CONFIG.apiKey,
          },
          body: JSON.stringify({
            input_value: userMessage.content,
            input_type: "chat",
            output_type: "chat",
            session_id: ASSISTANT_CONFIG.sessionId,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(
          `Server responded with ${response.status} ${response.statusText}`,
        );
      }
      const data = await response.json();
      const outputText =
        data?.outputs?.[0]?.outputs?.[0]?.results?.message?.text ??
        "I wasn't able to find details for that, but I'm ready to try again.";
    
    // First check if this is a simplified AI workflow
    const simplifiedWorkflow = extractSimplifiedAIWorkflow(outputText);
    if (simplifiedWorkflow) {
      // Process through our new backend endpoint
      const processedPlan = await processSimplifiedWorkflow(simplifiedWorkflow);
      if (processedPlan) {
        setBlueprintPlan(processedPlan);
        setCreateError(null);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `I've created a workflow plan for you. Would you like to create this flow?\n\n**${processedPlan.name}**\n${processedPlan.description}`,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I tried to create a workflow but encountered an error. Let me try a different approach.\n\n" + outputText,
          },
        ]);
      }
    } else {
      // Fall back to existing processing
      const processed = processAssistantText(outputText, templates);
      if (processed.plan) {
        setBlueprintPlan(processed.plan);
        setCreateError(null);
      } else if (processed.shouldClearPlan) {
        setBlueprintPlan(null);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            processed.finalText ||
            "I wasn't able to find details for that, but I'm ready to try again.",
        },
      ]);
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error occurred";
    setError(message);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          "Something went wrong while contacting the assistant. Please try again.",
      },
    ]);
  } finally {
    setIsSending(false);
  }
};

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={containerClasses}>
      <header className="border-b bg-blue-50 dark:bg-blue-950/20 backdrop-blur">
        <div
          className={cn(
            "mx-auto flex w-full items-center justify-between gap-4 py-5",
            horizontalPadding,
            contentWidthClass,
          )}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              {BRAND_NAME}
            </p>
            <h1 className="text-2xl font-semibold text-blue-900 dark:text-blue-100">
              Flow Architect
            </h1>
            <p className="text-sm text-blue-700 dark:text-blue-300">{BRAND_TAGLINE}</p>
          </div>
          <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
            <ForwardedIconComponent name="Sparkles" className="h-6 w-6" />
          </div>
        </div>
      </header>

      <main className={cn(mainClasses, "gap-3")}>
        <div className="flex flex-col rounded-md border border-border bg-background shadow-sm overflow-hidden h-[600px]">
          <section className="flex-1 overflow-y-auto border-b border-border">
            <div className="h-full overflow-y-auto p-4 sm:p-6">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={cn(
                      "flex",
                      message.role === "user"
                        ? "justify-end"
                        : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-full rounded-md px-4 py-3 text-sm leading-relaxed shadow-sm sm:max-w-[80%]",
                        message.role === "user"
                          ? "bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                          : "bg-blue-100 dark:bg-blue-900/30 text-foreground hover:bg-blue-150 dark:hover:bg-blue-900/40 transition-colors",
                      )}
                    >
                      {message.role === "assistant" ? (
                        <Markdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeMathjax]}
                          className="prose max-w-full text-sm dark:prose-invert"
                          linkTarget="_blank"
                          components={{
                            p({ node, ...props }) {
                              return <span className="block mb-2">{props.children}</span>;
                            },
                            h1({ node, ...props }) {
                              return <h1 className="text-lg font-bold mb-2 mt-3 text-blue-900 dark:text-blue-100">{props.children}</h1>;
                            },
                            h2({ node, ...props }) {
                              return <h2 className="text-base font-bold mb-2 mt-3 text-blue-900 dark:text-blue-100">{props.children}</h2>;
                            },
                            h3({ node, ...props }) {
                              return <h3 className="text-sm font-bold mb-2 mt-2 text-blue-900 dark:text-blue-100">{props.children}</h3>;
                            },
                            ul({ node, ...props }) {
                              return <ul className="list-disc list-inside mb-2 ml-2">{props.children}</ul>;
                            },
                            ol({ node, ...props }) {
                              return <ol className="list-decimal list-inside mb-2 ml-2">{props.children}</ol>;
                            },
                            li({ node, ...props }) {
                              return <li className="mb-1">{props.children}</li>;
                            },
                            code({ node, inline, ...props }) {
                              return inline ? (
                                <code className="bg-blue-200/50 dark:bg-blue-900/50 rounded px-1 py-0.5 font-mono text-xs text-blue-900 dark:text-blue-100" {...props} />
                              ) : (
                                <pre className="bg-blue-200/30 dark:bg-blue-900/30 rounded p-3 overflow-x-auto mb-2 border border-blue-300 dark:border-blue-700" {...props} />
                              );
                            },
                            blockquote({ node, ...props }) {
                              return (
                                <blockquote className="border-l-4 border-blue-500 pl-3 italic mb-2 text-blue-800 dark:text-blue-200" {...props} />
                              );
                            },
                            a({ node, ...props }) {
                              return <a className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline" {...props} />;
                            },
                            strong({ node, ...props }) {
                              return <strong className="font-semibold text-blue-900 dark:text-blue-100" {...props} />;
                            },
                            em({ node, ...props }) {
                              return <em className="italic text-blue-800 dark:text-blue-200" {...props} />;
                            },
                          }}
                        >
                          {message.content}
                        </Markdown>
                      ) : (
                        <div className="whitespace-pre-wrap break-words">
                          {message.content}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking...
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </div>
          </section>

          <div className="border-t border-border p-4 sm:p-5">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <textarea
                className="h-10 flex-1 resize-none rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                placeholder="Describe the workflow or agent you want to build..."
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button
                onClick={sendMessage}
                disabled={isSending || !inputValue.trim()}
                className="shrink-0 gap-2 px-4 py-2 h-10 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                variant="default"
                size="sm"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <ForwardedIconComponent name="Send" className="h-4 w-4" />
                    <span className="hidden sm:inline">Send</span>
                  </>
                )}
              </Button>
            </div>
            {!isConfigReady && (
              <p className="mt-3 text-xs text-muted-foreground">
                Set `VITE_ASSISTANT_BASE_URL`, `VITE_ASSISTANT_FLOW_ID`, and
                `VITE_ASSISTANT_API_KEY` to enable the assistant.
              </p>
            )}
          </div>
        </div>

        {blueprintPlan && (
          <div className="rounded-md border border-border bg-blue-50 dark:bg-blue-900/10 px-4 py-4 text-sm text-foreground shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0 rounded-md bg-blue-200/50 dark:bg-blue-800/50 p-2">
                  <ForwardedIconComponent name="CheckCircle" className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-blue-900 dark:text-blue-100">Blueprint ready</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    {blueprintPlan.summary}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleCreateFlow}
                disabled={isCreatingFlow}
                className="self-start sm:self-auto shrink-0 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                variant="default"
              >
                {isCreatingFlow ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Creating...</span>
                  </>
                ) : (
                  <>
                    <ForwardedIconComponent name="Plus" className="h-4 w-4" />
                    <span className="hidden sm:inline">Create Flow</span>
                  </>
                )}
              </Button>
            </div>
            {blueprintPlan.warnings.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 border-t border-border pl-6 pt-3 text-xs text-blue-700 dark:text-blue-300">
                {blueprintPlan.warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            )}
            {createError && (
              <p className="mt-3 border-t border-border pt-3 text-xs text-red-600 dark:text-red-400">{createError}</p>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-border bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            <div className="flex items-start gap-3">
              <ForwardedIconComponent name="AlertCircle" className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default ChatAssistant;

