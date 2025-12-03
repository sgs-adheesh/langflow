import { ForwardedIconComponent } from "@/components/common/genericIconComponent";
import { BRAND_NAME, BRAND_STORE_NAME } from "@/constants/branding";

export const CustomStoreSidebar = (
  hasApiKey: boolean = false,
  hasStore: boolean = false,
) => {
  const items: Array<{ title: string; href: string; icon: JSX.Element }> = [];

  // Always show API Keys tab in settings
  items.push({
    title: `${BRAND_NAME} API Keys`,
    href: "/settings/api-keys",
    icon: (
      <ForwardedIconComponent
        name="Key"
        className="w-4 flex-shrink-0 justify-start stroke-[1.5]"
      />
    ),
  });

  if (hasStore) {
    items.push({
      title: BRAND_STORE_NAME,
      href: "/settings/store",
      icon: (
        <ForwardedIconComponent
          name="Store"
          className="w-4 flex-shrink-0 justify-start stroke-[1.5]"
        />
      ),
    });
  }

  return items;
};