/**
 * Tenant-aware API client
 * Gets tenant context from parent application via window object or query params
 * Adds tenant headers to all API requests
 */

interface TenantContext {
  tenantId: string;
  sessionToken: string;
  userId: string;
}

class TenantAPIClient {
  private tenantContext: TenantContext | null = null;

  /**
   * Initialize tenant context from parent app
   * Can be called from:
   * 1. Query parameters: ?tenantId=xxx&sessionToken=yyy&userId=zzz
   * 2. Window object: window.__TENANT_CONTEXT__ = {...}
   * 3. PostMessage from iFrame parent
   */
  initializeTenantContext() {
    // Method 1: Check window object (parent app sets this)
    if (typeof window !== "undefined" && (window as any).__TENANT_CONTEXT__) {
      this.tenantContext = (window as any).__TENANT_CONTEXT__;
      console.log("Tenant context from window:", this.tenantContext);
      return this.tenantContext;
    }

    // Method 2: Check URL query parameters
    const params = new URLSearchParams(window.location.search);
    const tenantId = params.get("tenantId");
    const sessionToken = params.get("sessionToken");
    const userId = params.get("userId");

    if (tenantId && sessionToken && userId) {
      this.tenantContext = { tenantId, sessionToken, userId };
      console.log("Tenant context from URL:", this.tenantContext);
      return this.tenantContext;
    }

    console.warn("No tenant context found!");
    return null;
  }

  /**
   * Set tenant context programmatically
   */
  setTenantContext(context: TenantContext) {
    this.tenantContext = context;
  }

  /**
   * Get current tenant context
   */
  getTenantContext(): TenantContext | null {
    return this.tenantContext;
  }

  /**
   * Build headers with tenant info for API requests
   */
  getTenantHeaders(): Record<string, string> {
    if (!this.tenantContext) {
      return {};
    }

    return {
      "X-Tenant-ID": this.tenantContext.tenantId,
      "X-Session-Token": this.tenantContext.sessionToken,
      "X-User-ID": this.tenantContext.userId,
    };
  }

  /**
   * Check if tenant context is available
   */
  isInitialized(): boolean {
    return this.tenantContext !== null;
  }
}

// Export singleton instance
export const tenantAPIClient = new TenantAPIClient();
