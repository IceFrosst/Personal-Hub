package com.icefrosst.reelslock

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OverlayGeometryTest {
    @Test fun hdrMatchKeepsSdrAndBrightensByRatio() {
        val bar = 0xFF0C1014.toInt()
        org.junit.Assert.assertEquals(bar, HdrMatch.brighten(bar, 1f))
        val boosted = HdrMatch.brighten(bar, 1.7f)
        org.junit.Assert.assertTrue(((boosted shr 16) and 0xFF) > 0x0C)
        org.junit.Assert.assertTrue((boosted and 0xFF) > 0x14)
        // Ratios above Instagram's 1.7 headroom are capped.
        org.junit.Assert.assertEquals(boosted, HdrMatch.brighten(bar, 5f))
    }

    @Test fun patchColorFollowsSelectedTab() {
        org.junit.Assert.assertEquals(TabColors.HOME_PROFILE, TabColors.patchFor("feed_tab"))
        org.junit.Assert.assertEquals(TabColors.HOME_PROFILE, TabColors.patchFor("profile_tab"))
        org.junit.Assert.assertEquals(TabColors.CHAT_SEARCH, TabColors.patchFor("direct_tab"))
        org.junit.Assert.assertEquals(TabColors.CHAT_SEARCH, TabColors.patchFor("search_tab"))
        org.junit.Assert.assertEquals(TabColors.HOME_PROFILE, TabColors.patchFor(null))
    }

    @Test fun foregroundPolicyTracksRealDepartureButIgnoresTransientWindows() {
        val own = "com.icefrosst.reelslock"
        val instagram = "com.instagram.android"
        val systemUi = "com.android.systemui"
        val keyboard = "com.google.android.inputmethod.latin"
        val ignored = setOf(systemUi, keyboard)

        assertTrue(ForegroundPolicy.isInstagramEvent(instagram, true, own, instagram, ignored)!!)
        assertTrue(ForegroundPolicy.isInstagramEvent(instagram, false, own, instagram, ignored)!!)
        assertFalse(ForegroundPolicy.isInstagramEvent("com.google.android.apps.nexuslauncher", true, own, instagram, ignored)!!)
        assertFalse(ForegroundPolicy.isInstagramEvent("com.android.settings", true, own, instagram, ignored)!!)
        assertNull(ForegroundPolicy.isInstagramEvent(keyboard, true, own, instagram, ignored))
        assertNull(ForegroundPolicy.isInstagramEvent("com.example.popup", false, own, instagram, ignored))
        assertNull(ForegroundPolicy.isInstagramEvent(systemUi, true, own, instagram, ignored))
        assertNull(ForegroundPolicy.isInstagramEvent(null, null, own, instagram, ignored))
        assertNull(ForegroundPolicy.isInstagramEvent(own, true, own, instagram, ignored))
    }
}
