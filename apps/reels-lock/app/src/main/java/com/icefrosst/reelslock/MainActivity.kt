package com.icefrosst.reelslock

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var prefs: android.content.SharedPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences(LockPreferences.NAME, MODE_PRIVATE)
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(28), dp(24), dp(24))
            setBackgroundColor(Color.rgb(255, 248, 255))
        }
        val scroll = ScrollView(this).apply { addView(content) }
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            scroll.setOnApplyWindowInsetsListener { view, insets ->
                val safe = insets.getInsets(android.view.WindowInsets.Type.systemBars() or android.view.WindowInsets.Type.displayCutout())
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
                insets
            }
        }
        setContentView(scroll)
        scroll.requestApplyInsets()
        content.addView(label("Reels Lock", 30, true))
        content.addView(label("Blocks accidental taps on Instagram’s Reels tab. It only uses window package names to know when Instagram is open; it never reads screen content.", 16))
        status = label("", 16, true).also { content.addView(it) }
        content.addView(button("Enable Accessibility Service") {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        })
        content.addView(button("Open Instagram") { openInstagram() })
        content.addView(label("Setup", 20, true))
        content.addView(label("1. Enable Reels Lock in Android Accessibility settings.\n2. Return here and open Instagram.\n3. Check the lock sits on the Reels tab. Use calibration below if needed.", 16))
        content.addView(label("Reels tab position", 18, true))
        content.addView(label("Choose where Reels appears in Instagram’s five-item bottom bar. Changes apply the next time the lock appears.", 14))
        val initialTab = prefs.getInt(LockPreferences.TAB_INDEX, 1).coerceIn(0, 4)
        val tabLabel = label("Position: ${initialTab + 1} of 5", 14)
        content.addView(tabLabel)
        content.addView(SeekBar(this).apply {
            max = 4
            progress = initialTab
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    tabLabel.text = "Position: ${progress + 1} of 5"
                    if (fromUser) prefs.edit().putInt(LockPreferences.TAB_INDEX, progress).apply()
                }
                override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
                override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
            })
        })
        content.addView(label("Vertical calibration", 18, true))
        content.addView(label("Move the marker upward if Instagram’s bar sits higher on your device. Saved on this device.", 14))
        val initial = prefs.getInt(LockPreferences.OFFSET_DP, 0).coerceIn(-48, 0)
        val offsetLabel = label("Offset: ${initial} dp", 14)
        content.addView(offsetLabel)
        content.addView(SeekBar(this).apply {
            max = 48
            progress = initial + 48
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    val value = progress - 48
                    offsetLabel.text = "Offset: $value dp"
                    if (fromUser) prefs.edit().putInt(LockPreferences.OFFSET_DP, value).apply()
                }
                override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
                override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
            })
        })
        content.addView(Switch(this).apply {
            text = "Instagram uses a dark navigation background"
            isChecked = prefs.getBoolean(LockPreferences.DARK, true)
            setOnCheckedChangeListener { _, checked -> prefs.edit().putBoolean(LockPreferences.DARK, checked).apply() }
        })
        content.addView(label("The marker is an accessibility overlay and remains visible only while Instagram is foreground. Android may show its standard accessibility indicator.", 14))
    }

    override fun onResume() {
        super.onResume()
        if (::status.isInitialized) {
            val component = ComponentName(this, ReelsOverlayService::class.java).flattenToString()
            val enabled = Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
                ?.split(':')?.any { it.equals(component, ignoreCase = true) } == true
            status.text = if (enabled) "Status: accessibility service enabled" else "Status: permission not enabled"
        }
    }

    private fun openInstagram() {
        val intent = packageManager.getLaunchIntentForPackage("com.instagram.android")
        if (intent == null) Toast.makeText(this, "Instagram is not installed", Toast.LENGTH_SHORT).show()
        else startActivity(intent)
    }

    private fun label(text: String, size: Int, bold: Boolean = false) = TextView(this).apply {
        this.text = text
        textSize = size.toFloat()
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
        setTextColor(Color.rgb(35, 30, 40))
        setPadding(0, dp(10), 0, dp(10))
    }

    private fun button(text: String, action: () -> Unit) = Button(this).apply {
        this.text = text
        gravity = Gravity.CENTER
        setOnClickListener { action() }
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
