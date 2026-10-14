package com.icefrosst.reelslock

/** Screen-coordinate geometry for the bottom navigation cell, using display bounds and safe insets. */
internal object OverlayGeometry {
    data class Rect(val left: Int, val top: Int, val right: Int, val bottom: Int) {
        val width: Int get() = right - left
        val height: Int get() = bottom - top
    }
    data class Insets(val left: Int, val top: Int, val right: Int, val bottom: Int)

    fun tabCell(
        display: Rect,
        leftInset: Int,
        topInset: Int,
        rightInset: Int,
        bottomInset: Int,
        tabHeightPx: Int,
        verticalOffsetPx: Int,
        tabIndex: Int,
        tabCount: Int = 5
    ): Rect {
        require(display.width > 0 && display.height > 0 && tabHeightPx > 0)
        require(tabCount > 0 && tabIndex in 0 until tabCount)
        val safeLeft = (display.left + leftInset).coerceAtMost(display.right)
        val safeTop = (display.top + topInset).coerceAtMost(display.bottom)
        val safeRight = (display.right - rightInset).coerceAtLeast(safeLeft)
        val safeBottom = (display.bottom - bottomInset).coerceAtLeast(safeTop)
        val usableWidth = safeRight - safeLeft
        val cellLeft = safeLeft + usableWidth * tabIndex / tabCount
        val cellRight = safeLeft + usableWidth * (tabIndex + 1) / tabCount
        val height = tabHeightPx.coerceAtMost(safeBottom - safeTop)
        val centerY = (safeBottom - height / 2 + verticalOffsetPx)
            .coerceIn(safeTop + height / 2, safeBottom - (height - height / 2))
        val top = centerY - height / 2
        return Rect(cellLeft, top, cellRight, top + height)
    }
}

/** Ignores null and this app's own events; any other package is an explicit departure signal. */
internal object ForegroundPolicy {
    fun isInstagramEvent(packageName: String?, ownPackage: String, instagramPackage: String): Boolean? =
        when {
            packageName == null || packageName == ownPackage -> null
            packageName == instagramPackage -> true
            else -> false
        }
}

internal object LockPreferences {
    const val NAME = "calibration"
    const val OFFSET_DP = "vertical_offset_dp"
    const val TAB_INDEX = "tab_index"
    const val DARK = "dark_calibration"
}
