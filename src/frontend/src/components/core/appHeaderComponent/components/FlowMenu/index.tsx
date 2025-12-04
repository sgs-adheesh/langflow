import { memo, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useShallow } from "zustand/react/shallow";
import IconComponent from "@/components/common/genericIconComponent";
import ShadTooltip from "@/components/common/shadTooltipComponent";
import FlowSettingsComponent from "@/components/core/flowSettingsComponent";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SAVED_HOVER } from "@/constants/constants";
import { useGetRefreshFlowsQuery } from "@/controllers/API/queries/flows/use-get-refresh-flows-query";
import { useGetFoldersQuery } from "@/controllers/API/queries/folders/use-get-folders";
import { useCustomNavigate } from "@/customization/hooks/use-custom-navigate";
import useSaveFlow from "@/hooks/flows/use-save-flow";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import useAlertStore from "@/stores/alertStore";
import useFlowStore from "@/stores/flowStore";
import useFlowsManagerStore from "@/stores/flowsManagerStore";
import { useShortcutsStore } from "@/stores/shortcuts";
import { swatchColors } from "@/utils/styleUtils";
import { cn, getNumberFromString } from "@/utils/utils";

export const MenuBar = memo((): JSX.Element => {
  const setSuccessData = useAlertStore((state) => state.setSuccessData);
  const saveLoading = useFlowsManagerStore((state) => state.saveLoading);
  const [openSettings, setOpenSettings] = useState(false);
  const navigate = useCustomNavigate();
  const isBuilding = useFlowStore((state) => state.isBuilding);
  const saveFlow = useSaveFlow();
  const autoSaving = useFlowsManagerStore((state) => state.autoSaving);
  const {
    isFlowLocked,
    currentFlowName,
    currentFlowId,
    currentFlowFolderId,
    currentFlowIcon,
    currentFlowGradient,
  } = useFlowStore(
    useShallow((state) => ({
      isFlowLocked: state.currentFlow?.locked,
      currentFlowName: state.currentFlow?.name,
      currentFlowId: state.currentFlow?.id,
      currentFlowFolderId: state.currentFlow?.folder_id,
      currentFlowIcon: state.currentFlow?.icon,
      currentFlowGradient: state.currentFlow?.gradient,
    })),
  );
  const { updated_at: updatedAt } = useFlowsManagerStore(
    useShallow((state) => ({
      updated_at: state.currentFlow?.updated_at,
    })),
  );
  const onFlowPage = useFlowStore((state) => state.onFlowPage);
  const measureRef = useRef<HTMLSpanElement>(null);
  const changesNotSaved = useUnsavedChanges();

  const { data: folders, isFetched: isFoldersFetched } = useGetFoldersQuery();

  useGetRefreshFlowsQuery(
    {
      get_all: true,
      header_flows: true,
    },
    { enabled: isFoldersFetched },
  );

  const currentFolder = useMemo(
    () => folders?.find((f) => f.id === currentFlowFolderId),
    [folders, currentFlowFolderId],
  );

  const handleSave = () => {
    saveFlow().then(() => {
      setSuccessData({ title: "Saved successfully" });
    });
  };

  const changes = useShortcutsStore((state) => state.changesSave);
  useHotkeys(changes, handleSave, { preventDefault: true });

  const swatchIndex =
    (currentFlowGradient && !isNaN(parseInt(currentFlowGradient))
      ? parseInt(currentFlowGradient)
      : getNumberFromString(currentFlowGradient ?? currentFlowId ?? "")) %
    swatchColors.length;

  return onFlowPage ? (
    <Popover open={openSettings} onOpenChange={setOpenSettings}>
      <PopoverAnchor>
        <div
          className="relative flex w-full items-center justify-center gap-2"
          data-testid="menu_bar_wrapper"
        >
          <div
            className="header-menu-bar hidden max-w-40 justify-end truncate md:flex xl:max-w-full"
            data-testid="menu_flow_bar"
            id="menu_flow_bar_navigation"
          >
            {currentFolder?.name && (
              <div className="hidden truncate md:flex">
                <div
                  className="cursor-pointer truncate text-sm text-muted-foreground hover:text-primary"
                  onClick={() => {
                    navigate(
                      currentFolder?.id
                        ? "/all/folder/" + currentFolder.id
                        : "/all",
                    );
                  }}
                >
                  {currentFolder?.name}
                </div>
              </div>
            )}
          </div>
          <div
            className="hidden w-fit shrink-0 select-none font-normal text-muted-foreground md:flex"
            data-testid="menu_bar_separator"
          >
            /
          </div>
          <div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className={cn("h-3.5 w-3.5 fill-current", swatchColors[swatchIndex].split(" ")[1].replace("text-white", "text-foreground"))}>
              <path d="M433.3 33C445.2 29.5 457.7 35.7 462.3 46.9L463.1 49.2L503.1 185.2C505.6 193.6 503.2 202.7 497 208.9L432.9 273L509.3 252.2L529.2 192.4L530.1 190.1C535.1 179 547.8 173.3 559.6 177.2C571.4 181.1 578.1 193.3 575.4 205.2L574.7 207.6L550.7 279.6C548.2 287.2 542 293 534.2 295.2L443.1 320L534.2 344.8C541.9 346.9 548.1 352.8 550.7 360.4L574.7 432.4L575.4 434.8C578.1 446.7 571.3 458.9 559.6 462.8C547.8 466.7 535.1 461 530.1 449.9L529.2 447.6L509.3 387.8L432.9 367L497 431.1C503.1 437.2 505.5 446.2 503.2 454.5L463.2 598.5L462.4 600.8C458 612.1 445.6 618.5 433.6 615.2C421.6 611.9 414.3 600 416.4 588L416.9 585.6L453.1 455.1L415.9 417.9C415 470 372.4 512 320 512C267.6 512 225 470 224 417.9L187 454.9L223 577.2L223.6 579.6C225.8 591.5 218.7 603.5 206.8 607C194.9 610.5 182.4 604.3 177.8 593.1L177 590.8L137 454.8C134.5 446.4 136.9 437.3 143.1 431L207.2 366.9L130.8 387.7L110.9 447.5L110 449.8C105 460.9 92.3 466.6 80.5 462.7C68.7 458.8 62 446.6 64.7 434.7L65.4 432.3L89.4 360.3C91.9 352.7 98.1 346.9 105.9 344.7L197 319.9L105.9 295.1C98.2 293 92 287.1 89.4 279.5L65.4 207.5L64.7 205.1C62 193.2 68.8 181 80.5 177.1C92.2 173.2 105 178.9 110 190L110.9 192.3L130.8 252.1L207.2 272.9L143.1 208.8C136.9 202.6 134.6 193.5 137 185.1L177 49.1L177.8 46.8C182.4 35.5 194.9 29.4 206.8 32.9C218.7 36.4 225.8 48.4 223.6 60.3L223 62.7L187 185L240 238C241 194.7 276.4 159.9 319.9 159.9C363.4 159.9 398.8 194.7 399.8 238.1L452.9 185L416.9 62.7L416.3 60.3C414.1 48.3 421.2 36.4 433.1 32.9z"/>
            </svg>
          </div>
          <PopoverTrigger asChild>
            <div
              className="group relative -mr-5 flex shrink-0 cursor-pointer items-center gap-2 text-sm sm:whitespace-normal"
              data-testid="menu_bar_display"
            >
              <span
                ref={measureRef}
                className="w-fit max-w-[35vw] truncate whitespace-pre text-mmd font-semibold sm:max-w-full sm:text-sm"
                aria-hidden="true"
                data-testid="flow_name"
              >
                {currentFlowName || "Untitled Flow"}
              </span>
              <IconComponent
                name="pencil"
                className={cn(
                  "h-5 w-3.5 -translate-x-2 opacity-0 transition-all",
                  !openSettings &&
                    "sm:group-hover:translate-x-0 sm:group-hover:opacity-100",
                )}
              />
            </div>
          </PopoverTrigger>
          <div className={"ml-5 hidden shrink-0 items-center sm:flex"}>
            {!autoSaving && (
              <ShadTooltip
                content={
                  changesNotSaved
                    ? saveLoading
                      ? "Saving..."
                      : "Save Changes"
                    : SAVED_HOVER +
                      (updatedAt
                        ? new Date(updatedAt).toLocaleString("en-US", {
                            hour: "numeric",
                            minute: "numeric",
                          })
                        : "Never")
                }
                side="bottom"
                styleClasses="cursor-default z-10"
              >
                <div>
                  <Button
                    variant="primary"
                    size="iconMd"
                    disabled={!changesNotSaved || isBuilding || saveLoading}
                    className={cn("h-7 w-7 border-border")}
                    onClick={handleSave}
                    data-testid="save-flow-button"
                  >
                    <IconComponent
                      name={saveLoading ? "Loader2" : "Save"}
                      className={cn("h-5 w-5", saveLoading && "animate-spin")}
                    />
                  </Button>
                </div>
              </ShadTooltip>
            )}
          </div>
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="flex w-96 flex-col gap-4 p-4"
        align="center"
        sideOffset={15}
      >
        <FlowSettingsComponent
          close={() => setOpenSettings(false)}
          open={openSettings}
        />
      </PopoverContent>
    </Popover>
  ) : (
    <></>
  );
});

export default MenuBar;
