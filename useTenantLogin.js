import { useCallback, useState } from 'react';

/**
 * Hook to handle tenant-based login to Langflow
 * 
 * @param {string} langflowUrl - Base URL of Langflow instance (default: http://localhost:7860)
 * @returns {Object} { loginToLangflow, tokens, loading, error }
 * 
 * Usage:
 * const { loginToLangflow, tokens, loading, error } = useTenantLogin();
 * 
 * await loginToLangflow(tenantId, userId, sessionToken);
 */
export const useTenantLogin = (langflowUrl = 'http://localhost:7860') => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const loginToLangflow = useCallback(async (tenantId, userId, sessionToken, username = null) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${langflowUrl}/api/v1/tenant/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important: sends cookies for authentication
        body: JSON.stringify({
          tenant_id: tenantId,
          user_id: userId,
          session_token: sessionToken,
          username: username || undefined,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to login to Langflow';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          // Could not parse error response
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setTokens(data);
      setIsAuthenticated(true);

      // Store tokens in sessionStorage (cleared when browser closes)
      sessionStorage.setItem('langflow_tokens', JSON.stringify(data));
      
      // Also store in localStorage for persistence across sessions
      localStorage.setItem('langflow_tokens', JSON.stringify(data));

      return data;
    } catch (err) {
      const errorMsg = err.message || 'Unknown error occurred';
      setError(errorMsg);
      setIsAuthenticated(false);
      console.error('Langflow login error:', errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [langflowUrl]);

  const logout = useCallback(() => {
    setTokens(null);
    setIsAuthenticated(false);
    setError(null);
    sessionStorage.removeItem('langflow_tokens');
    localStorage.removeItem('langflow_tokens');
  }, []);

  const getStoredTokens = useCallback(() => {
    const stored = sessionStorage.getItem('langflow_tokens') || localStorage.getItem('langflow_tokens');
    return stored ? JSON.parse(stored) : null;
  }, []);

  return {
    loginToLangflow,
    logout,
    getStoredTokens,
    tokens,
    isAuthenticated,
    loading,
    error,
  };
};
