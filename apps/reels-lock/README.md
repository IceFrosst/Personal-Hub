# Reels Lock (Android)

A personal, offline Kotlin utility (Android 11/API 30+) that runs beside the official Instagram app and replaces its Reels tab with a lock. Taps on the tab are consumed, so Reels cannot be opened from the navigation bar.

## How it works

An Accessibility Service locally finds Instagram's Reels tab (`clips_tab`) and its screen bounds, then places a touch-consuming accessibility overlay exactly over it. The lock follows the real tab and disappears on Instagram screens where the tab bar is hidden, and whenever you leave Instagram.

## Install and setup

Build `app/build/outputs/apk/debug/app-debug.apk` and install it. If Android blocks enabling the service for a sideloaded app, use **App info → ⋮ → Allow restricted settings**. Then enable **Reels Lock** in Accessibility settings and open Instagram. After every reinstall, toggle the service off and on.

## Build and tests

```sh
export JAVA_HOME="$HOME/.local/lib/jvm/jdk-17"
export ANDROID_SDK_ROOT="$HOME/Android/Sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_SDK_ROOT/platform-tools:$PATH"
./gradlew --no-daemon testDebugUnitTest lintDebug assembleDebug
```

## Privacy

The service can read Instagram's accessibility tree but uses it only to locate the Reels tab and its bounds, and reads one bar pixel from an accessibility screenshot to match colors. Nothing is logged, stored, or transmitted; the app has no Internet permission, account, telemetry, VPN, root, or modified Instagram. Not affiliated with Instagram/Meta.
