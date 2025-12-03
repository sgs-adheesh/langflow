import { customGetHostProtocol } from "@/customization/utils/custom-get-host-protocol";
import type { GetCodeType } from "@/types/tweaks";

/**
 * Function to get the widget code for the API
 * @param {string} flow - The current flow.
 * @returns {string} - The widget code
 */
export default function getWidgetCode({
  flowId,
  flowName,
  isAuth,
  copy = false,
}: GetCodeType): string {
  const widgetScriptUrl =
    import.meta.env.VITE_CHAT_WIDGET_URL ??
    "https://cdn.example.com/flow-studio-chat/widget.js";
  const widgetTag =
    import.meta.env.VITE_CHAT_WIDGET_TAG ?? "flow-studio-chat";

  const source = copy
    ? `<script
  src="${widgetScriptUrl}">
</script>`
    : `<script
  src="${widgetScriptUrl}">
</script>`;

  const { protocol, host } = customGetHostProtocol();

  return `${source}
  <${widgetTag}
    window_title="${flowName}"
    flow_id="${flowId}"
    host_url="${protocol}//${host}"${
      !isAuth
        ? `
    api_key="..."`
        : ""
    }>
</${widgetTag}>`;
}
