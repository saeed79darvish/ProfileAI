package com.cue.spike

import android.content.Context
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Everything the spike measures goes here, so findings can be shared from the
 * phone afterwards (Main screen, Share log). Also mirrored to logcat as CueSpike.
 */
object SpikeLog {
    private const val FILE = "spike-log.txt"
    private val time = SimpleDateFormat("HH:mm:ss.SSS", Locale.US)

    fun add(context: Context, line: String) {
        Log.i("CueSpike", line)
        file(context).appendText("${time.format(Date())}  $line\n")
    }

    fun read(context: Context): String = file(context).takeIf { it.exists() }?.readText().orEmpty()

    fun clear(context: Context) {
        file(context).delete()
    }

    /** A counter that survives restarts, e.g. how many times Android asked for capture consent. */
    fun bump(context: Context, key: String): Int {
        val prefs = context.getSharedPreferences("spike", Context.MODE_PRIVATE)
        val next = prefs.getInt(key, 0) + 1
        prefs.edit().putInt(key, next).apply()
        return next
    }

    private fun file(context: Context) = File(context.filesDir, FILE)
}

/** The answer waiting to be inserted by the keyboard (method C). */
object SpikeState {
    @Volatile var pendingAnswer: String? = null
}
