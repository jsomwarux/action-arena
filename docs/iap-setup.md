# Season Pass IAP Setup

## Investigation Notes

- `app/(app)/season-pass.tsx` previously had three purchase-related states: non-holder redeem-code flow, pass-holder active state, and a placeholder purchase path.
- The placeholder copy was exposed by `showPurchasePlaceholder` around line 312: "Season Pass purchases are not available yet" and "available after App Store purchase setup is complete."
- The placeholder CTA was exposed around line 382 as `Buy Pass · Soon`, with supporting unavailable copy around line 388.
- The entitlement is stored in Supabase `season_passes`. The client checks it through `useSeasonPass` in `hooks/use-season-pass.ts`, keyed by `user_id + season_year`, and code redemption still goes through the `redeem_season_pass` RPC.
- `app.json` has `ios.bundleIdentifier` set to `com.actionarena.app`.

## Library Choice

This project uses `expo-iap`, the Expo-native OpenIAP package maintained alongside `react-native-iap`.

Reasoning:

- There was no existing IAP scaffold in the repo.
- `react-native-purchases`/RevenueCat would add a third-party entitlement backend for one launch product.
- The current `react-native-iap` package documents that Expo projects should use `expo-iap`; Expo also lists `expo-iap` as a CNG/config-plugin-compatible IAP library.
- `expo-iap` keeps the app on a direct StoreKit flow while fitting Expo SDK 54 and prebuild.

Sources:

- [Expo in-app purchases guide](https://docs.expo.dev/guides/in-app-purchases/)
- [expo-iap setup docs](https://openiap.dev/docs/setup/expo)

## Product ID

Bundle identifier: `com.actionarena.app`

Season Pass product id: `com.actionarena.app.seasonpass.s1`

Register this exact product id in App Store Connect. The app derives the product id from the configured iOS bundle id and never hardcodes the display price; StoreKit provides `displayPrice`.

## Local Code Added

- Client hook: `hooks/use-season-pass-purchase.ts`
- Product constant: `constants/iap.ts`
- Supabase Edge Function: `supabase/functions/validate-season-pass-receipt/index.ts`
- Receipt metadata migration: `supabase/migrations/20260529143000_season_pass_iap_receipts.sql`

The Edge Function is local only. Do not deploy it until the Apple secret is configured.

## Supabase Secrets And Deploy

The function uses Apple's legacy `verifyReceipt` endpoint with an App Store Connect shared secret.

Required secrets:

- `APPLE_IAP_SHARED_SECRET`: App-specific shared secret from App Store Connect.
- `APPLE_IAP_BUNDLE_ID`: `com.actionarena.app`
- `APPLE_IAP_SEASON_PASS_PRODUCT_ID`: `com.actionarena.app.seasonpass.s1`

Supabase already provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions.

Get the app-specific shared secret in App Store Connect:

1. Open App Store Connect.
2. Go to Apps, select Action Arena.
3. Open General > App Information.
4. In App-Specific Shared Secret, click Manage.
5. Generate or copy the 32-character secret.

Apple reference: [Generate a shared secret to verify receipts](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/generate-a-shared-secret-to-verify-receipts/)

Set secrets:

```sh
supabase secrets set \
  APPLE_IAP_SHARED_SECRET="paste-app-specific-shared-secret" \
  APPLE_IAP_BUNDLE_ID="com.actionarena.app" \
  APPLE_IAP_SEASON_PASS_PRODUCT_ID="com.actionarena.app.seasonpass.s1"
```

Deploy after secrets are set:

```sh
supabase functions deploy validate-season-pass-receipt
```

If using a non-linked environment, add `--project-ref <project-ref>` to both commands.

## App Store Connect Setup

Apple references:

- [Overview for configuring In-App Purchases](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases/)
- [In-App Purchase information](https://developer.apple.com/help/app-store-connect/reference/in-app-purchase-information/)

Steps:

1. Confirm Paid Apps agreements, tax, and banking are complete for the Apple Developer account.
2. Confirm the app bundle id is `com.actionarena.app`.
3. Create one In-App Purchase for the app.
4. Type: Non-Consumable.
5. Reference Name: `Season Pass S1`.
6. Product ID: `com.actionarena.app.seasonpass.s1`.
7. Price: set the $9.99 USD price tier/equivalent. The app will show Apple's localized price string.
8. Add at least one localization:
   - Display Name: `Season Pass`
   - Description: `Unlock Season 1 extras`
9. Upload an App Review screenshot showing the Season Pass screen with the purchase CTA, Restore Purchases, and the included perks.
10. Add review notes with:
   - Test account credentials.
   - Product id: `com.actionarena.app.seasonpass.s1`.
   - Purchase path: Season Pass screen.
   - Restore paths: Season Pass screen and Settings > Premium > Restore Purchases.
   - Note that Action Arena has no real-money wagering, no cash out, and the paid item only unlocks cosmetics/analytics/early access/ad-free hooks.
11. Submit the first IAP with the app version. Product metadata can take time to appear in sandbox.

## Sandbox And Device Testing

Apple reference: [Sandbox Testers](https://developer.apple.com/documentation/appstoreconnectapi/sandbox-testers)

- Use a physical iOS device or TestFlight/development build. Expo Go cannot load the native IAP module.
- Create a sandbox tester in App Store Connect under Users and Access > Sandbox.
- On the test device, sign into the sandbox account under Settings > App Store > Sandbox Account.
- Non-consumables can only be bought once per sandbox Apple ID. To retest purchase, clear purchase history for that sandbox tester or create another tester.
- The simulator may fail to fetch real App Store products unless a StoreKit configuration is used. Physical-device sandbox testing is the App Review-relevant path.
- If StoreKit returns no product, verify the product id, bundle id, IAP status, agreements, and wait for App Store Connect propagation.

## Runtime Behavior

- Purchase and restore both validate the Apple receipt server-side before inserting/updating `season_passes`.
- The client never writes `season_passes` directly.
- The function writes receipt metadata and grants Season Pass exclusive cosmetics with the service role.
- Pending purchases are left unfinished until Apple completes them.
- If validation fails after Apple reports a purchase, the transaction is not finished; opening Season Pass and tapping Restore Purchases can retry validation.
