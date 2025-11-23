import Constants from 'expo-constants';

export const API_BASE_URL = (Constants?.expoConfig?.extra as any)?.apiBaseUrl || process.env.API_BASE_URL;
