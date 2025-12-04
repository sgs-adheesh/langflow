import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import ShadTooltip from "@/components/common/shadTooltipComponent";
import { Button } from "@/components/ui/button";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { WorkflowEditAIDialog } from "@/components/workflow-edit-ai";
import useFlowStore from "@/stores/flowStore";
import useFlowsManagerStore from "@/stores/flowsManagerStore";
import PublishDropdown from "./deploy-dropdown";
import PlaygroundButton from "./playground-button";

type FlowToolbarOptionsProps = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  openApiModal: boolean;
  setOpenApiModal: Dispatch<SetStateAction<boolean>>;
};
const FlowToolbarOptions = ({
  open,
  setOpen,
  openApiModal,
  setOpenApiModal,
}: FlowToolbarOptionsProps) => {
  const hasIO = useFlowStore((state) => state.hasIO);
  const [openEditAI, setOpenEditAI] = useState(false);
  const currentFlow = useFlowsManagerStore((state) => state.currentFlow);
  const nodes = useFlowStore((state) => state.nodes); // Get nodes from flowStore
  const edges = useFlowStore((state) => state.edges); // Get edges from flowStore

  // Build flowData from current state when needed
  const flowData = currentFlow ? {
    ...currentFlow,
    data: {
      nodes: nodes,
      edges: edges,
      viewport: currentFlow.data?.viewport || { x: 0, y: 0, zoom: 1 }
    }
  } : null;

  return (
    <>
      <div className="flex items-center gap-1.5">
        <div className="flex h-full w-full gap-1.5 rounded-sm transition-all">
          <PlaygroundButton
            hasIO={hasIO}
            open={open}
            setOpen={setOpen}
            canvasOpen
          />
        </div>
        
        {/* Edit using AI Button */}
        <ShadTooltip 
          content={
            nodes.length > 0
              ? "Edit using AI" 
              : "Add components to your workflow first"
          } 
          side="bottom"
        >
          <Button
            variant="ghost"
            onClick={() => {
              console.log("Edit AI button clicked", {
                currentFlow: !!currentFlow,
                flowData: !!flowData,
                nodesCount: nodes.length,
                edgesCount: edges.length,
                openEditAI: openEditAI
              });
              setOpenEditAI(true);
            }}
            className="gap-2 h-9"
            data-testid="edit-with-ai-button"
            disabled={nodes.length === 0}
          >
            <ForwardedIconComponent
              name="Sparkles"
              className="h-4 w-4"
            />
            <span>Edit using AI</span>
          </Button>
        </ShadTooltip>
        
        <PublishDropdown
          openApiModal={openApiModal}
          setOpenApiModal={setOpenApiModal}
        />
      </div>
      
      {/* AI Edit Dialog - Styled like ChatAssistant but for editing */}
      {flowData && nodes.length > 0 && (
        <WorkflowEditAIDialog
          open={openEditAI}
          onOpenChange={setOpenEditAI}
          flowData={flowData}
          onSuccess={() => {
            setOpenEditAI(false);
          }}
        />
      )}
    </>
  );
};

export default FlowToolbarOptions;
