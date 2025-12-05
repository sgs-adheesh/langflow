import { Outlet, type To } from "react-router-dom";
import SideBarButtonsComponent from "@/components/core/sidebarComponent";
import { SidebarProvider } from "@/components/ui/sidebar";
import { CustomStoreSidebar } from "@/customization/components/custom-store-sidebar";
import {
  ENABLE_DATASTAX_LANGFLOW,
  ENABLE_LANGFLOW_STORE,
  ENABLE_PROFILE_ICONS,
} from "@/customization/feature-flags";
import { BRAND_NAME } from "@/constants/branding";
import useAuthStore from "@/stores/authStore";
import { useStoreStore } from "@/stores/storeStore";
import ForwardedIconComponent from "../../components/common/genericIconComponent";
import PageLayout from "../../components/common/pageLayout";

export default function SettingsPage(): JSX.Element {
  const autoLogin = useAuthStore((state) => state.autoLogin);
  const hasStore = useStoreStore((state) => state.hasStore);
  const hasApiKey = useStoreStore((state) => state.hasApiKey);

  const sidebarNavItems: {
    href?: string;
    title: string;
    icon: React.ReactNode;
  }[] = [];

  // MCP Servers tab (commented out)
  // sidebarNavItems.push({
  //   title: "MCP Servers",
  //   href: "/settings/mcp-servers",
  //   icon: (
  //     <ForwardedIconComponent
  //       name="Mcp"
  //       className="w-4 flex-shrink-0 justify-start stroke-[1.5]"
  //     />
  //   ),
  // });

  // Add Global Variables tab
  sidebarNavItems.push({
    title: "Global Variables",
    href: "/settings/global-variables",
    icon: (
      <ForwardedIconComponent
        name="Globe"
        className="w-4 flex-shrink-0 justify-start stroke-[1.5]"
      />
    ),
  });

  // Add Shortcuts tab
  sidebarNavItems.push({
    title: "Shortcuts",
    href: "/settings/shortcuts",
    icon: (
      <ForwardedIconComponent
        name="Keyboard"
        className="w-4 flex-shrink-0 justify-start stroke-[1.5]"
      />
    ),
  });

  // Add Messages tab
  sidebarNavItems.push({
    title: "Messages",
    href: "/settings/messages",
    icon: (
      <ForwardedIconComponent
        name="MessagesSquare"
        className="w-4 flex-shrink-0 justify-start stroke-[1.5]"
      />
    ),
  });

  // Add API Keys and Store items
  const storeSidebarItems = CustomStoreSidebar(hasApiKey, hasStore);
  sidebarNavItems.push(...storeSidebarItems);

  return (
    <PageLayout
      backTo={-1 as To}
      title="Settings"
      description={`Manage the general settings for ${BRAND_NAME}.`}
    >
      <SidebarProvider width="15rem" defaultOpen={false}>
        <SideBarButtonsComponent items={sidebarNavItems} />
        <main className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col overflow-x-hidden pt-1">
            <Outlet />
          </div>
        </main>
      </SidebarProvider>
    </PageLayout>
  );
}