# Reels Lock (Android)

A local, native Kotlin/Views utility for a personal Pixel 8 sideload (Android 11/API 30 or newer). It runs alongside the official Instagram app (`com.instagram.android`) and places a lock over the usual fourth item in its five-item bottom bar. The lock consumes taps and gives brief visual/text feedback.

## Install and setup

Build `app/build/outputs/apk/debug/app-debug.apk` with the Gradle command below and install the APK on your phone. On Pixel, Android may block Accessibility activation for sideloaded apps: if prompted/blocked, open **App info → ⋮ → Allow restricted settings** for this trusted personal APK. Then open Reels Lock, enable its Accessibility service in Android Settings, return to the app, then open Instagram. Confirm alignment on your device; use the upward vertical calibration control and dark-background calibration toggle as needed. The vertical offset is stored locally.

## Build and tests

```sh
export JAVA_HOME="$HOME/.local/lib/jvm/jdk-17"
export ANDROID_SDK_ROOT="$HOME/Android/Sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_SDK_ROOT/platform-tools:$PATH"
./gradlew --no-daemon testDebugUnitTest lintDebug assembleDebug
```

## Privacy and limitations

The service subscribes only to window-state events and checks event package metadata to detect Instagram entry/departure. It does not retrieve the active window, accessibility root, or view content. The overlay is an `TYPE_ACCESSIBILITY_OVERLAY` and is removed outside Instagram, on interruption, and on service destruction. There is no Internet permission, account, backend, telemetry, VPN, root, Shizuku, modified Instagram, advertising, or subscription. Alignment depends on Instagram/device layout and should be verified after updates, rotation, and gesture/button navigation changes. Calibration changes appear after the next overlay presentation.

This is an independent utility and is not affiliated with Instagram/Meta.
