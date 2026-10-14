package com.icefrosst.reelslock

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OverlayGeometryTest {
    @Test fun api30DisplayMetricsSafeInsetsPositionPortraitTargetInsideSystemBars() {
        val rect = OverlayGeometry.tabCell(
            OverlayGeometry.Rect(0, 0, 1080, 2400), 0, 72, 0, 90, 168, 0, 1
        )
        assertEquals(216, rect.left)
        assertEquals(432, rect.right)
        assertEquals(2142, rect.top)
        assertEquals(2310, rect.bottom)
        assertTrue(rect.top >= 72)
        assertTrue(rect.bottom <= 2400 - 90)
    }

    @Test fun pixel8VerifiedFrameMatchesLiveWindowEvidence() {
        val rect = OverlayGeometry.tabCell(
            OverlayGeometry.Rect(0, 0, 1080, 2400), 0, 63, 0, 63, 126, 0, 1
        )
        assertEquals(OverlayGeometry.Rect(216, 2211, 432, 2337), rect)
    }

    @Test fun eachTabPositionMapsToItsOwnFifth() {
        val display = OverlayGeometry.Rect(0, 0, 1000, 2000)
        for (index in 0..4) {
            val rect = OverlayGeometry.tabCell(display, 0, 0, 0, 80, 56, 0, index)
            assertEquals(index * 200, rect.left)
            assertEquals((index + 1) * 200, rect.right)
        }
    }

    @Test fun landscapeThreeButtonSideInsetMovesCellAndSafeArea() {
        val rect = OverlayGeometry.tabCell(
            OverlayGeometry.Rect(0, 0, 2400, 1080), 90, 0, 0, 84, 168, 0, 1
        )
        assertEquals(552, rect.left)
        assertEquals(1014, rect.right)
        assertEquals(828, rect.top)
        assertEquals(996, rect.bottom)
    }

    @Test fun densityScaledCalibrationMovesWholeTargetWithinSafeBounds() {
        val densityOne = OverlayGeometry.tabCell(
            OverlayGeometry.Rect(0, 0, 1000, 2000), 0, 24, 0, 80, 56, -12, 1
        )
        val densityThree = OverlayGeometry.tabCell(
            OverlayGeometry.Rect(0, 0, 3000, 6000), 0, 72, 0, 240, 168, -36, 1
        )
        assertEquals(densityOne.top * 3, densityThree.top)
        assertEquals(densityOne.bottom * 3, densityThree.bottom)
        assertEquals(1852, densityOne.top)
    }

    @Test fun landscapeCutoutAndBothSideInsetsApplyExactlyOnce() {
        val rect = OverlayGeometry.tabCell(
            OverlayGeometry.Rect(0, 0, 1200, 800), 40, 30, 60, 20, 100, 0, 1
        )
        assertEquals(260, rect.left)
        assertEquals(480, rect.right)
        assertEquals(680, rect.top)
        assertEquals(780, rect.bottom)
    }

    @Test fun zeroOffsetAlignsToSafeBottomAndNegativeOffsetMovesUpward() {
        val baseline = OverlayGeometry.tabCell(
            OverlayGeometry.Rect(0, 0, 1000, 1000), 0, 40, 0, 80, 100, 0, 1
        )
        val raised = OverlayGeometry.tabCell(
            OverlayGeometry.Rect(0, 0, 1000, 1000), 0, 40, 0, 80, 100, -48, 1
        )
        assertEquals(920, baseline.bottom)
        assertEquals(872, raised.bottom)
        assertEquals(baseline.top - 48, raised.top)
    }

    @Test fun foregroundPolicyTracksInstagramDepartureButIgnoresNullAndOwnEvents() {
        assertTrue(ForegroundPolicy.isInstagramEvent("com.instagram.android", "com.icefrosst.reelslock", "com.instagram.android")!!)
        assertFalse(ForegroundPolicy.isInstagramEvent("com.android.systemui", "com.icefrosst.reelslock", "com.instagram.android")!!)
        assertNull(ForegroundPolicy.isInstagramEvent(null, "com.icefrosst.reelslock", "com.instagram.android"))
        assertNull(ForegroundPolicy.isInstagramEvent("com.icefrosst.reelslock", "com.icefrosst.reelslock", "com.instagram.android"))
        assertTrue(ForegroundPolicy.isInstagramEvent("com.instagram.android", "com.icefrosst.reelslock", "com.instagram.android")!!)
    }
}
