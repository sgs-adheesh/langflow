import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChatAssistant } from "./ChatAssistant";

type ChatAssistantDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const ChatAssistantDialog = ({
  open,
  onOpenChange,
}: ChatAssistantDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideTitle
        className="flex h-[85vh] w-[92vw] max-w-5xl flex-col overflow-hidden bg-transparent p-0"
        closeButtonClassName="text-muted-foreground hover:text-foreground"
      >
        <ChatAssistant variant="dialog" />
      </DialogContent>
    </Dialog>
  );
};

export default ChatAssistantDialog;

