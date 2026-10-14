package com.icefrosst.reelslock

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.view.View

/** Small monochrome lock glyph so the overlay matches Instagram instead of showing an emoji badge. */
internal class LockIconView(context: Context) : View(context) {
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private var iconColor: Int = 0

    fun setIconColor(color: Int) {
        iconColor = color
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        val unit = minOf(w, h)
        stroke.color = iconColor
        stroke.strokeWidth = unit * 0.055f
        fill.color = iconColor

        val body = RectF(w * 0.25f, h * 0.46f, w * 0.75f, h * 0.80f)
        canvas.drawRoundRect(body, unit * 0.07f, unit * 0.07f, stroke)
        val shackle = RectF(w * 0.34f, h * 0.20f, w * 0.66f, h * 0.58f)
        canvas.drawArc(shackle, 180f, 180f, false, stroke)
        canvas.drawCircle(w * 0.5f, h * 0.61f, unit * 0.035f, fill)
        canvas.drawLine(w * 0.5f, h * 0.64f, w * 0.5f, h * 0.70f, stroke)
    }
}
