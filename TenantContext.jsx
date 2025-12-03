import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * Tenant Context to manage tenant-specific data across the app
 * 
 * Provides:
 * - currentTenant: Current tenant information
 * - currentUser: Current user in the tenant
 * - sessionToken: Session token for Langflow authentication
 * - setTenantSession: Function to set tenant session
 * - clearTenantSession: Function to clear tenant session
 */
const TenantContext = createContext();

export const TenantProvider = ({ children }) => {
  const [currentTenant, setCurrentTenant] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionToken, setSessionToken] = useState(null);

  const setTenantSession = useCallback((tenant, user, token) => {
    setCurrentTenant(tenant);
    setCurrentUser(user);
    setSessionToken(token);

    // Store in sessionStorage for session persistence
    sessionStorage.setItem('tenantSession', JSON.stringify({
      tenant,
      user,
      token,
    }));
  }, []);

  const clearTenantSession = useCallback(() => {
    setCurrentTenant(null);
    setCurrentUser(null);
    setSessionToken(null);
    sessionStorage.removeItem('tenantSession');
  }, []);

  const restoreTenantSession = useCallback(() => {
    const stored = sessionStorage.getItem('tenantSession');
    if (stored) {
      try {
        const { tenant, user, token } = JSON.parse(stored);
        setCurrentTenant(tenant);
        setCurrentUser(user);
        setSessionToken(token);
        return true;
      } catch (err) {
        console.error('Failed to restore tenant session:', err);
        return false;
      }
    }
    return false;
  }, []);

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        currentUser,
        sessionToken,
        setTenantSession,
        clearTenantSession,
        restoreTenantSession,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenantContext = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenantContext must be used within TenantProvider');
  }
  return context;
};
