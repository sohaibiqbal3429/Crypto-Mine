import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MintMinePro',
  slug: 'mintminepro',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'mintminepro',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0f172a'
  },
  extra: {
    eas: {
      projectId: 'replace-with-eas-project-id'
    },
    apiBaseUrl: process.env.API_BASE_URL
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.mintminepro.app'
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0f172a'
    },
    package: 'com.mintminepro.app'
  },
  plugins: [
    [
      'expo-secure-store',
      {
        faceIDPermission: 'Allow MintMinePro to use Face ID for secure login.'
      }
    ]
  ]
});
