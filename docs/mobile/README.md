# Mobile release playbook

## Updating APK metadata

1. Upload the generated `app-release.apk` from `mobile/android/app/build/outputs/apk/release/` to the CDN bucket.
2. Capture the public HTTPS URL and update the following environment variables before redeploying the Next.js site:

   ```bash
   MOBILE_APK_DOWNLOAD_URL="https://cdn.example.com/crypto-mine/app-release.apk"
   MOBILE_APK_VERSION="1.2.0"
   MOBILE_APK_FILE_SIZE_MB="47.8"
   MOBILE_APK_BUILD_DATE="2024-12-01T10:23:00Z"
   MOBILE_APK_RELEASE_NOTES="- Added instant balance refresh\n- Improved withdrawal insights"
   ```

3. Optionally adjust `MOBILE_APK_METADATA_POLL_MS` (milliseconds) if you want the SWR cache to refresh more or less frequently.
4. Deploy the website – clients will pick up the new metadata on the next focus event or at the configured interval.

## Generating signed releases

```bash
cd mobile
npm install
cd android
./gradlew assembleRelease \
  -PRELEASE_STORE_FILE="/path/to/keystore.jks" \
  -PRELEASE_STORE_PASSWORD="******" \
  -PRELEASE_KEY_ALIAS="cryptomine" \
  -PRELEASE_KEY_PASSWORD="******"
```

The command outputs both the unsigned and aligned release APK. Only the aligned `app-release.apk` should be distributed.

## Real-time sync

- React Query polls the `/api/dashboard`, `/api/wallet/withdraw-history`, and `/api/auth/me` endpoints every 15 seconds by default.
- When the app re-enters the foreground the queries revalidate immediately.
- The wallet context is exposed through `/api/wallet/context` so the native app can render the same stats as the web withdrawal screen.
