/**
 * Dialog for editing workflows using AI
 * Styled to match ChatAssistant but focused on editing existing workflows
 */

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { BRAND_NAME } from "@/constants/branding";
import useFlowsManagerStore from "@/stores/flowsManagerStore";
import type { FlowType } from "@/types/flow";
import {
  convertFlowToSimplified,
  type SimplifiedWorkflow,
} from "@/utils/aiWorkflowConverter";
import { cn } from "@/utils/utils";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type WorkflowEditAIDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowData: FlowType;
  onSuccess?: () => void;
};

const initialMessages = (workflowName: string): Message[] => [
  {
    role: "assistant",
    content: `Hi! I'm the ${BRAND_NAME} assistant. I'll help you edit "${workflowName}". Tell me what changes you'd like to make.`,
  },
];

export function WorkflowEditAIDialog({
  open,
  onOpenChange,
  flowData,
  onSuccess,
}: WorkflowEditAIDialogProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const simplifiedWorkflowRef = useRef<SimplifiedWorkflow | null>(null);

  const setCurrentFlow = useFlowsManagerStore((state) => state.setCurrentFlow);

  // Initialize messages when dialog opens (only if messages are empty)
  useEffect(() => {
    if (open && flowData && messages.length === 0) {
      setMessages(initialMessages(flowData.name || "workflow"));
      
      // Debug: Log the flowData structure
      console.log("FlowData received:", {
        hasData: !!flowData.data,
        hasNodes: !!flowData.data?.nodes,
        hasEdges: !!flowData.data?.edges,
        nodesCount: flowData.data?.nodes?.length || 0,
        edgesCount: flowData.data?.edges?.length || 0,
        fullData: flowData
      });
      
      try {
        // Validate flowData structure before conversion
        if (!flowData.data) {
          throw new Error("Workflow has no data property. The workflow may not be fully loaded yet. Please try closing and reopening this dialog.");
        }
        
        if (!flowData.data.nodes || !Array.isArray(flowData.data.nodes)) {
          throw new Error("Workflow has no nodes. Please add at least one component to your workflow before editing.");
        }
        
        if (flowData.data.nodes.length === 0) {
          throw new Error("Workflow is empty. Please add at least one component to your workflow before editing.");
        }
        
        const simplified = convertFlowToSimplified(flowData);
        simplifiedWorkflowRef.current = simplified;
        console.log("Workflow converted successfully:", simplified);
      } catch (err) {
        console.error("Failed to convert workflow:", err);
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(`Failed to load workflow: ${errorMessage}`);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `❌ Error: Unable to load workflow data. ${errorMessage}\n\nPlease ensure the workflow has valid nodes and edges.`,
          },
        ]);
      }
    }
  }, [open, flowData]);

  // Auto-scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isSending) return;

    const userMessage: Message = { role: "user", content: inputValue };
    setMessages((prev) => [...prev, userMessage]);
    const editInstruction = inputValue.trim();
    setInputValue("");
    setIsSending(true);
    setError(null);

    try {
      // Step 1: Get the current workflow as simplified JSON
      const simplified = simplifiedWorkflowRef.current;
      if (!simplified) {
        throw new Error("Workflow data not available. The workflow may not have been loaded correctly. Please close and reopen the dialog.");
      }

      // Validate the simplified workflow has required components
      if (!simplified.components || simplified.components.length === 0) {
        throw new Error("Workflow must have at least one component to edit.");
      }

      // Step 2: Prepare prompt with simplified JSON + edit instruction
      const workflowJsonString = JSON.stringify(simplified, null, 2);
      const promptForAI = `You are a workflow editor. You will receive a workflow JSON and an edit instruction.

Current workflow:
${workflowJsonString}

Edit instruction: ${editInstruction}

IMPORTANT: Return ONLY the modified JSON workflow. Do not include any explanations, comments, or conversational text. Return ONLY valid JSON in this exact format:
{
  "name": "...",
  "description": "...",
  "components": [...],
  "connections": [...]
}

Modified workflow JSON:`;

      // Step 3: Call AI agent (same one used for "Create using AI")
      const ASSISTANT_CONFIG = {
        baseUrl: "http://localhost:7860",
        flowId: "0c94b0ea-c8f0-446e-8eb0-e59cf610996f",
        apiKey: "sk-QC5TWVcsKu8XkuXCliyL0uKx_XW_tpILkkYhyLJTLmA",
      };

      const response = await fetch(
        `${ASSISTANT_CONFIG.baseUrl}/api/v1/run/${ASSISTANT_CONFIG.flowId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ASSISTANT_CONFIG.apiKey,
          },
          body: JSON.stringify({
            input_value: promptForAI,
            output_type: "chat",
            input_type: "chat",
            tweaks: {},
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`AI agent returned error: ${response.statusText}`);
      }

      const aiResponse = await response.json();
      const aiOutputText = aiResponse.outputs?.[0]?.outputs?.[0]?.results?.message?.text || "";

      // Parse the AI response to extract modified simplified JSON
      let modifiedSimplifiedJson;
      
      // Try multiple extraction strategies
      try {
        // Strategy 1: Look for JSON in code blocks
        const jsonBlockMatch = aiOutputText.match(/```json\s*([\s\S]*?)```/) || 
                               aiOutputText.match(/```\s*([\s\S]*?)```/);
        
        let jsonString = "";
        
        if (jsonBlockMatch) {
          jsonString = jsonBlockMatch[1].trim();
        } else {
          // Strategy 2: Look for JSON object pattern (starts with { ends with })
          const jsonObjectMatch = aiOutputText.match(/\{[\s\S]*\}/);
          
          if (jsonObjectMatch) {
            jsonString = jsonObjectMatch[0];
          } else {
            // Strategy 3: Try parsing the entire output
            jsonString = aiOutputText.trim();
          }
        }
        
        // Clean up escaped characters
        jsonString = jsonString.replace(/\\\\n/g, '\\n');
        jsonString = jsonString.replace(/\\\\"/g, '\\"');
        
        modifiedSimplifiedJson = JSON.parse(jsonString);
      } catch (parseError) {
        console.error("Failed to parse AI response:", aiOutputText);
        console.error("Parse error:", parseError);
        throw new Error(`AI returned invalid JSON. Please try rephrasing your request or make smaller edits.`);
      }

      // Step 4: Send modified simplified JSON to process endpoint (same as create logic)
      const processResponse = await fetch('/api/v1/ai_workflows/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflow_data: modifiedSimplifiedJson
        }),
      });

      if (!processResponse.ok) {
        throw new Error(`Process endpoint error: ${processResponse.statusText}`);
      }

      const processResult = await processResponse.json();
      
      if (!processResult.success || !processResult.flow_data) {
        throw new Error(processResult.error || "Failed to process workflow");
      }

      // Step 5: Update the current flow in the UI (same as Create does)
      // The canvas will display the modified workflow and auto-save
      const updatedFlowData = {
        ...flowData,
        name: processResult.flow_data.name,
        description: processResult.flow_data.description,
        data: processResult.flow_data.data,
      };
      
      // Update the flow in the store - this will trigger canvas update and auto-save
      setCurrentFlow(updatedFlowData);
      
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `✅ Successfully updated your workflow! The changes are now visible in the canvas.`,
        },
      ]);
      
      // Close dialog after short delay
      setTimeout(() => {
        onSuccess?.();
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error occurred";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ Error: ${message}\n\nPlease try rephrasing your request.`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Match ChatAssistant's styling exactly
  const containerClasses = cn(
    "flex w-full flex-1 flex-col",
    "min-h-[60vh] bg-background"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideTitle
        className="flex h-[85vh] w-[92vw] max-w-5xl flex-col overflow-hidden bg-transparent p-0"
        closeButtonClassName="text-muted-foreground hover:text-foreground"
      >
        <div className={containerClasses}>
          {/* Header - Match ChatAssistant */}
          <header className="border-b border-border bg-background px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <ForwardedIconComponent
                  name="Sparkles"
                  className="h-6 w-6 text-primary"
                />
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                  Edit Workflow using AI
                </h1>
                <p className="text-sm text-muted-foreground">
                  {flowData?.name}
                </p>
              </div>
            </div>
          </header>

          {/* Messages Section - Match ChatAssistant */}
          <section className="flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-1 flex-col overflow-y-auto">
              <div className="flex flex-col gap-4 p-4 sm:p-5">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex gap-3",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <ForwardedIconComponent
                          name="Bot"
                          className="h-4 w-4 text-primary"
                        />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-lg px-4 py-2.5 text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground max-w-[75%]"
                          : "bg-muted text-foreground max-w-[85%]"
                      )}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary">
                        <ForwardedIconComponent
                          name="User"
                          className="h-4 w-4"
                        />
                      </div>
                    )}
                  </div>
                ))}
                {isSending && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    </div>
                    <div className="rounded-lg bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                      Thinking...
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </div>
          </section>

          {/* Input Section - Match ChatAssistant */}
          <div className="border-t border-border p-4 sm:p-5">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <textarea
                className="h-10 flex-1 resize-none rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                placeholder="Describe the changes you want to make..."
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
                  <ForwardedIconComponent name="Send" className="h-4 w-4" />
                )}
                Send
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
