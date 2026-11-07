package com.cue.spike

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.view.WindowManager

/**
 * One consent, one capture session. Since Android 14 a projection token can make
 * only one virtual display, so we keep a single display mirroring the screen for
 * the whole session and hold on to the newest frame. A tap on the bubble just
 * converts that frame, no new consent prompt.
 */
class ScreenCapturer(
    context: Context,
    resultCode: Int,
    data: Intent,
    private val onStopped: () -> Unit,
) {
    private val thread = HandlerThread("cue-capture").apply { start() }
    private val handler = Handler(thread.looper)
    private val main = Handler(Looper.getMainLooper())
    private val lock = Any()
    private var latest: Image? = null

    private val projection: MediaProjection
    private val reader: ImageReader
    private val display: VirtualDisplay

    init {
        val bounds = context.getSystemService(WindowManager::class.java).maximumWindowMetrics.bounds
        val width = bounds.width()
        val height = bounds.height()
        val density = context.resources.displayMetrics.densityDpi

        projection = context.getSystemService(MediaProjectionManager::class.java)
            .getMediaProjection(resultCode, data)
        // Required before createVirtualDisplay on Android 14+.
        projection.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() {
                main.post(onStopped)
            }
        }, handler)

        reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 3)
        reader.setOnImageAvailableListener({ r ->
            val image = r.acquireLatestImage() ?: return@setOnImageAvailableListener
            synchronized(lock) {
                latest?.close()
                latest = image
            }
        }, handler)

        display = projection.createVirtualDisplay(
            "cue-spike", width, height, density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            reader.surface, null, handler,
        )
    }

    /** The newest frame as a bitmap, or null if no frame has arrived yet. Callback on the main thread. */
    fun capture(callback: (Bitmap?) -> Unit) {
        handler.post {
            val bitmap = synchronized(lock) { latest?.let(::toBitmap) }
            main.post { callback(bitmap) }
        }
    }

    fun stop() {
        runCatching { display.release() }
        runCatching { projection.stop() }
        synchronized(lock) {
            latest?.close()
            latest = null
        }
        reader.close()
        thread.quitSafely()
    }

    private fun toBitmap(image: Image): Bitmap {
        val plane = image.planes[0]
        val rowPadding = plane.rowStride - plane.pixelStride * image.width
        val padded = Bitmap.createBitmap(
            image.width + rowPadding / plane.pixelStride, image.height, Bitmap.Config.ARGB_8888,
        )
        padded.copyPixelsFromBuffer(plane.buffer.rewind())
        return Bitmap.createBitmap(padded, 0, 0, image.width, image.height)
    }

    companion object {
        /**
         * Apps that set FLAG_SECURE (many banking apps, some chat apps) come through
         * as a black frame. Sampling a grid is enough to tell.
         */
        fun looksBlack(bitmap: Bitmap): Boolean {
            val stepX = (bitmap.width / 10).coerceAtLeast(1)
            val stepY = (bitmap.height / 10).coerceAtLeast(1)
            for (x in 0 until bitmap.width step stepX) {
                for (y in 0 until bitmap.height step stepY) {
                    val p = bitmap.getPixel(x, y)
                    val r = (p shr 16) and 0xff
                    val g = (p shr 8) and 0xff
                    val b = p and 0xff
                    if (r > 12 || g > 12 || b > 12) return false
                }
            }
            return true
        }
    }
}
