# Reels Lock

## Stack
Native Android app using Kotlin, platform Views, AccessibilityService and Gradle 8.9; package `com.icefrosst.reelslock`, min SDK 30, target SDK 35. No Compose, network, or external service.

## Conventions
Keep scope within this Android app. The accessibility service may read Instagram's accessibility tree only to locate the Reels tab (`com.instagram.android:id/clips_tab`, fallback content description `Reels`) and its screen bounds. Never read, log, store, or transmit other content. Keep the app offline: no `INTERNET` permission, telemetry, account, or backend. Update this file's Current state and Next with app changes.

## Data model
No backend or account. SharedPreferences stores only the dark/light lock-patch style (default dark).

## Gotchas
- Android stops an accessibility service whenever the APK is replaced or its capabilities change; toggle Reels Lock off/on in Accessibility settings after reinstalling.
- Foreground policy: Instagram events show/update the lock; System UI (notification shade), the default keyboard, the app itself, and non-full-screen windows are ignored as transient; other full-screen app windows remove it.
- The service subscribes to window-state and window-content events so the lock tracks tab-bar visibility; Instagram hides its tab bar on profiles, detail pages, and while typing, and the lock disappears with it.
- Instagram's bar color drifts by tab and while scrolling (translucent bar), so the service samples one bar pixel beside the lock via the accessibility screenshot API (`canTakeScreenshot`, throttled to 400ms, nothing stored) and paints only a 36dp icon patch that color; the rest of the shield is transparent. Per-tab guesses (`TabColors`) bridge the gap until the first sample.
- HDR: when Instagram's feed shows HDR media it renders with `desiredHdrHeadroom=1.7`, so the display dims plain sRGB layers (SurfaceFlinger `dimmingRatio` 0.588) relative to Instagram's undimmed layer. Screenshots can't show this (pre-composition). `HdrMatch` brightens the patch in linear light by the display's live HDR/SDR ratio (capped at 1.7). Do **not** set the overlay window to `COLOR_MODE_HDR`: that requests unlimited headroom, boosts the whole panel, and mismatches non-HDR tabs.
- Touch shield spans the Reels column from 8dp above the tab to the screen bottom, because Instagram's Reels hit area extends below the visible tab; the lock glyph stays centred on the real tab.
- Instagram keeps reporting the old tab bar during screen transitions and sends no event when they end, so every Instagram event schedules tree re-checks at 100/250/500ms. Re-checks ignore non-Instagram active windows (e.g. the notification shade) so they can't remove the lock behind it.
- `adb shell settings put secure enabled_accessibility_services` (null, then the component) rebinds the service after a reinstall without touching the phone.
- If Instagram renames `clips_tab`, the content-description fallback still finds the tab; if both change, update `REELS_VIEW_ID` in `ReelsOverlayService`.

## Current state
The lock is positioned from Instagram's live Reels-tab node bounds. Live Pixel 8 verification: shield `[216,2190][432,2400]` over `clips_tab`; taps on and below the tab don't open Reels; lock stays through tab switching, notification shade, and keyboard; disappears on the first event when opening Followers and returns ~100ms after going back; hidden wherever the tab bar is hidden; removed when leaving Instagram. With HDR active on Home, SurfaceFlinger shows Instagram at 159-nit white vs our 93.5-nit layer; the compensated patch (`20,23,28` vs bar `13,16,20`) matches emitted light within ~2%. Unit/lint/build gate passes.

## Next
After major Instagram updates, confirm the Reels tab is still found (lock appears) and recheck the patch color.
