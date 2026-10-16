/**
 * Profile photos that do not expire.
 *
 * LinkedIn serves profile photos from media.licdn.com with a signed expiry in
 * the URL (`e=<epoch seconds>`). The LinkedIn import and LinkedIn sign-in both
 * stored that URL as-is, so every imported photo broke on its expiry date —
 * the server returns 403 "Invalid e query string" and the avatar falls back
 * to an initial. Browser caching hid it until the cache was evicted, so it
 * looked like it broke at random.
 *
 * The fix is to never keep a LinkedIn CDN link: copy the image to our own
 * Cloudinary folder while the link still works, and store that URL instead.
 * A link that has already expired cannot be recovered, so it is replaced with
 * whatever working photo the account has (the Google sign-in photo, for
 * instance), or cleared so the UI shows its placeholder honestly.
 */

const LINKEDIN_CDN = /(^|\.)licdn\.com$/i;

function parse(url) {
  try { return new URL(String(url || '')); } catch (_) { return null; }
}

/** Is this a LinkedIn CDN photo link (which carries an expiry)? */
function isLinkedInCdnUrl(url) {
  const u = parse(url);
  return Boolean(u && LINKEDIN_CDN.test(u.hostname));
}

/**
 * Has a LinkedIn CDN link passed its signed expiry? A link with no readable
 * expiry is treated as expired — it cannot be trusted to keep working.
 */
function isExpiredLinkedInUrl(url, now = Date.now()) {
  const u = parse(url);
  if (!u || !LINKEDIN_CDN.test(u.hostname)) return false;
  const e = Number(u.searchParams.get('e'));
  if (!Number.isFinite(e) || e <= 0) return true;
  // A day of margin: a link that expires tomorrow is not worth storing.
  return e * 1000 <= now + 24 * 60 * 60 * 1000;
}

/** A URL that can be stored and shown: present, and not a dead LinkedIn link. */
function isUsable(url, now) {
  return Boolean(url) && !isExpiredLinkedInUrl(url, now);
}

/**
 * Copy a still-valid LinkedIn photo to Cloudinary and return the permanent
 * URL. Anything that is not a LinkedIn link is returned unchanged. Never
 * throws: on failure the original (still-valid) link is returned so the photo
 * keeps working until its expiry, and the next save retries the copy.
 *
 * @param {string} url
 * @param {{ userId?: string, uploader?: { upload: Function }, now?: number }} [opts]
 */
async function persistAvatar(url, { userId, uploader, now = Date.now() } = {}) {
  if (!url || !isLinkedInCdnUrl(url)) return url;
  if (isExpiredLinkedInUrl(url, now)) return null;
  try {
    const up = uploader || require('../config/cloudinary').cloudinary.uploader;
    const result = await up.upload(url, {
      folder: 'profileai/profiles',
      public_id: userId ? `linkedin-${userId}` : undefined,
      overwrite: true,
      transformation: [{ width: 800, height: 800, crop: 'limit' }],
    });
    return (result && (result.secure_url || result.url)) || url;
  } catch (err) {
    console.warn('[avatar] could not copy LinkedIn photo to Cloudinary:', err.message);
    return url;
  }
}

/**
 * The photo a profile should show right now, and whether the stored value
 * needs replacing. Used when reading a profile, to repair links that expired
 * before this fix existed.
 *
 * @returns {{ url: string|null, needsUpdate: boolean }}
 */
function resolveAvatar(profilePicture, fallbackUrl, now = Date.now()) {
  if (isUsable(profilePicture, now)) {
    // Still valid, but a LinkedIn link will expire: flag it for copying.
    return { url: profilePicture, needsUpdate: isLinkedInCdnUrl(profilePicture) };
  }
  const fallback = isUsable(fallbackUrl, now) ? fallbackUrl : null;
  return { url: fallback, needsUpdate: Boolean(profilePicture) || Boolean(fallback) };
}

module.exports = { isLinkedInCdnUrl, isExpiredLinkedInUrl, persistAvatar, resolveAvatar };
