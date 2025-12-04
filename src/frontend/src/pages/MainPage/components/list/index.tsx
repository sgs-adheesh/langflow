import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import useDragStart from "@/components/core/cardComponent/hooks/use-on-drag-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCustomNavigate } from "@/customization/hooks/use-custom-navigate";
import useDeleteFlow from "@/hooks/flows/use-delete-flow";
import DeleteConfirmationModal from "@/modals/deleteConfirmationModal";
import ExportModal from "@/modals/exportModal";
import FlowSettingsModal from "@/modals/flowSettingsModal";
import useAlertStore from "@/stores/alertStore";
import type { FlowType } from "@/types/flow";
import { downloadFlow } from "@/utils/reactflowUtils";
import { swatchColors } from "@/utils/styleUtils";
import { cn, getNumberFromString } from "@/utils/utils";
import useDescriptionModal from "../../hooks/use-description-modal";
import { useGetTemplateStyle } from "../../utils/get-template-style";
import { timeElapsed } from "../../utils/time-elapse";
import DropdownComponent from "../dropdown";

const ListComponent = ({
  flowData,
  selected,
  setSelected,
  shiftPressed,
}: {
  flowData: FlowType;
  selected: boolean;
  setSelected: (selected: boolean) => void;
  shiftPressed: boolean;
}) => {
  const navigate = useCustomNavigate();
  const [openDelete, setOpenDelete] = useState(false);
  const setSuccessData = useAlertStore((state) => state.setSuccessData);
  const { deleteFlow } = useDeleteFlow();
  const setErrorData = useAlertStore((state) => state.setErrorData);
  const { folderId } = useParams();
  const [openSettings, setOpenSettings] = useState(false);
  const [openExportModal, setOpenExportModal] = useState(false);
  const isComponent = flowData.is_component ?? false;

  const { getIcon } = useGetTemplateStyle(flowData);

  const editFlowLink = `/flow/${flowData.id}${folderId ? `/folder/${folderId}` : ""}`;

  const handleClick = async () => {
    if (shiftPressed) {
      setSelected(!selected);
    } else {
      if (!isComponent) {
        navigate(editFlowLink);
      }
    }
  };

  const handleDelete = () => {
    deleteFlow({ id: [flowData.id] })
      .then(() => {
        setSuccessData({
          title: "Selected items deleted successfully",
        });
      })
      .catch(() => {
        setErrorData({
          title: "Error deleting items",
          list: ["Please try again"],
        });
      });
  };

  const { onDragStart } = useDragStart(flowData);

  const descriptionModal = useDescriptionModal(
    [flowData?.id],
    flowData.is_component ? "component" : "flow",
  );

  const swatchIndex =
    (flowData.gradient && !isNaN(parseInt(flowData.gradient))
      ? parseInt(flowData.gradient)
      : getNumberFromString(flowData.gradient ?? flowData.id)) %
    swatchColors.length;

  const handleExport = () => {
    if (flowData.is_component) {
      downloadFlow(flowData, flowData.name, flowData.description);
      setSuccessData({ title: `${flowData.name} exported successfully` });
    } else {
      setOpenExportModal(true);
    }
  };

  const [icon, setIcon] = useState<string>("");

  useEffect(() => {
    getIcon().then(setIcon);
  }, [getIcon]);

  return (
    <>
      <Card
        key={flowData.id}
        draggable
        onDragStart={onDragStart}
        onClick={handleClick}
        className={`flex flex-row bg-background ${
          isComponent ? "cursor-default" : "cursor-pointer"
        } group justify-between rounded-lg border-none px-4 py-3 shadow-none hover:bg-muted`}
        data-testid="list-card"
      >
        <div
          className={`flex min-w-0 ${
            isComponent ? "cursor-default" : "cursor-pointer"
          } items-center gap-4`}
        >
          <div className="group/checkbox relative flex items-center justify-center" style={{width: "40px"}}>
            <div
              className={cn(
                "absolute z-20 flex items-center justify-center transition-opacity duration-300",
                selected ? "opacity-100" : "opacity-0 group-hover/checkbox:opacity-100",
              )}
            >
              <Checkbox
                checked={selected}
                onCheckedChange={(checked) => setSelected(checked as boolean)}
                onClick={(e) => e.stopPropagation()}
                className="focus-visible:ring-0"
                data-testid={`checkbox-${flowData.id}`}
              />
            </div>
            <div
              className={cn(
                "flex items-center justify-center transition-opacity duration-200 rounded bg-gray-200 p-1",
                selected
                  ? "opacity-0"
                  : "opacity-100 group-hover/checkbox:opacity-0",
              )}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" className={cn("h-5 w-5 fill-current", swatchColors[swatchIndex].split(" ")[1].replace("text-white", "text-foreground"))}>
                <path d="M433.3 33C445.2 29.5 457.7 35.7 462.3 46.9L463.1 49.2L503.1 185.2C505.6 193.6 503.2 202.7 497 208.9L432.9 273L509.3 252.2L529.2 192.4L530.1 190.1C535.1 179 547.8 173.3 559.6 177.2C571.4 181.1 578.1 193.3 575.4 205.2L574.7 207.6L550.7 279.6C548.2 287.2 542 293 534.2 295.2L443.1 320L534.2 344.8C541.9 346.9 548.1 352.8 550.7 360.4L574.7 432.4L575.4 434.8C578.1 446.7 571.3 458.9 559.6 462.8C547.8 466.7 535.1 461 530.1 449.9L529.2 447.6L509.3 387.8L432.9 367L497 431.1C503.1 437.2 505.5 446.2 503.2 454.5L463.2 598.5L462.4 600.8C458 612.1 445.6 618.5 433.6 615.2C421.6 611.9 414.3 600 416.4 588L416.9 585.6L453.1 455.1L415.9 417.9C415 470 372.4 512 320 512C267.6 512 225 470 224 417.9L187 454.9L223 577.2L223.6 579.6C225.8 591.5 218.7 603.5 206.8 607C194.9 610.5 182.4 604.3 177.8 593.1L177 590.8L137 454.8C134.5 446.4 136.9 437.3 143.1 431L207.2 366.9L130.8 387.7L110.9 447.5L110 449.8C105 460.9 92.3 466.6 80.5 462.7C68.7 458.8 62 446.6 64.7 434.7L65.4 432.3L89.4 360.3C91.9 352.7 98.1 346.9 105.9 344.7L197 319.9L105.9 295.1C98.2 293 92 287.1 89.4 279.5L65.4 207.5L64.7 205.1C62 193.2 68.8 181 80.5 177.1C92.2 173.2 105 178.9 110 190L110.9 192.3L130.8 252.1L207.2 272.9L143.1 208.8C136.9 202.6 134.6 193.5 137 185.1L177 49.1L177.8 46.8C182.4 35.5 194.9 29.4 206.8 32.9C218.7 36.4 225.8 48.4 223.6 60.3L223 62.7L187 185L240 238C241 194.7 276.4 159.9 319.9 159.9C363.4 159.9 398.8 194.7 399.8 238.1L452.9 185L416.9 62.7L416.3 60.3C414.1 48.3 421.2 36.4 433.1 32.9z"/>
              </svg>
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-start">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <div
                className="flex min-w-0 flex-shrink truncate text-sm font-semibold"
                data-testid={`flow-name-div`}
              >
                <span
                  className="truncate"
                  data-testid={`flow-name-${flowData.id}`}
                >
                  {flowData.name}
                </span>
              </div>
              <div className="flex min-w-0 flex-shrink text-xs text-muted-foreground">
                <span className="truncate">
                  Edited {timeElapsed(flowData.updated_at)} ago
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="ml-5 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="iconMd"
                data-testid="home-dropdown-menu"
                className="group"
              >
                <ForwardedIconComponent
                  name="Ellipsis"
                  aria-hidden="true"
                  className="h-5 w-5 text-muted-foreground group-hover:text-foreground"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[185px]"
              sideOffset={5}
              side="bottom"
            >
              <DropdownComponent
                flowData={flowData}
                setOpenDelete={setOpenDelete}
                handleExport={handleExport}
                handleEdit={() => {
                  setOpenSettings(true);
                }}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
      {openDelete && (
        <DeleteConfirmationModal
          open={openDelete}
          setOpen={setOpenDelete}
          onConfirm={handleDelete}
          description={descriptionModal}
          note={!flowData.is_component ? "and its message history" : ""}
        />
      )}
      <ExportModal
        open={openExportModal}
        setOpen={setOpenExportModal}
        flowData={flowData}
      />
      <FlowSettingsModal
        open={openSettings}
        setOpen={setOpenSettings}
        flowData={flowData}
      />
    </>
  );
};

export default ListComponent;
