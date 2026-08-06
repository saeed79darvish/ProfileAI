/**
 * Pull a human-readable message out of an axios error.
 *
 * The API reports failures in three different shapes, and reading only one of
 * them is how "Failed to save enhanced profile" ended up on screen with no clue
 * as to which field was rejected:
 *
 *   { error: "..." }                              // most handlers
 *   { message: "..." }                            // a few handlers
 *   { errors: [{ msg, path|param }, ...] }        // express-validator
 *
 * The validator shape is the important one: it names the offending field, which
 * is the only thing that makes a 400 actionable for the user.
 */
export function extractApiError(err, fallback = 'Something went wrong') {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;

  if (typeof data === 'string' && data.trim()) return data;

  if (Array.isArray(data.errors) && data.errors.length > 0) {
    const parts = data.errors
      .map((e) => {
        const field = e.path || e.param;
        const msg = e.msg || e.message;
        if (!msg) return null;
        return field ? `${field}: ${msg}` : msg;
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' · ');
  }

  return data.error || data.message || fallback;
}

export default extractApiError;
