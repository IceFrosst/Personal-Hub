package com.icefrosst.reelslock

import android.accessibilityservice.AccessibilityService
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.FrameLayout
import android.widget.Toast
import kotlin.math.roundToInt

class ReelsOverlayService : AccessibilityService() {
    private var overlay: FrameLayout? = null
    private var button: LockIconView? = null
    private var windowManager: WindowManager? = null

    override fun onServiceConnected() { serviceInfo = serviceInfo.apply { flags = 0 } }
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        when (ForegroundPolicy.isInstagramEvent(event?.packageName?.toString(), packageName, INSTAGRAM_PACKAGE)) {
            true -> showOverlay()
            false -> removeOverlay()
            null -> Unit
        }
    }
    override fun onInterrupt() = removeOverlay()
    override fun onDestroy() { removeOverlay(); super.onDestroy() }

    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        overlay?.post { refreshMarkerStyle(); positionWindow() }
    }

    private fun showOverlay() {
        if (overlay != null) return
        val manager = getSystemService(WINDOW_SERVICE) as WindowManager
        val root = FrameLayout(this).apply {
            isClickable = true
            isFocusable = false
            setBackgroundColor(Color.TRANSPARENT)
            setOnClickListener {
                val icon = button ?: return@setOnClickListener
                icon.animate().cancel()
                icon.scaleX = 1f
                icon.scaleY = 1f
                icon.animate().scaleX(0.82f).scaleY(0.82f).setDuration(90).withEndAction {
                    icon.animate().scaleX(1f).scaleY(1f).setDuration(100).start()
                }.start()
                Toast.makeText(this@ReelsOverlayService, "Reels is locked", Toast.LENGTH_SHORT).show()
            }
        }
        val icon = LockIconView(this).apply {
            contentDescription = "Reels locked"
            isClickable = false
            isFocusable = false
        }
        root.addView(icon, FrameLayout.LayoutParams(dp(48), dp(48), Gravity.CENTER))
        val params = WindowManager.LayoutParams(
            1, 1, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.LEFT
            // Do not let the system inset/rebase this target window around a display cutout.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) setFitInsetsTypes(0)
        }
        try {
            manager.addView(root, params)
            windowManager = manager
            overlay = root
            button = icon
            refreshMarkerStyle()
            root.setOnApplyWindowInsetsListener { _, insets ->
                root.post { positionWindow() }
                insets
            }
            root.post { positionWindow() }
        } catch (_: WindowManager.BadTokenException) {
            overlay = null
            button = null
            windowManager = null
        }
    }

    private fun positionWindow() {
        val root = overlay ?: return
        val manager = windowManager ?: return
        val bounds = manager.currentWindowMetrics.bounds
        val insets = readInsets()
        val prefs = getSharedPreferences(LockPreferences.NAME, MODE_PRIVATE)
        val desired = OverlayGeometry.tabCell(
            OverlayGeometry.Rect(bounds.left, bounds.top, bounds.right, bounds.bottom),
            insets.left, insets.top, insets.right, insets.bottom, dp(48),
            (prefs.getInt(LockPreferences.OFFSET_DP, DEFAULT_OFFSET_DP) * resources.displayMetrics.density).roundToInt(),
            prefs.getInt(LockPreferences.TAB_INDEX, 1).coerceIn(0, 4)
        )
        val params = root.layoutParams as WindowManager.LayoutParams
        if (params.width != desired.width || params.height != desired.height ||
            params.x != desired.left || params.y != desired.top
        ) {
            params.width = desired.width
            params.height = desired.height
            // This overlay opts out of inset fitting, and dumpsys verifies its parent frame is
            // the full display. Assign absolute coordinates; never accumulate layout deltas.
            params.x = desired.left
            params.y = desired.top
            manager.updateViewLayout(root, params)
        }
    }

    private fun readInsets(): OverlayGeometry.Insets {
        // minSdk 30: query display/window metrics directly. rootWindowInsets on this
        // cell-sized overlay describes only that overlay's overlap with system bars.
        val metrics = windowManager?.currentWindowMetrics ?: return OverlayGeometry.Insets(0, 0, 0, 0)
        val value = metrics.windowInsets.getInsets(
            WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout()
        )
        return OverlayGeometry.Insets(value.left, value.top, value.right, value.bottom)
    }

    private fun refreshMarkerStyle() {
        val icon = button ?: return
        val dark = getSharedPreferences(LockPreferences.NAME, MODE_PRIVATE).getBoolean(LockPreferences.DARK, true)
        overlay?.setBackgroundColor(if (dark) INSTAGRAM_DARK else Color.WHITE)
        icon.setIconColor(if (dark) 0xFFF5F5F5.toInt() else 0xFF111111.toInt())
        icon.layoutParams = icon.layoutParams.apply { width = dp(40); height = dp(40) }
    }

    private fun removeOverlay() {
        val root = overlay ?: return
        try { (windowManager ?: getSystemService(WINDOW_SERVICE) as WindowManager).removeView(root) }
        catch (_: IllegalArgumentException) { }
        overlay = null
        button = null
        windowManager = null
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()
    companion object {
        private const val INSTAGRAM_PACKAGE = "com.instagram.android"
        private const val DEFAULT_OFFSET_DP = 0
        private const val INSTAGRAM_DARK = 0xFF0D1014.toInt()
    }
}
