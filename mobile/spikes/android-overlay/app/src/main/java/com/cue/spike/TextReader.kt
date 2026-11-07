package com.cue.spike

import android.graphics.Bitmap
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

/** On-device text recognition, plus a crude guess at which blocks are questions. */
object TextReader {
    private val recognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }

    fun read(bitmap: Bitmap, callback: (Text?, Exception?) -> Unit) {
        recognizer.process(InputImage.fromBitmap(bitmap, 0))
            .addOnSuccessListener { callback(it, null) }
            .addOnFailureListener { callback(null, it) }
    }

    /**
     * Blocks that end in "?" first, then the longest ones. The real app sends the
     * whole screen text to the model to pick questions; this is only enough to
     * see whether the prompt text survives recognition.
     */
    fun questionCandidates(text: Text): List<String> =
        text.textBlocks
            .map { it.text.replace('\n', ' ').trim() }
            .filter { it.length >= 8 }
            .sortedWith(compareByDescending<String> { it.contains('?') }.thenByDescending { it.length })
            .take(4)
}
