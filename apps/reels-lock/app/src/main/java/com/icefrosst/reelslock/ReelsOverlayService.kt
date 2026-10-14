package com.icefrosst.reelslock

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Rect
import android.os.Build
import android.os.SystemClock
import android.view.Display
import android.provider.Settings
import android.view.Gravity
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.FrameLayout
import android.widget.Toast
import kotlin.math.roundToInt

class ReelsOverlayService : AccessibilityService() {
    private val defaultInputMethodPackage: String by lazy {
        Settings.Secure.getString(contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)
            ?.substringBefore('/')
            .orEmpty()
    }
    private var overlay: FrameLayout? = null
    private var button: LockIconView? = null
    private var targetBounds: Rect? = null
    private var tabBounds: Rect? = null
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    private var recheckIndex = 0
    private val recheck = object : Runnable {
        override fun run() {
            updateFromInstagramTree()
            if (++recheckIndex < RECHECK_DELAYS_MS.size) {
                handler.postDelayed(this, RECHECK_DELAYS_MS[recheckIndex] - RECHECK_DELAYS_MS[recheckIndex - 1])
            }
        }
    }

    /**
     * Instagram keeps reporting the old tab bar while screen transitions animate, and sends no
     * event once they finish. Re-check shortly after every change so the lock settles with it.
     */
    /** Coalesce bursts of Instagram events into one tree query per frame. */
    private var updatePending = false
    private val coalescedUpdate = Runnable {
        updatePending = false
        updateFromInstagramTree()
    }

    private fun requestUpdate() {
        if (updatePending) return
        updatePending = true
        handler.post(coalescedUpdate)
    }

    private var fastPollUntil = 0L
    private val fastPoll = object : Runnable {
        override fun run() {
            updateFromInstagramTree()
            if (SystemClock.uptimeMillis() < fastPollUntil) handler.postDelayed(this, FAST_POLL_INTERVAL_MS)
        }
    }

    private fun startFastPolling() {
        fastPollUntil = SystemClock.uptimeMillis() + FAST_POLL_WINDOW_MS
        handler.removeCallbacks(fastPoll)
        handler.postDelayed(fastPoll, FAST_POLL_INTERVAL_MS)
    }

    private fun scheduleRechecks() {
        handler.removeCallbacks(recheck)
        recheckIndex = 0
        handler.postDelayed(recheck, RECHECK_DELAYS_MS[0])
    }
    private var patchColor: Int = TabColors.HOME_PROFILE
    private var lastSampleAt = 0L
    private val sampler = java.util.concurrent.Executors.newSingleThreadExecutor()
    @Volatile private var lastEjectAt = 0L
    private var lastSelectedTab: String? = null
    private var samplePending = false
    private var windowManager: WindowManager? = null

