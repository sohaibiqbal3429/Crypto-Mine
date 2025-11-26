import Constants from 'expo-constants';

const expoApiBase = (Constants?.expoConfig?.extra as any)?.apiBaseUrl

/**
 * Shared API root for the mobile client. This should match the web app's API_BASE_URL
 * and typically include the `/api` suffix (e.g., https://mintminepro.com/api).
 */
export const API_BASE_URL =
  expoApiBase ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'https://mintminepro.com/api';
