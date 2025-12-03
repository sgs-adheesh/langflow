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
        <ShadTooltip content="Edit using AI" side="bottom">
          <Button
            variant="ghost"
            onClick={() => setOpenEditAI(true)}
            className="gap-2 h-9"
            data-testid="edit-with-ai-button"
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
      {currentFlow && (
        <WorkflowEditAIDialog
          open={openEditAI}
          onOpenChange={setOpenEditAI}
          flowData={currentFlow}
          onSuccess={() => {
            setOpenEditAI(false);
          }}
        />
      )}
    </>
  );
};

export default FlowToolbarOptions;
