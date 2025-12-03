import React, { useEffect, useRef, useState } from 'react';
import { useTenantLogin } from '../hooks/useTenantLogin';

/**
 * Component to embed Langflow in an iframe
 * Automatically handles tenant-based authentication
 * 
 * @param {string} tenantId - Tenant ID from your app
 * @param {string} userId - User ID from your app
 * @param {string} sessionToken - Session token from your app's login
 * @param {string} username - Optional: Custom username for Langflow user
 * @param {string} langflowUrl - Langflow base URL (default: http://localhost:7860)
 * @param {string} height - Iframe height (default: 600px)
 * @param {string} width - Iframe width (default: 100%)
 * 
 * Usage:
 * <LangflowEmbed 
 *   tenantId="tenant-123"
 *   userId="user-456"
 *   sessionToken="your-session-token"
 * />
 */
export const LangflowEmbed = ({ 
  tenantId, 
  userId, 
  sessionToken,
  username = null,
  langflowUrl = 'http://localhost:7860',
  height = '600px',
  width = '100%',
  onAuthSuccess = null,
  onAuthError = null,
}) => {
  const iframeRef = useRef(null);
  const { loginToLangflow, loading, error, isAuthenticated } = useTenantLogin(langflowUrl);
  const [authAttempted, setAuthAttempted] = useState(false);

  useEffect(() => {
    // Authenticate with Langflow when component mounts or when props change
    const authenticate = async () => {
      if (authAttempted) return; // Prevent multiple auth attempts

      try {
        await loginToLangflow(tenantId, userId, sessionToken, username);
        setAuthAttempted(true);
        
        if (onAuthSuccess) {
          onAuthSuccess();
        }
      } catch (err) {
        console.error('Failed to authenticate with Langflow:', err);
        setAuthAttempted(true);
        
        if (onAuthError) {
          onAuthError(err);
        }
      }
    };

    if (tenantId && userId && sessionToken) {
      authenticate();
    }
  }, [tenantId, userId, sessionToken, username, langflowUrl, loginToLangflow, authAttempted, onAuthSuccess, onAuthError]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: height,
        width: width,
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        fontSize: '14px',
        color: '#666',
      }}>
        Authenticating with Langflow...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: height,
        width: width,
        backgroundColor: '#ffebee',
        borderRadius: '8px',
        color: '#c62828',
        padding: '16px',
        textAlign: 'center',
      }}>
        <div>
          <strong>Error:</strong> {error}
          <p style={{ fontSize: '12px', marginTop: '8px' }}>
            Please check that Langflow is running and your credentials are correct.
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && authAttempted) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: height,
        width: width,
        backgroundColor: '#fff3cd',
        borderRadius: '8px',
        color: '#856404',
        padding: '16px',
      }}>
        Failed to authenticate with Langflow. Please try again.
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src={langflowUrl}
      style={{
        width: width,
        height: height,
        border: 'none',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
      title="Langflow"
      allow="camera;microphone"
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-pointer-lock"
    />
  );
};

export default LangflowEmbed;
