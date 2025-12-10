/**
 * Demo component for streaming workflow visualization
 * Tests the progressive rendering feature with the Invoice Report Generator workflow
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useStreamWorkflow } from "@/hooks/useStreamWorkflow";
import InvoiceWorkflowData from "@/constants/Invoice Report Generator (1).json";
import ForwardedIconComponent from "@/components/common/genericIconComponent";

export const StreamingWorkflowDemo = () => {
  const { streamWorkflow } = useStreamWorkflow();
  const [isStreaming, setIsStreaming] = useState(false);

  const handleStreamWorkflow = async () => {
    if (isStreaming) return;

    setIsStreaming(true);

    try {
      const nodes = InvoiceWorkflowData.data?.nodes || [];
      const edges = InvoiceWorkflowData.data?.edges || [];

      await streamWorkflow(nodes as any, edges as any, {
        delay: 250, // 250ms between each node/edge
        animateNodes: true,
        animateEdges: true,
      });
    } catch (error) {
      console.error("Error streaming workflow:", error);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        onClick={handleStreamWorkflow}
        disabled={isStreaming}
        size="lg"
        className="shadow-lg hover:shadow-xl transition-shadow"
      >
        {isStreaming ? (
          <>
            <ForwardedIconComponent
              name="Loader2"
              className="mr-2 h-5 w-5 animate-spin"
            />
            Streaming...
          </>
        ) : (
          <>
            <ForwardedIconComponent
              name="Play"
              className="mr-2 h-5 w-5"
            />
            Test Streaming Workflow
          </>
        )}
      </Button>
    </div>
  );
};
