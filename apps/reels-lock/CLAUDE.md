# Reels Lock

## Stack
Native Android app using Kotlin, platform Views, AccessibilityService and Gradle 8.9; package `com.icefrosst.reelslock`, target SDK 35. No Compose or external service.

## Conventions
Keep scope within this Android app. Accessibility event handling may read only event package metadata to decide foreground state: never call `getRootInActiveWindow`, retrieve a window, or inspect nodes/content. Use `TYPE_ACCESSIBILITY_OVERLAY` only for Instagram foreground and remove on departure/interruption/destruction. Keep app offline, without `INTERNET` permission, telemetry, account, or backend. Keep the main UI Views-based and update this file's Current state and Next with app changes.

## Data model
No backend or user account. SharedPreferences stores only local calibration: the selected 1–5 tab index, vertical offset in dp, and dark/light marker style.

## Gotchas
Instagram may change its bottom navigation order; position 2 of 5 matches the tested Pixel layout but is configurable locally. Confirm alignment on device and recalibrate. Rotation, display density, nav-bar inset, and differing light/dark appearance need device verification. Minimum supported Android is API 30: display-wide system-bar and cutout insets come from WindowMetrics, never rootWindowInsets on the cell-sized overlay. The small target window opts out of system-bar fitting and requests cutout layout. Pixel `dumpsys window` verifies its parent frame is the full display, so positioning assigns absolute WindowMetrics coordinates without accumulating layout deltas. Insets are refreshed on root inset dispatch and configuration changes. Service listens only to window-state event package metadata and opts out of retrieving window content. Null and self-package metadata are ignored; any other package explicitly ends Instagram foreground state, so SystemUI/notification shade removes the overlay until Instagram reports again.

## Current state
Native app has setup/status/calibration UI, package-metadata-only accessibility state handling, and a touch-consuming window sized to one configurable bottom-tab cell. The cell paints a matching dark/light navigation background and a custom monochrome lock glyph, fully hiding and intercepting the underlying tab without an emoji or badge. Position 2 of 5 is the default after live Pixel testing showed Reels there. Minimum SDK is API 30; system-bar and cutout safe insets come from WindowMetrics. The target window uses absolute full-display coordinates, fixing the accumulating frame-origin drift found on device. Inset dispatch and configuration trigger repositioning; marker styling/sizing refreshes on configuration changes. Calibration offers tab position, an effective zero-to-48dp upward range, and light/dark appearance. Geometry tests cover all five positions, safe insets, cutouts, landscape, density, and upward calibration. Unit/lint/build gates pass. Live Pixel 8 verification confirms the target frame is `216,2211–432,2337`, the lock tap remains on Instagram's home feed, Search and Home taps outside the cell pass through, notification-shade departure removes the overlay, and returning to Instagram restores it. Screenshot sampling confirms both Instagram and the overlay render the dark navigation background as exact RGB `(13,16,20)` / `#0D1014`.

## Next
Recheck alignment, tab position, color, rotation, and foreground restoration after major Instagram or Android updates. If Instagram moves Reels, select its new 1–5 position in Reels Lock; use upward calibration only if the navigation bar moves higher.
