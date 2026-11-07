package com.cue.spike

import android.graphics.Color
import android.inputmethodservice.InputMethodService
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Method C: a bare keyboard with one job, typing the waiting answer. Also logs
 * what a keyboard can see of the field it is typing into, which is the same
 * limit the iPhone keyboard will have.
 */
class CueKeyboardService : InputMethodService() {

    private var status: TextView? = null

    override fun onCreateInputView(): View {
        val pad = (12 * resources.displayMetrics.density).toInt()
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad * 2)
            setBackgroundColor(Color.parseColor("#F0EEE6"))
            status = TextView(this@CueKeyboardService).apply { textSize = 14f; setTextColor(Color.parseColor("#141413")) }
            addView(status)
            addView(Button(this@CueKeyboardService).apply {
                text = "Insert Cue answer"
                isAllCaps = false
                setOnClickListener { insertPending() }
            })
            addView(Button(this@CueKeyboardService).apply {
                text = "Back to my keyboard"
                isAllCaps = false
                setOnClickListener { switchToPreviousInputMethod() }
            })
        }
    }

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        val pending = SpikeState.pendingAnswer
        status?.text = if (pending == null) "No answer waiting. Tap the bubble first." else "Ready: $pending"
        val before = currentInputConnection?.getTextBeforeCursor(200, 0)
        SpikeLog.add(
            this,
            "Keyboard opened in ${info?.packageName}: hint='${info?.hintText}', can see ${before?.length ?: 0} chars before cursor",
        )
    }

    private fun insertPending() {
        val answer = SpikeState.pendingAnswer ?: return
        val ok = currentInputConnection?.commitText(answer, 1) == true
        SpikeLog.add(this, "Insert C (keyboard): ${if (ok) "typed in" else "commitText failed"}")
        if (ok) {
            SpikeState.pendingAnswer = null
            status?.text = "Typed in."
        }
    }
}
