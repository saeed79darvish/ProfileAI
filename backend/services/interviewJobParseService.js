/**
 * Reads a job posting (pasted text or a link) into the few facts Interview
 * prep needs: company, job title, level and a one-sentence summary. The page
 * fetch is the coach's SSRF-guarded resolver; the model call is small and only
 * allowed to use what the posting says.
 */
const { parseModelJson, clean } = require('./interviewPrepService');

const LEVELS = ['intern', 'junior', 'mid', 'senior', 'staff', 'principal', 'manager', 'unknown'];
const UNREADABLE = 'We could not read that page. Paste the job description instead.';

const PARSE_SYSTEM = `You read a job posting for a candidate who wants to prepare for the interview. Use ONLY facts written in the posting. Never guess.
- company: the hiring company named in the posting; "" if the posting does not say.
- jobTitle: the job title as written.
- level: one of intern, junior, mid, senior, staff, principal, manager, unknown. Use the title or the stated seniority or years; "unknown" if the posting gives no clear signal.
- summary: one plain sentence about what the role does. No hype, no company slogans.
Return ONLY JSON: {"company":"","jobTitle":"","level":"","summary":""}`;

const err = (status, code, message) => Object.assign(new Error(message), { status, code });

/**
 * @param {{url?: string, text?: string}} input
 * @param {{resolveJob: Function, runModel: Function}} deps
 */
async function parseJob({ url, text } = {}, { resolveJob, runModel }) {
  const link = typeof url === 'string' ? url.trim() : '';
  const pasted = typeof text === 'string' ? text.trim() : '';
  if (!link && !pasted) throw err(400, 'job_required', 'Paste a job link or the job description.');

  let job;
  try {
    job = await resolveJob({ jobUrl: pasted ? '' : link, jobDescription: pasted });
  } catch (e) {
    if (e && e.code === 'job_url_unreadable') throw err(422, 'unreadable', UNREADABLE);
    if (e && e.status && e.status < 500) throw err(e.status === 422 ? 422 : 400, e.status === 422 ? 'unreadable' : (e.code || 'invalid_request'), e.status === 422 ? UNREADABLE : e.message);
    throw e;
  }

  const hints = [job.jobTitle ? `Title on the page: ${clean(job.jobTitle, 200)}` : '', job.company ? `Company on the page: ${clean(job.company, 200)}` : ''].filter(Boolean).join('\n');
  const raw = await runModel({
    system: PARSE_SYSTEM,
    prompt: `${hints ? `${hints}\n\n` : ''}Posting:\n${String(job.jobDescription || '').slice(0, 8000)}`,
    maxTokens: 400,
    purpose: 'parse_job',
  });
  const parsed = parseModelJson(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw err(502, 'parse_failed', 'We could not read that job. Try again.');

  const level = String(parsed.level || '').toLowerCase().trim();
  return {
    company: clean(parsed.company, 120),
    jobTitle: clean(parsed.jobTitle, 160) || clean(job.jobTitle, 160),
    level: LEVELS.includes(level) ? level : 'unknown',
    summary: clean(parsed.summary, 300),
    source: job.source === 'link' ? 'link' : 'text',
  };
}

module.exports = { parseJob, LEVELS, UNREADABLE };