    private var hdrSdrRatio = 1f
    private val hdrListener = java.util.function.Consumer<Display> { display ->
        val ratio = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE &&
            display.isHdrSdrRatioAvailable
        ) display.hdrSdrRatio else 1f
        if (kotlin.math.abs(ratio - hdrSdrRatio) > 0.01f) {
            hdrSdrRatio = ratio
            refreshMarkerStyle()
        }
    }

    override fun onServiceConnected() {
        serviceInfo = serviceInfo.apply {
            flags = flags or AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val display = getSystemService(android.hardware.display.DisplayManager::class.java)
                .getDisplay(Display.DEFAULT_DISPLAY)
            if (display.isHdrSdrRatioAvailable) {
                display.registerHdrSdrRatioChangedListener(mainExecutor, hdrListener)
                hdrListener.accept(display)
            }
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        when (ForegroundPolicy.isInstagramEvent(
            event?.packageName?.toString(), event?.isFullScreen, packageName,
            INSTAGRAM_PACKAGE, setOf(SYSTEM_UI_PACKAGE, defaultInputMethodPackage)
        )) {
            true -> {
                requestUpdate()
                scheduleRechecks()
            }
            false -> confirmDeparture()
            null -> Unit
        }
    }

    override fun onInterrupt() = removeOverlay()

    override fun onDestroy() {
        handler.removeCallbacks(recheck)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            getSystemService(android.hardware.display.DisplayManager::class.java)
                .getDisplay(Display.DEFAULT_DISPLAY)
                ?.unregisterHdrSdrRatioChangedListener(hdrListener)
        }
        removeOverlay()
        super.onDestroy()
    }

    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        overlay?.post {
            refreshMarkerStyle()
            updateFromInstagramTree()
        }
    }

    private sealed interface TreeState {
        object Ignore : TreeState
        object Hide : TreeState
        data class Show(val bounds: Rect, val selectedTab: String?) : TreeState
    }

    // Tree queries are answered on Instagram's UI thread and can block for 100ms+ during
    // navigation; run them off our main thread so the lock window itself never stalls.
    private val treeExecutor = java.util.concurrent.Executors.newSingleThreadExecutor()
    private var queryInFlight = false
    private var updateQueuedWhileBusy = false

    /**
     * Another app reported a full-screen window. That is usually leaving Instagram, but taps in
     * the gesture-navigation strip make the Pixel launcher emit such events while Instagram stays
     * in front; hiding then let the next tap reach the real Reels tab. Hide only after confirming
     * that the active window really is no longer Instagram.
     */
    private fun confirmDeparture() {
        treeExecutor.execute {
            val active = try { rootInActiveWindow?.packageName?.toString() } catch (_: RuntimeException) { null }
            if (active == INSTAGRAM_PACKAGE) return@execute
            handler.post {
                handler.removeCallbacks(recheck)
                hideOverlay()
            }
        }
    }

    private fun updateFromInstagramTree() {
        if (queryInFlight) {
            updateQueuedWhileBusy = true
            return
        }
        queryInFlight = true
        treeExecutor.execute {
            val state = try { readTree() } catch (_: RuntimeException) { TreeState.Ignore }
            handler.post {
                queryInFlight = false
                applyTree(state)
                if (updateQueuedWhileBusy) {
                    updateQueuedWhileBusy = false
                    requestUpdate()
                }
            }
        }
    }

    /** Background thread: read Instagram's tree only. */
    private fun readTree(): TreeState {
        val root = rootInActiveWindow ?: return TreeState.Ignore
        // Shade/keyboard/other transient windows can be active; only Instagram's tree decides.
        if (root.packageName?.toString() != INSTAGRAM_PACKAGE) return TreeState.Ignore
        if (leaveReelsIfOpened(root)) return TreeState.Ignore
        // Instagram marks the tab bar not-visible before it drops the Reels node, so this is the
        // earliest tree signal that a screen without the bar is opening.
        if (!hasTabBar(root)) return TreeState.Hide
        // With the bar present, a momentarily missing Reels node (fast tab switching) keeps the lock.
        val bounds = findReelsBounds(root)?.takeIf(::isRestingTabBounds) ?: return TreeState.Ignore
        return TreeState.Show(bounds, selectedTabId(root))
    }

    /** Main thread: apply the result to the lock window. */
    private fun applyTree(state: TreeState) {
        when (state) {
            TreeState.Ignore -> Unit
            TreeState.Hide -> hideOverlay()
            is TreeState.Show -> {
                // Tab changes get an immediate best guess; the screenshot sample then refines it.
                if (state.selectedTab != lastSelectedTab) {
                    lastSelectedTab = state.selectedTab
                    patchColor = TabColors.patchFor(state.selectedTab)
                    refreshMarkerStyle()
                }
                showOverlay(state.bounds)
                scheduleColorSample()
            }
        }
    }

    /** Throttled: Instagram's bar is translucent, so its color drifts while content scrolls. */
    private fun scheduleColorSample() {
        val root = overlay ?: return
        if (samplePending) return
        samplePending = true
        val wait = (lastSampleAt + SAMPLE_INTERVAL_MS - SystemClock.uptimeMillis()).coerceAtLeast(0)
        root.postDelayed({
            samplePending = false
            sampleBarColor()
        }, wait)
    }

    /** Reads one bar pixel beside the lock (inside our transparent cell); nothing is kept. */
    private fun sampleBarColor() {
        if (!shown) return
        val bounds = tabBounds ?: return
        val x0 = bounds.left + dp(6)
        val y0 = bounds.centerY()
        lastSampleAt = SystemClock.uptimeMillis()
        // Decode on a background thread: copying a full-screen bitmap takes ~100ms and would
        // otherwise stall the tree polls that hide the lock when the tab bar disappears.
        takeScreenshot(Display.DEFAULT_DISPLAY, sampler, object : TakeScreenshotCallback {
            override fun onSuccess(result: ScreenshotResult) {
                val buffer = result.hardwareBuffer
                val color = try {
                    val hardware = Bitmap.wrapHardwareBuffer(buffer, result.colorSpace) ?: return
                    val soft = hardware.copy(Bitmap.Config.ARGB_8888, false)
                    hardware.recycle()
                    val c = soft.getPixel(x0.coerceIn(0, soft.width - 1), y0.coerceIn(0, soft.height - 1))
                    soft.recycle()
                    c or 0xFF000000.toInt()
                } finally {
                    buffer.close()
                }
                handler.post {
                    if (overlay != null && shown && color != patchColor) {
                        patchColor = color
                        refreshMarkerStyle()
                    }
                }
            }

            override fun onFailure(errorCode: Int) = Unit
        })
    }

    private fun selectedTabId(root: AccessibilityNodeInfo): String? =
        TabColors.TAB_IDS.firstOrNull { id ->
            root.findAccessibilityNodeInfosByViewId("$INSTAGRAM_PACKAGE:id/$id")
                .any { it.isSelected }
        }

    /**
     * Second line of defence: a tap can land in the brief gap before the lock reappears after a
     * transition. If the Reels tab ever becomes selected, immediately switch Instagram to Home.
     */
    private fun leaveReelsIfOpened(root: AccessibilityNodeInfo): Boolean {
        val reelsSelected = root.findAccessibilityNodeInfosByViewId(REELS_VIEW_ID).any { it.isSelected }
        if (!reelsSelected) return false
        val now = SystemClock.uptimeMillis()
        if (now - lastEjectAt < EJECT_COOLDOWN_MS) return true
        lastEjectAt = now
        val home = root.findAccessibilityNodeInfosByViewId(HOME_VIEW_ID).firstOrNull { it.isClickable }
        if (home?.performAction(AccessibilityNodeInfo.ACTION_CLICK) != true) {
            performGlobalAction(GLOBAL_ACTION_BACK)
        }
        return true
    }

    private fun findReelsBounds(root: AccessibilityNodeInfo): Rect? {
        val byId = root.findAccessibilityNodeInfosByViewId(REELS_VIEW_ID)
            .firstOrNull { it.isVisibleToUser && it.isClickable }
        // The description walk is slow (one IPC per node) and can hit stale nodes mid-transition,
        // so only use it as a fallback while Instagram's tab bar actually exists.
        val target = byId ?: if (hasTabBar(root)) findByDescription(root) else null
        return target?.let {
            Rect().also(it::getBoundsInScreen).takeIf { rect -> !rect.isEmpty }
        }
    }

    private fun hasTabBar(root: AccessibilityNodeInfo): Boolean =
        root.findAccessibilityNodeInfosByViewId(TAB_BAR_VIEW_ID).any { it.isVisibleToUser }

    /** Ignore bounds caught mid-animation (sliding screens), so the lock never flies around. */
    private fun isRestingTabBounds(bounds: Rect): Boolean {
        val screen = (getSystemService(WINDOW_SERVICE) as WindowManager).currentWindowMetrics.bounds
        return bounds.left >= screen.left && bounds.right <= screen.right &&
            bounds.bottom <= screen.bottom && bounds.top >= screen.bottom - screen.height() / 5 &&
            bounds.width() in 1..(screen.width() / 3)
    }

    private fun findByDescription(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        var visited = 0
        while (queue.isNotEmpty() && visited++ < MAX_SEARCHED_NODES) {
            val node = queue.removeFirst()
            if (node.isVisibleToUser && node.isClickable &&
                node.contentDescription?.toString()?.equals("Reels", ignoreCase = true) == true
            ) return node
            for (index in 0 until node.childCount) node.getChild(index)?.let(queue::addLast)
        }
        return null
    }

    private fun showOverlay(bounds: Rect) {
        // Instagram's Reels hit area extends past the visible tab, so shield the whole column
        // from slightly above the tab down to the screen bottom.
        val screenBottom = (getSystemService(WINDOW_SERVICE) as WindowManager)
            .currentWindowMetrics.bounds.bottom
        tabBounds = Rect(bounds)
        targetBounds = Rect(bounds.left, bounds.top - dp(8), bounds.right, maxOf(bounds.bottom, screenBottom))
        if (overlay != null) {
            positionWindow()
            setShown(true)
            return
        }
        val manager = getSystemService(WINDOW_SERVICE) as WindowManager
        val root = FrameLayout(this).apply {
            // A tap elsewhere in Instagram may open a screen without the tab bar. Instagram's
            // accessibility events lag its UI by ~100ms, so poll the live tree right away.
            setOnTouchListener { _, motion ->
                if (motion.actionMasked == android.view.MotionEvent.ACTION_OUTSIDE) startFastPolling()
                false
            }
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
        root.addView(icon, FrameLayout.LayoutParams(dp(36), dp(36), Gravity.TOP or Gravity.CENTER_HORIZONTAL))
        val target = targetBounds!!
        val params = WindowManager.LayoutParams(
            target.width(), target.height(), WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.LEFT
            // Created directly at its final spot with no window animation: nothing flies in.
            x = target.left
            y = target.top
            windowAnimations = 0
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) setFitInsetsTypes(0)
        }
        try {
            manager.addView(root, params)
            shown = true
            windowManager = manager
            overlay = root
            button = icon
            refreshMarkerStyle()
            positionWindow()
        } catch (_: WindowManager.BadTokenException) {
            overlay = null
            button = null
            targetBounds = null
            windowManager = null
        }
    }

    private fun positionWindow() {
        val root = overlay ?: return
        val manager = windowManager ?: return
        val desired = targetBounds ?: return
        val tab = tabBounds ?: return
        // Keep the visible lock centred on the real tab even though the shield is taller.
        button?.let { icon ->
            val lp = icon.layoutParams as FrameLayout.LayoutParams
            val top = tab.centerY() - desired.top - dp(36) / 2
            if (lp.topMargin != top) {
                lp.topMargin = top
                icon.layoutParams = lp
            }
        }
        val params = root.layoutParams as WindowManager.LayoutParams
        if (params.width != desired.width() || params.height != desired.height() ||
            params.x != desired.left || params.y != desired.top
        ) {
            params.width = desired.width()
            params.height = desired.height()
            params.x = desired.left
            params.y = desired.top
            manager.updateViewLayout(root, params)
        }
    }

    private fun refreshMarkerStyle() {
        val icon = button ?: return
        val dark = getSharedPreferences(LockPreferences.NAME, MODE_PRIVATE)
            .getBoolean(LockPreferences.DARK, true)
        overlay?.setBackgroundColor(Color.TRANSPARENT)
        icon.setColors(
            if (dark) 0xFFF5F5F5.toInt() else 0xFF111111.toInt(),
            if (dark) HdrMatch.brighten(patchColor, hdrSdrRatio) else Color.WHITE
        )
        icon.layoutParams = icon.layoutParams.apply { width = dp(36); height = dp(36) }
    }

    private var shown = false

    /** Hidden = invisible and touch-transparent, but the window stays so re-showing is instant. */
    private fun setShown(visible: Boolean) {
        val root = overlay ?: return
        val manager = windowManager ?: return
        if (shown == visible && root.visibility == (if (visible) android.view.View.VISIBLE else android.view.View.INVISIBLE)) return
        shown = visible
        root.visibility = if (visible) android.view.View.VISIBLE else android.view.View.INVISIBLE
        val params = root.layoutParams as WindowManager.LayoutParams
        params.flags = if (visible) {
            params.flags and WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE.inv()
        } else {
            params.flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
        }
        manager.updateViewLayout(root, params)
    }

    private fun hideOverlay() = setShown(false)

    private fun removeOverlay() {
        shown = false
        val root = overlay ?: run {
            targetBounds = null
            return
        }
        try {
            (windowManager ?: getSystemService(WINDOW_SERVICE) as WindowManager).removeView(root)
        } catch (_: IllegalArgumentException) {
        }
        overlay = null
        button = null
        targetBounds = null
        tabBounds = null
        windowManager = null
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()

    companion object {
        private const val INSTAGRAM_PACKAGE = "com.instagram.android"
        private const val SYSTEM_UI_PACKAGE = "com.android.systemui"
        private const val REELS_VIEW_ID = "com.instagram.android:id/clips_tab"
        private const val HOME_VIEW_ID = "com.instagram.android:id/feed_tab"
        private const val TAB_BAR_VIEW_ID = "com.instagram.android:id/tab_bar"
        private const val EJECT_COOLDOWN_MS = 600L
        private const val MAX_SEARCHED_NODES = 500
        private const val SAMPLE_INTERVAL_MS = 400L
        private val RECHECK_DELAYS_MS = longArrayOf(100, 250, 500)
        private const val FAST_POLL_INTERVAL_MS = 32L
        private const val FAST_POLL_WINDOW_MS = 600L
    }
}
