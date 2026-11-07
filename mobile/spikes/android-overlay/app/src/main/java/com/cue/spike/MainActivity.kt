package com.cue.spike

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** Setup steps for the test, a practice field, and the findings log. */
class MainActivity : Activity() {

    private lateinit var log: TextView
    private lateinit var overlayStatus: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = dp(20)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, dp(48), pad, pad)
            setBackgroundColor(Color.parseColor("#FAF9F5"))
        }

        root.addView(text("Cue Android test", 26f, bold = true))
        root.addView(text("Checks whether the bubble can read other apps and put answers into them. Answers are fixed test text; no AI, nothing leaves the phone.", 14f))

        overlayStatus = text("", 13f)
        root.addView(overlayStatus)
        root.addView(button("1. Allow display over other apps") {
            startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
        })
        root.addView(button("2. Start the bubble (asks to capture the screen)") { startBubble() })
        root.addView(button("Stop the bubble") { BubbleService.stop(this) })

        root.addView(text("Optional, to compare insert methods", 15f, bold = true).apply { setPadding(0, dp(16), 0, 0) })
        root.addView(button("3. Turn on accessibility (method B)") {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        })
        root.addView(button("4. Turn on the Cue keyboard (method C)") {
            startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
        })

        root.addView(text("Practice field", 15f, bold = true).apply { setPadding(0, dp(16), 0, 0) })
        root.addView(EditText(this).apply { hint = "What's a shower thought you recently had?" })

        root.addView(text("Findings log", 15f, bold = true).apply { setPadding(0, dp(16), 0, 0) })
        val logButtons = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        logButtons.addView(button("Refresh", weight = true) { refreshLog() })
        logButtons.addView(button("Share", weight = true) { shareLog() })
        logButtons.addView(button("Clear", weight = true) { SpikeLog.clear(this); refreshLog() })
        root.addView(logButtons)
        log = text("", 12f).apply { typeface = Typeface.MONOSPACE; setTextIsSelectable(true) }
        root.addView(log)

        setContentView(ScrollView(this).apply { addView(root) })

        if (Build.VERSION.SDK_INT >= 33) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIFY)
    }

    override fun onResume() {
        super.onResume()
        overlayStatus.text = if (Settings.canDrawOverlays(this)) "Display over other apps: allowed" else "Display over other apps: not allowed yet"
        refreshLog()
    }

    private fun startBubble() {
        if (!Settings.canDrawOverlays(this)) {
            overlayStatus.text = "Do step 1 first."
            return
        }
        val n = SpikeLog.bump(this, "consent_prompts")
        SpikeLog.add(this, "Asking for screen capture consent (prompt #$n on this install)")
        val mpm = getSystemService(MediaProjectionManager::class.java)
        @Suppress("DEPRECATION")
        startActivityForResult(mpm.createScreenCaptureIntent(), REQ_CAPTURE)
    }

    @Deprecated("Activity result API is fine for a throwaway test")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_CAPTURE) return
        if (resultCode != RESULT_OK || data == null) {
            SpikeLog.add(this, "FINDING screen capture consent declined")
            refreshLog()
            return
        }
        SpikeLog.add(this, "Screen capture consent granted")
        BubbleService.start(this, resultCode, data)
        moveTaskToBack(true)
    }

    private fun refreshLog() {
        log.text = SpikeLog.read(this).ifEmpty { "Nothing yet." }
    }

    private fun shareLog() {
        startActivity(Intent.createChooser(
            Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, SpikeLog.read(this)),
            "Share Cue test log",
        ))
    }

    private fun text(value: String, size: Float, bold: Boolean = false) = TextView(this).apply {
        text = value
        textSize = size
        setTextColor(Color.parseColor("#141413"))
        if (bold) typeface = Typeface.DEFAULT_BOLD
        setPadding(0, dp(4), 0, dp(4))
    }

    private fun button(label: String, weight: Boolean = false, onClick: (View) -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        setOnClickListener(onClick)
        if (weight) layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    companion object {
        private const val REQ_CAPTURE = 1
        private const val REQ_NOTIFY = 2
    }
}
