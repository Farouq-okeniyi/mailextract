/**
 * MailExtract Frontend Configuration
 * Strictly loaded from environment variables (VITE_*) with no embedded secrets or hardcoded IDs.
 */

export const config = {
  /** Backend API Base URL */
  apiUrl: import.meta.env.VITE_API_URL || '',

  /** Google OAuth Client ID */
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',

  /** Google Cloud Project ID */
  googleProjectId: import.meta.env.VITE_GOOGLE_PROJECT_ID || '',

  /** Google Cloud Console Audience / Test Users Management URL */
  googleCloudConsoleUrl: import.meta.env.VITE_GOOGLE_CLOUD_CONSOLE_URL || '',

  /** Google Auth Endpoint */
  googleAuthEndpoint: import.meta.env.VITE_GOOGLE_AUTH_ENDPOINT || '',

  /**
   * Helper to construct the Google OAuth authorization redirect URL
   */
  getGoogleAuthUrl: (token?: string | null): string => {
    const base = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
    const endpoint = (import.meta.env.VITE_GOOGLE_AUTH_ENDPOINT || '').replace(/^\/+/, '');
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${base}/${endpoint}${tokenParam}`;
  }
};
