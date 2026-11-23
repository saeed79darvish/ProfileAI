/**
 * Real application forms for harvested jobs.
 *
 * 1. canonicalApplyUrl: about 40% of Greenhouse jobs link to the
 *    company's own careers page (okta.com/...?gh_jid=123). No adapter can
 *    submit there, but every Greenhouse board also serves the real form at
 *    job-boards.greenhouse.io/embed/job_app?for=<board>&token=<id>, which
 *    the Greenhouse adapter already understands.
 *
 * 2. fetchRealQuestions: prep used to draft answers for a generic template
 *    ("Full name", "How did you hear about us"), so the employer's own
 *    questions were answered at submit time, after the user had approved,
 *    and never shown to them. For Greenhouse the public board API returns
 *    the exact questions, so prep drafts answers to those and the user
 *    reviews what will actually be sent.
 */
const axios = require('axios');
const { normalizeFields } = require('./greenhouse');

const ATS_HOST_RE = /(^|\.)greenhouse\.io$/i;

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function greenhouseEmbedUrl(boardToken, jobId) {
  return `https://job-boards.greenhouse.io/embed/job_app?for=${encodeURIComponent(boardToken)}&token=${encodeURIComponent(jobId)}`;
}

/** Returns a URL an adapter can submit to, or null when nothing better is known. */
function canonicalApplyUrl({ source, boardToken, externalId, applyUrl }) {
  if (String(source || '').toLowerCase() !== 'greenhouse' || !boardToken || !externalId) return null;
  if (applyUrl && ATS_HOST_RE.test(hostOf(applyUrl))) return null; // already a Greenhouse page
  return greenhouseEmbedUrl(boardToken, externalId);
}

// Identity, files and the resume/cover letter are filled from the account
// and the tailored documents, not drafted, so they are left out here.
const NOT_DRAFTED = new Set(['first_name', 'last_name', 'preferred_name', 'email', 'phone', 'resume', 'resume_text', 'cover_letter', 'cover_letter_text']);

/**
 * Returns [{ fieldId, question, type, required, options? }] for the job's
 * own form, or null when the questions aren't available.
 */
async function fetchRealQuestions({ source, boardToken, externalId }) {
  if (String(source || '').toLowerCase() !== 'greenhouse' || !boardToken || !externalId) return null;
  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs/${encodeURIComponent(externalId)}?questions=true`;
    const { data } = await axios.get(url, { timeout: 12_000 });
    // Only the employer's questions: compliance/EEO comes from the
    // candidate's saved demographics at submit time.
    const fields = normalizeFields({ questions: data?.questions || [] });
    const seen = new Set();
    const out = [];
    for (const f of fields) {
      if (f.standard || NOT_DRAFTED.has(f.rawName) || f.type === 'file') continue;
      const key = `${f.label}`.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        fieldId: f.rawName,
        question: key,
        type: f.type,
        required: !!f.required,
        ...(f.options ? { options: f.options.map((o) => o.label) } : {}),
      });
    }
    return out.length ? out : null;
  } catch (err) {
    console.warn(`[realQuestions] ${boardToken}/${externalId}: ${err.message}`);
    return null;
  }
}

module.exports = { canonicalApplyUrl, fetchRealQuestions, greenhouseEmbedUrl };
