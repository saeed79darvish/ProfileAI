package com.cue.spike

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Method B for inserting, and a second way to read the screen. Google Play only
 * allows this permission after a policy declaration, so the spike measures how
 * much better it is before we decide whether to apply.
 */
class CueAccessibilityService : AccessibilityService() {

    override fun onServiceConnected() {
        instance = this
        SpikeLog.add(this, "Accessibility service connected")
    }

    override fun onUnbind(intent: Intent?): Boolean {
        instance = null
        return super.onUnbind(intent)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

    override fun onInterrupt() = Unit

    /** Replaces the text of the focused field in the app under the bubble. */
    fun insertIntoFocused(text: String): String {
        val root = rootInActiveWindow ?: return "no active window"
        val focus = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
        // Browsers and web views report their container as focused; the real
        // field is a focused, editable node somewhere inside it.
        val node = focus?.takeIf { it.isEditable }
            ?: findFocusedEditable(focus)
            ?: findFocusedEditable(root)
            ?: return "no editable field (focus was ${focus?.className ?: "nothing"} in ${root.packageName})"
        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        return if (node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) OK else "app refused SET_TEXT"
    }

    private fun findFocusedEditable(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
        if (node == null) return null
        if (node.isEditable && node.isFocused) return node
        for (i in 0 until node.childCount) findFocusedEditable(node.getChild(i))?.let { return it }
        return null
    }

    /** Every visible text, hint and description in the active window, top to bottom. */
    fun readScreenText(): List<String> {
        val out = mutableListOf<String>()
        fun walk(node: AccessibilityNodeInfo?) {
            if (node == null) return
            listOf(node.text, node.hintText, node.contentDescription)
                .mapNotNull { it?.toString()?.trim() }
                .filter { it.isNotEmpty() }
                .forEach { if (out.lastOrNull() != it) out.add(it) }
            for (i in 0 until node.childCount) walk(node.getChild(i))
        }
        walk(rootInActiveWindow)
        return out
    }

    companion object {
        const val OK = "typed in"
        @Volatile var instance: CueAccessibilityService? = null
    }
}
