/**
 * Hook for editing flows using AI
 * Handles the complete edit workflow: convert → process → update
 */

import { useState } from "react";
import { customGetAccessToken } from "@/customization/utils/custom-get-access-token";
import { usePatchUpdateFlow } from "@/controllers/API/queries/flows/use-patch-update-flow";
import useAlertStore from "@/stores/alertStore";
import useFlowsManagerStore from "@/stores/flowsManagerStore";
import type { FlowType } from "@/types/flow";
import type { SimplifiedWorkflow } from "@/utils/aiWorkflowConverter";

type EditFlowResult = {
  success: boolean;
  flow_data?: any;
  message?: string;
  error?: string;
};

export function useEditFlowWithAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const setSuccessData = useAlertStore((state) => state.setSuccessData);
  const setErrorData = useAlertStore((state) => state.setErrorData);
  const { mutate: patchUpdateFlow } = usePatchUpdateFlow();
  const setCurrentFlow = useFlowsManagerStore((state) => state.setCurrentFlow);

  /**
   * Send simplified workflow to AI for editing
   */
  const editFlowWithAI = async (
    flowId: string,
    simplifiedWorkflow: SimplifiedWorkflow,
  ): Promise<EditFlowResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const accessToken = customGetAccessToken();
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      // Send to our new dedicated edit endpoint
      const response = await fetch(`/api/v1/ai_workflows/edit/${flowId}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          workflow_data: simplifiedWorkflow,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const result: EditFlowResult = await response.json();

      if (result.success && result.flow_data) {
        // Update the flow via API and store
        patchUpdateFlow(
          {
            id: flowId,
            ...result.flow_data,
          },
          {
            onSuccess: (updatedFlow) => {
              setCurrentFlow(updatedFlow);
              setSuccessData({
                title: "Workflow updated successfully",
              });
            },
          },
        );

        return result;
      } else {
        throw new Error(result.error || "Failed to edit workflow");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      
      setErrorData({
        title: "Failed to edit workflow",
        list: [errorMessage],
      });

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    editFlowWithAI,
    isLoading,
    error,
  };
}
