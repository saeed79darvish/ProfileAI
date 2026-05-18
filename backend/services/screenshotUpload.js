/**
 * screenshotUpload · pushes a submission screenshot buffer into
 * Cloudinary and returns a shareable URL.
 *
 * Used by the Puppeteer-based ATS adapters. Kept in its own module
 * so we can swap storage backends (S3, local, etc.) without touching
 * adapter code.
 *
 * Uploads land in:
 *   profileai/applypilot-screenshots/{userId}/{appId}/{step}-{timestamp}.png
 *
 * When CLOUDINARY_CLOUD_NAME is absent (local dev) we resolve null —
 * the adapter gracefully stores whatever URLs it has and moves on.
 */
const { cloudinary } = require('../config/cloudinary');
const streamifier = require('streamifier');

async function uploadScreenshot(buffer, { userId, appId, step, label }) {
  if (!buffer || !buffer.length) return null;
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return null;
  }

  const ts = Date.now();
  const publicId = `${step || 'step'}-${ts}`;
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `profileai/applypilot-screenshots/${userId}/${appId}`,
        public_id: publicId,
        resource_type: 'image',
        format: 'png',
        overwrite: false,
        context: label ? `label=${encodeURIComponent(String(label))}` : undefined,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result?.secure_url || null);
      },
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

module.exports = { uploadScreenshot };
