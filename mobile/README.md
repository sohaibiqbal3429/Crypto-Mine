# MintMinePro Mobile (React Native + Expo)

This Expo + TypeScript project mirrors the MintMinePro web dashboard using the existing backend APIs.

## Structure
- `App.tsx`: App entry with navigation + providers.
- `src/navigation`: Root navigator, auth stack, drawer navigation for dashboard sections.
- `src/screens`: Screens for dashboard, mining, wallet actions, tasks, support, FAQs, admin, etc.
- `src/services/api`: Axios client and feature-specific API modules.
- `src/store`: Redux Toolkit store/slices for auth, wallet, and mining.
- `src/components`: Shared UI elements (Card, Icon, ToastProvider).
- `src/styles`: Theme constants.
- `assets`: Replace icon/splash/adaptive assets with brand artwork.

## Environment
Create a `.env` file in `mobile/` with:
```
API_BASE_URL=https://api.mintminepro.com
```
Values are read via `app.config.ts` (Expo extra) and `transform-inline-environment-variables`.

## Running
```bash
cd mobile
pnpm install # or npm install / yarn install
pnpm start   # opens Expo dev server
pnpm android # run on Android emulator/device
pnpm ios     # run on iOS simulator/device (macOS)
```

## Building
- Android: `expo build:android` or `eas build -p android` (for AAB/APK after configuring EAS and package ID).
- iOS: `expo build:ios` or `eas build -p ios` (for IPA after configuring bundle identifier and certificates).

Update bundle IDs (`app.config.ts`), icons, splash, and permissions before publishing.
