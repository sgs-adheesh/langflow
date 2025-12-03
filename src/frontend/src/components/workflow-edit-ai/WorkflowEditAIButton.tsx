/**
 * Button component for triggering workflow edit with AI
 * Designed to be integrated into workflow dropdown menus
 */

import { useState } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import type { FlowType } from "@/types/flow";
import { WorkflowEditAIDialog } from "./WorkflowEditAIDialog";

type WorkflowEditAIButtonProps = {
  flowData: FlowType;
  onSuccess?: () => void;
};

export function WorkflowEditAIButton({
  flowData,
  onSuccess,
}: WorkflowEditAIButtonProps) {
  const [open, setOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(true);
  };

  const handleSuccess = () => {
    onSuccess?.();
    setOpen(false);
  };

  return (
    <>
      <DropdownMenuItem
        onClick={handleClick}
        className="cursor-pointer"
        data-testid="btn-edit-flow-ai"
      >
        <ForwardedIconComponent
          name="Sparkles"
          aria-hidden="true"
          className="mr-2 h-4 w-4"
        />
        Edit using AI
      </DropdownMenuItem>

      <WorkflowEditAIDialog
        open={open}
        onOpenChange={setOpen}
        flowData={flowData}
        onSuccess={handleSuccess}
      />
    </>
  );
}
