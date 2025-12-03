import { useEffect } from "react";
import { tenantAPIClient } from "@/controllers/API/tenant-api";
import useAuthStore from "@/stores/authStore";

/**
 * Hook to initialize tenant context on app load
 * Call this in your root component (App.tsx)
 */
export function useTenantInitialization() {
  const setAutoLogin = useAuthStore((state) => state.setAutoLogin);

  useEffect(() => {
    // Initialize tenant context from parent app
    const tenantContext = tenantAPIClient.initializeTenantContext();

    if (tenantContext) {
      // If tenant context is available, enable auto-login mode
      setAutoLogin(true);
      console.log("Tenant context initialized, auto-login enabled");
    } else {
      // No tenant context, use normal authentication flow
      console.log("No tenant context, using normal authentication");
    }
  }, [setAutoLogin]);
}
