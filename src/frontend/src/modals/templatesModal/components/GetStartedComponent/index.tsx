import { useParams } from "react-router-dom";
import { ENABLE_KNOWLEDGE_BASES } from "@/customization/feature-flags";
import { BRAND_NAME } from "@/constants/branding";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { Button } from "@/components/ui/button";
import BaseModal from "@/modals/baseModal";
import useFlowsManagerStore from "@/stores/flowsManagerStore";
import { useCustomNavigate } from "@/customization/hooks/use-custom-navigate";
import useAddFlow from "@/hooks/flows/use-add-flow";
import { track } from "@/customization/utils/analytics";
import { useFolderStore } from "@/stores/foldersStore";
import { updateIds } from "@/utils/reactflowUtils";
import type { CardData } from "@/types/templates/types";
import memoryChatbot from "../../../../assets/temp-pat-1.png";
import vectorRag from "../../../../assets/temp-pat-2.png";
import multiAgent from "../../../../assets/temp-pat-3.png";
import memoryChatbotHorizontal from "../../../../assets/temp-pat-m-1.png";
import vectorRagHorizontal from "../../../../assets/temp-pat-m-2.png";
import multiAgentHorizontal from "../../../../assets/temp-pat-m-3.png";

export default function GetStartedComponent() {
  const examples = useFlowsManagerStore((state) => state.examples);
  const addFlow = useAddFlow();
  const navigate = useCustomNavigate();
  const { folderId } = useParams();
  const myCollectionId = useFolderStore((state) => state.myCollectionId);

  const folderIdUrl = folderId ?? myCollectionId;

  const filteredExamples = examples.filter((example) => {
    return !(!ENABLE_KNOWLEDGE_BASES && example.name?.includes("Knowledge"));
  });

  // Define the card data
  const cardData: CardData[] = [
    {
      bgImage: memoryChatbot,
      bgHorizontalImage: memoryChatbotHorizontal,
      icon: "MessagesSquare",
      category: "prompting",
      flow: filteredExamples.find(
        (example) => example.name === "Basic Prompting",
      ),
    },
    {
      bgImage: vectorRag,
      bgHorizontalImage: vectorRagHorizontal,
      icon: "Database",
      category: "RAG",
      flow: filteredExamples.find(
        (example) => example.name === "Vector Store RAG",
      ),
    },
    {
      bgImage: multiAgent,
      bgHorizontalImage: multiAgentHorizontal,
      icon: "Bot",
      category: "Agents",
      flow: filteredExamples.find((example) => example.name === "Simple Agent"),
    },
  ];

  const handleBlankFlow = () => {
    addFlow().then((id) => {
      navigate(`/flow/${id}${folderIdUrl ? `/folder/${folderIdUrl}` : ""}`);
      track("New Flow Created", { template: "Blank Flow" });
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <BaseModal.Header
        description={`Start with templates showcasing ${BRAND_NAME}'s prompting, RAG, and agent use cases.`}
      >
        Get started
      </BaseModal.Header>
      <div className="flex flex-col gap-2">
        {/* Blank Flow Option */}
        {/* <div 
          className="group flex cursor-pointer items-center gap-4 rounded-lg border p-4 hover:bg-[hsl(217.2,91.2%,50.8%)] hover:bg-opacity-10"
          onClick={handleBlankFlow}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
            <ForwardedIconComponent name="Plus" className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex flex-col">
            <h3 className="font-semibold">Blank Flow</h3>
            <p className="text-sm text-muted-foreground">
              Start with a fresh canvas to build your flow from scratch.
            </p>
          </div>
          <ForwardedIconComponent 
            name="ArrowRight" 
            className="ml-auto h-5 w-5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" 
          />
        </div> */}

        {/* Template Options as List */}
        {cardData.map((card, index) => (
          <TemplateListItem key={index} {...card} />
        ))}
      </div>
    </div>
  );
}

function TemplateListItem({
  icon,
  category,
  flow,
}: CardData) {
  const addFlow = useAddFlow();
  const navigate = useCustomNavigate();
  const { folderId } = useParams();
  const myCollectionId = useFolderStore((state) => state.myCollectionId);

  const folderIdUrl = folderId ?? myCollectionId;

  const handleClick = () => {
    if (flow) {
      updateIds(flow.data!);
      addFlow({ flow }).then((id) => {
        navigate(`/flow/${id}/folder/${folderIdUrl}`);
      });
      track("New Flow Created", { template: `${flow.name} Template` });
    } else {
      console.error(`Flow template not found`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return flow ? (
    <div
      className="group flex cursor-pointer items-center gap-4 rounded-lg border p-4 hover:bg-[hsl(217.2,91.2%,50.8%)] hover:bg-opacity-10"
      tabIndex={1}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
        <ForwardedIconComponent name={icon} className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {category}
          </span>
        </div>
        <h3 className="font-semibold">{flow.name}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {flow.description}
        </p>
      </div>
      <ForwardedIconComponent 
        name="ArrowRight" 
        className="ml-auto h-5 w-5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" 
      />
    </div>
  ) : (
    <></>
  );
}