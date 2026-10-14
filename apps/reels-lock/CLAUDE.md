# Reels Lock

## Stack
Native Android app using Kotlin, platform Views, AccessibilityService and Gradle 8.9; package `com.icefrosst.reelslock`, target SDK 35. No Compose or external service.

## Conventions
Keep scope within this Android app. Accessibility event handling may read only event package metadata to decide foreground state: never call `getRootInActiveWindow`, retrieve a window, or inspect nodes/content. Use `TYPE_ACCESSIBILITY_OVERLAY` only for Instagram foreground and remove on departure/interruption/destruction. Keep app offline, without `INTERNET` permission, telemetry, account, or backend. Keep the main UI Views-based and update this file's Current state and Next with app changes.

## Data model
No backend or user account. SharedPreferences stores only local calibration: vertical offset in dp and dark/light marker style.

## Gotchas
Instagram may change its bottom navigation position; the fourth item is a layout convention rather than a stable API. Confirm alignment on device and recalibrate. Rotation, display density, nav-bar inset, and differing light/dark appearance need device verification. Minimum supported Android is API 30: display-wide system-bar and cutout insets come from WindowMetrics, never rootWindowInsets on the cell-sized overlay. The small target window opts out of system-bar fitting and requests cutout layout on API 28+; positioning measures the actual window screen origin and corrects LayoutParams coordinates against it. Insets are refreshed on root inset dispatch, layout, and configuration changes. Service listens only to window-state event package metadata and opts out of retrieving window content. Null and self-package metadata are ignored; any other package explicitly ends Instagram foreground state, so SystemUI/notification shade removes the overlay until Instagram reports again.

## Current state
Native app has setup/status/calibration UI, package-metadata-only accessibility state handling, and a touch-consuming window sized only to the fourth bottom-tab cell. Minimum SDK is API 30; system-bar and cutout safe insets are read from WindowMetrics rather than the small overlay's root insets, and target screen coordinates are converted against the measured window origin. Inset dispatch, layout, and configuration trigger repositioning; marker styling/sizing refreshes on configuration changes. Calibration offers the effective zero-to-48dp upward range (downward movement would enter the protected system-bar area). Geometry tests cover supported-API safe inset placement, cutout-adjusted targets, nonzero window origins, and upward calibration. Unit/lint/build gate passes; Pixel behavior remains unverified.

## Next
Handoff: API 26–29 support was deliberately dropped to avoid deriving display safe bounds from a small overlay's window insets. WindowMetrics safe-inset geometry regression coverage and measured-origin tests are in place; device verification remains necessary, especially pass-through interactions and live Instagram alignment.

Install on Pixel 8 (Android 11/API 30 or newer), enable accessibility service, and test that the fourth cell is blocked while every other Instagram interaction passes through, plus foreground transitions, safe-area alignment, rotation, and calibration. Revise geometry if Instagram's layout differs.
