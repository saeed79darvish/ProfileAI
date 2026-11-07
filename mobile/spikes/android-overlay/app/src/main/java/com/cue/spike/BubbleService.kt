package com.cue.spike

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import kotlin.math.abs

/**
 * The bubble that floats over every app. Tap: hide the bubble, grab the newest
 * screen frame, read it on the phone, show a panel with what was found and the
 * three ways to put an answer into the app underneath.
 */
class BubbleService : Service() {

    private val main = Handler(Looper.getMainLooper())
    private lateinit var wm: WindowManager
    private var capturer: ScreenCapturer? = null
    private var bubble: View? = null
    private var panel: View? = null
    private lateinit var bubbleParams: WindowManager.LayoutParams

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            SpikeLog.add(this, "Bubble stopped from notification")
            stopSelf()
            return START_NOT_STICKY
        }
        // Must be in the foreground before asking for the projection.
        startForeground(NOTIFICATION_ID, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)

        val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, 0) ?: 0
        @Suppress("DEPRECATION") // the typed overload needs API 33; minSdk is 30
        val data = intent?.getParcelableExtra<Intent>(EXTRA_DATA)
        if (data == null) {
            SpikeLog.add(this, "No capture consent passed in, stopping")
            stopSelf()
            return START_NOT_STICKY
        }
        capturer?.stop()
        capturer = ScreenCapturer(this, resultCode, data) {
            SpikeLog.add(this, "FINDING capture session ended by the system or the user (lock screen, status bar chip, or stop)")
            stopSelf()
        }
        SpikeLog.add(this, "Capture session started")
        if (bubble == null) addBubble()
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        removePanel()
        bubble?.let { runCatching { wm.removeView(it) } }
        bubble = null
        capturer?.stop()
        capturer = null
        super.onDestroy()
    }

    // ---- Bubble -------------------------------------------------------------

    private fun addBubble() {
        wm = getSystemService(WindowManager::class.java)
        val view = TextView(this).apply {
            text = "Cue"
            setTextColor(Color.parseColor("#FAF9F5"))
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#141413"))
                setStroke(dp(3), Color.parseColor("#D97757"))
            }
            contentDescription = "Cue bubble. Tap to read this screen."
        }
        bubbleParams = overlayParams(dp(58), dp(58)).apply {
            gravity = Gravity.TOP or Gravity.START
            x = resources.displayMetrics.widthPixels - dp(68)
            y = resources.displayMetrics.heightPixels / 2
        }
        view.setOnTouchListener(DragOrTap(view))
        wm.addView(view, bubbleParams)
        bubble = view
    }

    private inner class DragOrTap(private val view: View) : View.OnTouchListener {
        private var startX = 0
        private var startY = 0
        private var downX = 0f
        private var downY = 0f
        private var moved = false

        override fun onTouch(v: View, e: MotionEvent): Boolean {
            when (e.action) {
                MotionEvent.ACTION_DOWN -> {
                    startX = bubbleParams.x; startY = bubbleParams.y
                    downX = e.rawX; downY = e.rawY; moved = false
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (e.rawX - downX).toInt()
                    val dy = (e.rawY - downY).toInt()
                    if (abs(dx) > dp(6) || abs(dy) > dp(6)) moved = true
                    bubbleParams.x = startX + dx
                    bubbleParams.y = startY + dy
                    wm.updateViewLayout(view, bubbleParams)
                }
                MotionEvent.ACTION_UP -> if (!moved) onBubbleTap()
            }
            return true
        }
    }

    // ---- Read ---------------------------------------------------------------

    private fun onBubbleTap() {
        if (panel != null) {
            removePanel()
            return
        }
        val count = SpikeLog.bump(this, "taps")
        val tapAt = SystemClock.elapsedRealtime()
        // Hide our own overlay so it isn't in the frame, then wait for a fresh frame.
        bubble?.visibility = View.INVISIBLE
        main.postDelayed({
            val captureStart = SystemClock.elapsedRealtime()
            capturer?.capture { bitmap ->
                bubble?.visibility = View.VISIBLE
                val captureMs = SystemClock.elapsedRealtime() - captureStart
                when {
                    bitmap == null -> {
                        SpikeLog.add(this, "Tap #$count: no frame yet")
                        showPanel("No frame yet. Try again in a second.", emptyList(), null)
                    }
                    ScreenCapturer.looksBlack(bitmap) -> {
                        SpikeLog.add(this, "FINDING tap #$count: black frame, this app blocks screen capture (FLAG_SECURE)")
                        showPanel("This app blocks screen capture. Try the accessibility read below.", emptyList(), null)
                    }
                    else -> {
                        val readStart = SystemClock.elapsedRealtime()
                        TextReader.read(bitmap) { text, error ->
                            val readMs = SystemClock.elapsedRealtime() - readStart
                            val totalMs = SystemClock.elapsedRealtime() - tapAt
                            if (text == null) {
                                SpikeLog.add(this, "Tap #$count: text recognition failed: ${error?.message}")
                                showPanel("Couldn't read the screen.", emptyList(), null)
                            } else {
                                val questions = TextReader.questionCandidates(text)
                                SpikeLog.add(
                                    this,
                                    "Tap #$count: tap-to-result ${totalMs}ms (capture ${captureMs}ms, text ${readMs}ms), " +
                                        "${text.textBlocks.size} blocks, top: ${questions.firstOrNull()?.take(80)}",
                                )
                                showPanel("Read in ${totalMs} ms (capture $captureMs, text $readMs)", questions, null)
                            }
                        }
                    }
                }
            }
        }, HIDE_BEFORE_CAPTURE_MS)
    }

    private fun readWithAccessibility() {
        val service = CueAccessibilityService.instance
        if (service == null) {
            toast("Turn on Cue spike in Accessibility settings first")
            return
        }
        val start = SystemClock.elapsedRealtime()
        val lines = service.readScreenText()
        val ms = SystemClock.elapsedRealtime() - start
        val questions = lines
            .filter { it.length >= 8 }
            .sortedWith(compareByDescending<String> { it.contains('?') }.thenByDescending { it.length })
            .take(4)
        SpikeLog.add(this, "Accessibility read: ${ms}ms, ${lines.size} text nodes, top: ${questions.firstOrNull()?.take(80)}")
        removePanel()
        showPanel("Read through accessibility in $ms ms (${lines.size} text nodes)", questions, null)
    }

    // ---- Panel --------------------------------------------------------------

    private fun showPanel(status: String, questions: List<String>, selected: String?) {
        removePanel()
        val chosen = selected ?: questions.firstOrNull()
        val answer = chosen?.let { "Cue test answer for: ${it.take(60)}" } ?: "Cue test answer"

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(14), dp(16), dp(18))
            background = GradientDrawable().apply {
                cornerRadii = floatArrayOf(dp(20f), dp(20f), dp(20f), dp(20f), 0f, 0f, 0f, 0f)
                setColor(Color.parseColor("#FAF9F5"))
            }
        }
        content.addView(label(status, 13f, "#5E5D59"))

        if (questions.isEmpty()) {
            content.addView(label("No question picked up.", 16f, "#141413", bold = true))
        } else {
            content.addView(label("Questions found (tap to choose)", 13f, "#5E5D59"))
            questions.forEach { q ->
                content.addView(label(q, 15f, "#141413", bold = q == chosen).apply {
                    setPadding(dp(10), dp(8), dp(10), dp(8))
                    background = GradientDrawable().apply {
                        cornerRadius = dp(10f)
                        setColor(Color.WHITE)
                        setStroke(dp(if (q == chosen) 2 else 1), Color.parseColor(if (q == chosen) "#D97757" else "#D1CFC5"))
                    }
                    setOnClickListener { showPanel(status, questions, q) }
                    (layoutParams as? LinearLayout.LayoutParams)?.topMargin = dp(6)
                })
            }
        }

        content.addView(label("Answer to insert: $answer", 14f, "#141413").apply { setPadding(0, dp(12), 0, dp(6)) })
        content.addView(label("Tap the app's text field first, then pick a method:", 12f, "#5E5D59"))

        val row1 = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        row1.addView(button("A Copy") { insertByClipboard(answer) })
        row1.addView(button("B Type it") { insertByAccessibility(answer) })
        row1.addView(button("C Keyboard") { insertByKeyboard(answer) })
        content.addView(row1)

        val row2 = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        row2.addView(button("Read via accessibility") { readWithAccessibility() })
        row2.addView(button("Close") { removePanel() })
        content.addView(row2)

        val scroll = ScrollView(this).apply { addView(content) }
        // Not focusable: the app's text field keeps focus, which methods B and C need.
        val params = overlayParams(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT).apply {
            gravity = Gravity.BOTTOM
        }
        wm.addView(scroll, params)
        panel = scroll
    }

    private fun removePanel() {
        panel?.let { runCatching { wm.removeView(it) } }
        panel = null
    }

    // ---- Insert: the three methods under test --------------------------------

    /** A: works everywhere, costs the person a long-press and Paste. */
    private fun insertByClipboard(answer: String) {
        getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("Cue answer", answer))
        SpikeLog.add(this, "Insert A (clipboard): copied")
        toast("Copied. Long-press the field and Paste.")
        removePanel()
    }

    /** B: types straight into the focused field. Needs the accessibility permission. */
    private fun insertByAccessibility(answer: String) {
        val service = CueAccessibilityService.instance
        if (service == null) {
            SpikeLog.add(this, "Insert B (accessibility): service is off")
            toast("Turn on Cue spike in Accessibility settings first")
            return
        }
        val start = SystemClock.elapsedRealtime()
        val result = service.insertIntoFocused(answer)
        SpikeLog.add(this, "Insert B (accessibility): $result in ${SystemClock.elapsedRealtime() - start}ms")
        toast("Type it: $result")
        if (result == CueAccessibilityService.OK) removePanel()
    }

    /** C: hands the answer to the Cue keyboard; the person switches keyboards and taps Insert. */
    private fun insertByKeyboard(answer: String) {
        SpikeState.pendingAnswer = answer
        SpikeLog.add(this, "Insert C (keyboard): answer waiting, showing keyboard picker")
        removePanel()
        getSystemService(InputMethodManager::class.java).showInputMethodPicker()
    }

    // ---- Helpers ------------------------------------------------------------

    private fun overlayParams(w: Int, h: Int) = WindowManager.LayoutParams(
        w, h,
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
        PixelFormat.TRANSLUCENT,
    )

    private fun label(text: String, size: Float, color: String, bold: Boolean = false) = TextView(this).apply {
        this.text = text
        textSize = size
        setTextColor(Color.parseColor(color))
        if (bold) typeface = Typeface.DEFAULT_BOLD
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
    }

    private fun button(text: String, onClick: () -> Unit) = Button(this).apply {
        this.text = text
        isAllCaps = false
        setOnClickListener { onClick() }
        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
    }

    private fun toast(text: String) = Toast.makeText(this, text, Toast.LENGTH_SHORT).show()

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
    private fun dp(v: Float) = v * resources.displayMetrics.density

    private fun notification(): Notification {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Cue bubble", NotificationManager.IMPORTANCE_LOW))
        val stop = PendingIntent.getService(
            this, 0, Intent(this, BubbleService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.sym_action_chat)
            .setContentTitle("Cue bubble is on")
            .setContentText("Tap the bubble when you see a question")
            .addAction(Notification.Action.Builder(null, "Stop", stop).build())
            .setOngoing(true)
            .build()
    }

    companion object {
        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_DATA = "data"
        private const val ACTION_STOP = "com.cue.spike.STOP"
        private const val CHANNEL = "cue_bubble"
        private const val NOTIFICATION_ID = 1
        private const val HIDE_BEFORE_CAPTURE_MS = 180L

        fun start(context: Context, resultCode: Int, data: Intent) {
            context.startForegroundService(
                Intent(context, BubbleService::class.java)
                    .putExtra(EXTRA_RESULT_CODE, resultCode)
                    .putExtra(EXTRA_DATA, data),
            )
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, BubbleService::class.java))
        }
    }
}
