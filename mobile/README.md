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
API_BASE_URL=https://mintminepro.com/api
```
Values are read via `app.config.ts` (Expo extra) and `transform-inline-environment-variables`.

- **Canonical production base:** `https://mintminepro.com/api`
- **Quick reachability check (no auth needed):** `GET https://mintminepro.com/api/public/wallets` should return JSON with publi
c deposit wallets in a browser/Postman.
- **Authenticated check:** `GET https://mintminepro.com/api/wallet/balance` with a valid token/cookie confirms balances are rea
dable. A 401/403 without auth is expected.
- The bare `/api` path may return 404/blank in a browser because only defined JSON routes respond; this is normal.

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

## Pre-publish checklist (keep backend exactly the same)
- Keep `API_BASE_URL` pointed at the existing backend. Do not change endpoints, database schema, or auth rules.
- Confirm the API client attaches auth headers as in `src/services/api/client.ts` and tokens persist via `src/services/storage/tokenStorage.ts`.
- Verify mining/deposit/withdraw flows against the live backend using a test account.
- Replace placeholder icons/splash/logo under `assets/` with your MintMinePro branding.
- Set the app name, `owner`, `slug`, `android.package`, and `ios.bundleIdentifier` in `app.config.ts`.
- Update version fields in `app.config.ts` (`version`, `android.versionCode`, `ios.buildNumber`) before each store upload.
- Ensure permissions list only what you use (by default, Internet; add notifications/camera/etc. only if required).

### Backend safety notes

- **Shared contracts:** Both web and mobile import `types/api-contracts.ts` for request/response shapes. Logic-only backend cha
nges are picked up automatically if endpoints and payloads stay the same.
- **Breaking changes:** If you change endpoint paths, required params, or response fields, update `types/api-contracts.ts` and 
the affected service functions under `src/services/api/`.

## Google Play Console publishing (step-by-step)
1. **Register & access**: Create a Google Play Console developer account and pay the one-time fee.
2. **App listing**: Create a new app, choose default language, app name (e.g., "MintMinePro"), and select app type/content category.
3. **Prepare assets**:
   - App icon (512x512 PNG) and feature graphic (1024x500).
   - Screenshots: Phone (mandatory), tablet if available. Capture real screens from the app.
   - Short & full descriptions that match the web product.
4. **App signing**: Use Play App Signing (recommended). If using EAS, enable `eas build -p android --profile production` and download the generated keystore if you manage it yourself.
5. **Build release**:
   - Ensure `android.package` in `app.config.ts` is unique (e.g., `com.mintminepro.app`).
   - Run `pnpm install` then `pnpm expo:prebuild` if switching from managed to bare; otherwise stay managed.
   - Generate an AAB with `eas build -p android --profile production` (preferred) or `expo build:android --type app-bundle`.
6. **Upload**: In Google Play Console, go to **Production > New release** and upload the AAB.
7. **Policies & content**: Complete Data Safety, Ads declaration, Privacy Policy URL (point to your website), and App Access (provide demo credentials if login needed).
8. **Testing**: (Optional but recommended) Create internal testing track to verify login, mining, deposit/withdraw flows against the live backend.
9. **Rollout**: Submit for review and roll out to production once approved.

## Apple App Store publishing (step-by-step)
1. **Register**: Join the Apple Developer Program (paid annual membership) and ensure you have a Mac for builds/uploads.
2. **App IDs & profiles**:
   - Set `ios.bundleIdentifier` in `app.config.ts` (e.g., `com.mintminepro.app`).
   - In Apple Developer portal, create an App ID matching the bundle ID.
   - Create a Distribution certificate and Provisioning Profile (App Store) or use automatic signing via EAS.
3. **Build release**:
   - On macOS, install Xcode command line tools.
   - Run `pnpm install`.
   - Use EAS: `eas build -p ios --profile production` (managed) to produce an IPA; configure credentials when prompted.
   - If using Transporter/Xcode upload: download the IPA from EAS and upload via Transporter.
4. **App Store Connect listing**:
   - Create the app in App Store Connect with the same bundle ID and app name.
   - Provide app screenshots (iPhone sizes required, iPad optional), app icon (1024x1024), descriptions, keywords, support/marketing URLs, and privacy policy.
   - Set pricing/availability and complete App Privacy questionnaire.
5. **Upload build**: Submit the IPA from EAS/Transporter. Wait for processing, then select it under **TestFlight** or **App Store**.
6. **Review & release**: Fill in compliance (encryption, export) questions, add a demo login account if needed for review, submit for review, then release once approved.

## Useful commands reference
- Install deps: `pnpm install`
- Start dev: `pnpm start`
- Android dev: `pnpm android`
- iOS dev (macOS): `pnpm ios`
- Production Android build (AAB): `eas build -p android --profile production`
- Production iOS build (IPA): `eas build -p ios --profile production`

## Troubleshooting tips
- If auth fails, confirm `API_BASE_URL` matches the web backend and tokens are stored in SecureStore.
- For network errors on device, ensure the backend allows HTTPS and that the device has connectivity; avoid HTTP unless backend supports cleartext (not recommended).
- If store review requests access, create a staging/test account with minimal funds to demonstrate flows without altering the real database.
