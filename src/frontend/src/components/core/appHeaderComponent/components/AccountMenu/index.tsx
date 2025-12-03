import { CustomProfileIcon } from "@/customization/components/custom-profile-icon";
import ShadTooltip from "@/components/common/shadTooltipComponent";
import { Button } from "@/components/ui/button";

export const AccountMenu = () => {
  return (
    <ShadTooltip
      content="Profile"
      side="bottom"
      styleClasses="z-10"
    >
      <Button
        unstyled
        className="hit-area-hover rounded-md px-2 py-2 focus-visible:outline-0"
        data-testid="user-profile-settings"
      >
        <div className="h-6 w-6 rounded-lg">
          <CustomProfileIcon />
        </div>
      </Button>
    </ShadTooltip>
  );
};
