package com.icefrosst.reelslock

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OverlayGeometryTest {
    @Test fun api30DisplayMetricsSafeInsetsPositionPortraitTargetInsideSystemBars() {
        // These are the systemBars|displayCutout insets queried from WindowMetrics,
        // not rootWindowInsets from the small overlay window.
        val rect = OverlayGeometry.fourthCell(OverlayGeometry.Rect(0, 0, 1080, 2400), 0, 72, 0, 90, 168, 0)
        assertEquals(648, rect.left)
        assertEquals(864, rect.right)
        assertEquals(2142, rect.top)
        assertEquals(2310, rect.bottom)
        assertTrue(rect.top >= 72)
        assertTrue(rect.bottom <= 2400 - 90)
    }

    @Test fun landscapeThreeButtonSideInsetMovesCellAndSafeArea() {
        val rect = OverlayGeometry.fourthCell(OverlayGeometry.Rect(0, 0, 2400, 1080), 90, 0, 0, 84, 168, 0)
        assertEquals(1476, rect.left)
        assertEquals(1938, rect.right)
        assertEquals(828, rect.top)
        assertEquals(996, rect.bottom)
    }

    @Test fun densityScaledCalibrationMovesWholeTargetWithinSafeBounds() {
        val densityOne = OverlayGeometry.fourthCell(OverlayGeometry.Rect(0, 0, 1000, 2000), 0, 24, 0, 80, 56, -12)
        val densityThree = OverlayGeometry.fourthCell(OverlayGeometry.Rect(0, 0, 3000, 6000), 0, 72, 0, 240, 168, -36)
        assertEquals(densityOne.top * 3, densityThree.top)
        assertEquals(densityOne.bottom * 3, densityThree.bottom)
        assertEquals(1852, densityOne.top)
    }

    @Test fun landscapeCutoutAndBothSideInsetsApplyExactlyOnce() {
        val rect = OverlayGeometry.fourthCell(OverlayGeometry.Rect(0, 0, 1200, 800), 40, 30, 60, 20, 100, 0)
        assertEquals(700, rect.left)
        assertEquals(920, rect.right)
        assertEquals(680, rect.top)
        assertEquals(780, rect.bottom)
    }

    @Test fun screenTargetIsConvertedAgainstMeasuredNonzeroOverlayFrameOrigin() {
        val screenTarget = OverlayGeometry.Rect(700, 680, 920, 780)
        val local = OverlayGeometry.toFrameCoordinates(screenTarget, 40, 30)
        assertEquals(660, local.left)
        assertEquals(650, local.top)
        assertEquals(880, local.right)
        assertEquals(750, local.bottom)
        assertEquals(screenTarget.width, local.width)
        assertEquals(screenTarget.height, local.height)
    }

    @Test fun fullDisplayOriginWithLandscapeCutoutProducesExpectedFrameLocalHitRegion() {
        val target = OverlayGeometry.fourthCell(OverlayGeometry.Rect(0, 0, 1200, 800), 40, 30, 60, 20, 100, 0)
        val frameLocal = OverlayGeometry.toFrameCoordinates(target, 0, 0)
        assertEquals(OverlayGeometry.Rect(700, 680, 920, 780), frameLocal)
    }

    @Test fun zeroOffsetAlignsToSafeBottomAndNegativeOffsetMovesUpward() {
        val baseline = OverlayGeometry.fourthCell(OverlayGeometry.Rect(0, 0, 1000, 1000), 0, 40, 0, 80, 100, 0)
        val raised = OverlayGeometry.fourthCell(OverlayGeometry.Rect(0, 0, 1000, 1000), 0, 40, 0, 80, 100, -48)
        assertEquals(920, baseline.bottom)
        assertEquals(872, raised.bottom)
        assertEquals(baseline.top - 48, raised.top)
    }

    @Test fun foregroundPolicyTracksInstagramDepartureButIgnoresNullAndOwnEvents() {
        assertTrue(ForegroundPolicy.isInstagramEvent("com.instagram.android", "com.icefrosst.reelslock", "com.instagram.android")!!)
        assertFalse(ForegroundPolicy.isInstagramEvent("com.android.systemui", "com.icefrosst.reelslock", "com.instagram.android")!!)
        assertNull(ForegroundPolicy.isInstagramEvent(null, "com.icefrosst.reelslock", "com.instagram.android"))
        assertNull(ForegroundPolicy.isInstagramEvent("com.icefrosst.reelslock", "com.icefrosst.reelslock", "com.instagram.android"))
        assertFalse(ForegroundPolicy.isInstagramEvent("com.android.systemui", "com.icefrosst.reelslock", "com.instagram.android")!!)
        assertTrue(ForegroundPolicy.isInstagramEvent("com.instagram.android", "com.icefrosst.reelslock", "com.instagram.android")!!)
    }
}