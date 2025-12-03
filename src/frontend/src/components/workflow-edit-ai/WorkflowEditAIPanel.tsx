/**
 * Side panel for editing workflows using AI
 * Slides in from the right side, allowing users to see the workflow while editing
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import type { FlowType } from "@/types/flow";
import {
  convertFlowToSimplified,
  type SimplifiedWorkflow,
} from "@/utils/aiWorkflowConverter";
import { useEditFlowWithAI } from "@/hooks/flows/use-edit-flow-with-ai";
import { cn } from "@/utils/utils";

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

type WorkflowEditAIPanelProps = {
  open: boolean;
  onClose: () => void;
  flowData: FlowType;
  onSuccess?: () => void;
};

export function WorkflowEditAIPanel({
  open,
  onClose,
  flowData,
  onSuccess,
}: WorkflowEditAIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const simplifiedWorkflowRef = useRef<SimplifiedWorkflow | null>(null);

  const { editFlowWithAI, isLoading } = useEditFlowWithAI();

  // Initialize with workflow context
  useEffect(() => {
    if (open && flowData) {
      try {
        const simplified = convertFlowToSimplified(flowData);
        simplifiedWorkflowRef.current = simplified;

        const componentList = simplified.components
          .map((c) => `- ${c.type} (${c.id})`)
          .join("\n");

        setMessages([
          {
            role: "system",
            content: `I'll help you edit "${flowData.name}". What would you like to change?`,
          },
          {
            role: "assistant",
            content: `Current workflow structure:

**Components:** ${simplified.components.length}
${componentList}

**Connections:** ${simplified.connections.length}

Tell me what you'd like to modify!`,
          },
        ]);
      } catch (error) {
        console.error("Failed to convert workflow:", error);
        setMessages([
          {
            role: "system",
            content: "Error loading workflow. Please try again.",
          },
        ]);
      }
    } else if (!open) {
      // Clear messages when panel closes
      setMessages([]);
      setInputValue("");
    }
  }, [open, flowData]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const userMessage = inputValue.trim();
    setInputValue("");

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsProcessing(true);

    try {
      // TODO: Call AI endpoint to process the request and get modified workflow
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Processing your request...",
        },
      ]);

      // Simulate AI response for now
      setTimeout(() => {
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            role: "assistant",
            content: `I understand you want to: "${userMessage}"

To implement this change, I'll need to modify the workflow. This feature is currently being integrated with the AI backend.

Once connected, I'll be able to:
- Add/remove components
- Modify connections
- Update parameters
- Reorganize the workflow`,
          };
          return newMessages;
        });
        setIsProcessing(false);
      }, 1000);

      // TODO: Implement actual AI workflow modification
      // const response = await editFlowWithAI(flowData.id, modifiedWorkflow);
      // if (response.success) {
      //   onSuccess?.();
      // }
    } catch (error) {
      console.error("Error processing message:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I encountered an error processing your request. Please try again.",
        },
      ]);
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Side Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-[400px] bg-background border-l shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Edit with AI</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Workflow Info */}
        <div className="px-4 py-3 bg-muted/50 border-b">
          <p className="text-sm text-muted-foreground">Editing:</p>
          <p className="text-sm font-medium truncate">{flowData?.name}</p>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role !== "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <ForwardedIconComponent
                      name="Bot"
                      className="h-4 w-4 text-primary"
                    />
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 max-w-[85%]",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : message.role === "system"
                        ? "bg-muted text-muted-foreground italic text-sm"
                        : "bg-muted"
                  )}
                >
                  <div className="whitespace-pre-wrap text-sm">
                    {message.content}
                  </div>
                </div>
                {message.role === "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <ForwardedIconComponent
                      name="User"
                      className="h-4 w-4"
                    />
                  </div>
                )}
              </div>
            ))}
            {isProcessing && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 border-t bg-background">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe the changes you want..."
              disabled={isProcessing}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isProcessing}
              size="icon"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
}
