import { useMemo, useState } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import ShadTooltip from "@/components/common/shadTooltipComponent";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";
import { ChatAssistantDialog } from "./ChatAssistantDialog";

type ChatAssistantLauncherProps = {
  className?: string;
  labelClassName?: string;
  tooltip?: string | null;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
};

export const ChatAssistantLauncher = ({
  className,
  labelClassName,
  tooltip = "Create using AI",
  variant = "outline",
  size = "iconMd",
}: ChatAssistantLauncherProps) => {
  const [open, setOpen] = useState(false);

  const buttonElement = useMemo(
    () => (
      <Button
        variant={variant}
        size={size}
        className={cn("gap-2 px-2.5 !text-mmd", className)}
        onClick={() => setOpen(true)}
      >
        <ForwardedIconComponent
          name="Sparkles"
          aria-hidden="true"
          className="h-4 w-4"
        />
        <span className={cn("whitespace-nowrap font-semibold", labelClassName)}>
          Create using AI
        </span>
      </Button>
    ),
    [className, labelClassName, size, variant],
  );

  return (
    <>
      {tooltip ? (
        <ShadTooltip content={tooltip} side="bottom">
          {buttonElement}
        </ShadTooltip>
      ) : (
        buttonElement
      )}
      <ChatAssistantDialog open={open} onOpenChange={setOpen} />
    </>
  );
};

export default ChatAssistantLauncher;

