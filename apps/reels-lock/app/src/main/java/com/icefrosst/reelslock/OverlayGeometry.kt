package com.icefrosst.reelslock

/** Ignores transient overlays while treating real full-screen app changes as departures. */
internal object ForegroundPolicy {
    fun isInstagramEvent(
        packageName: String?,
        isFullScreen: Boolean?,
        ownPackage: String,
        instagramPackage: String,
        ignoredPackages: Set<String>
    ): Boolean? = when {
        packageName == null || packageName == ownPackage || packageName in ignoredPackages -> null
        packageName == instagramPackage -> true
        isFullScreen == false -> null
        else -> false
    }
}

/** Instagram's dark tab-bar color, measured per selected tab on Pixel 8 screenshots. */
internal object TabColors {
    val TAB_IDS = listOf("feed_tab", "direct_tab", "search_tab", "profile_tab")
    const val HOME_PROFILE = 0xFF0D1014.toInt()
    const val CHAT_SEARCH = 0xFF0C1014.toInt()

    fun patchFor(selectedTabId: String?): Int = when (selectedTabId) {
        "direct_tab", "search_tab" -> CHAT_SEARCH
        else -> HOME_PROFILE
    }
}

/**
 * When Instagram shows HDR media it renders its UI with up to 1.7x HDR headroom, so its bar is
 * brighter (in linear light) than our plain sRGB layer by the display's current HDR/SDR ratio.
 * Brighten our patch by that ratio so both look identical.
 */
internal object HdrMatch {
    const val INSTAGRAM_HEADROOM = 1.7f

    fun brighten(color: Int, hdrSdrRatio: Float): Int {
        val gain = hdrSdrRatio.coerceIn(1f, INSTAGRAM_HEADROOM)
        if (gain <= 1.001f) return color
        fun channel(shift: Int): Int {
            val encoded = ((color shr shift) and 0xFF) / 255.0
            val linear = if (encoded <= 0.04045) encoded / 12.92
            else Math.pow((encoded + 0.055) / 1.055, 2.4)
            val boosted = (linear * gain).coerceAtMost(1.0)
            val out = if (boosted <= 0.0031308) boosted * 12.92
            else 1.055 * Math.pow(boosted, 1 / 2.4) - 0.055
            return (out * 255.0 + 0.5).toInt().coerceIn(0, 255)
        }
        return (0xFF shl 24) or (channel(16) shl 16) or (channel(8) shl 8) or channel(0)
    }
}

internal object LockPreferences {
    const val NAME = "calibration"
    const val DARK = "dark_calibration"
}
