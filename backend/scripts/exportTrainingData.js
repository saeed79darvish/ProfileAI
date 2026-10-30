/**
 * Export AI inputs and outputs from the database as a training dataset.
 *
 * Writes gzipped JSONL, one record per AI result, each paired with the input
 * that produced it wherever the input can be recovered:
 *
 *   resume_tailoring       TailoredProfiles: resume before → tailored resume,
 *                          match score, skill gaps. Job text joined from the
 *                          linked ExternalApplication / ApplyPilot run, else
 *                          by matching the job URL against ExternalJobs.
 *   apply_pilot            ApplyPilotApplications: job + candidate profile →
 *                          match, breakdown, tailored resume, cover letter,
 *                          form answers, plus the real outcome as a label.
 *   job_application_match  JobApplications: job + parsed resume → AI score
 *                          and analysis.
 *   *_output_only          (only with --include-unpaired) AI caches and
 *                          CandidateInsights. Their inputs were stored only
 *                          as a hash, so there is nothing to pair them with.
 *
 * Personal data is scrubbed before anything is written: identifying keys
 * (email, phone, names, profile URLs, photos) are dropped, each user's own
 * name/email/phone/URLs are replaced wherever they appear in text, and any
 * remaining emails, phone numbers and URLs are masked. User ids become a
 * salted hash so a user's records still group together without naming them.
 * Job postings are public and are kept as-is.
 *
 * Run from the backend directory:
 *   node scripts/exportTrainingData.js                       # → /tmp/training-data-<date>.jsonl.gz
 *   node scripts/exportTrainingData.js --stdout > out.jsonl.gz
 *   node scripts/exportTrainingData.js --since 2026-01-01 --limit 500
 *   node scripts/exportTrainingData.js --only resume_tailoring,apply_pilot
 *   node scripts/exportTrainingData.js --include-unpaired
 *   node scripts/exportTrainingData.js --upload              # for the Render web shell, see below
 *   node scripts/exportTrainingData.js --delete <public_id>  # remove an uploaded export
 *
 * --upload exists because the Render web shell can't download files. It puts
 * the finished file in Cloudinary as a PRIVATE raw asset (its plain URL does
 * not serve it) and prints a signed download link that expires in 24 hours.
 * The local copy in /tmp is removed. Delete the asset with --delete once you
 * have the file.
 *
 * It also runs when piped in over stdin (`node - < scripts/exportTrainingData.js`),
 * so it can be used on a server that hasn't deployed it yet.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const BACKEND = fs.existsSync(path.join(process.cwd(), 'models')) ? process.cwd() : path.resolve(__dirname, '..');
require(path.join(BACKEND, 'node_modules/dotenv')).config({ path: path.join(BACKEND, '.env') });
const { Op } = require(path.join(BACKEND, 'node_modules/sequelize'));
const models = require(path.join(BACKEND, 'models'));
const {
  sequelize, User, Profile, TailoredProfile, ExternalApplication, ExternalJob, Job,
  ApplyPilotApplication, JobApplication, AiAnalysisCache, GuestAnalysisCache, CandidateInsights,
} = models;

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const TO_STDOUT = flag('stdout');
const OUT = opt('out') || `/tmp/training-data-${new Date().toISOString().slice(0, 10)}.jsonl.gz`;
const LIMIT = opt('limit') ? parseInt(opt('limit'), 10) : Infinity;
const SINCE = opt('since') ? new Date(opt('since')) : null;
const ONLY = opt('only') ? new Set(opt('only').split(',')) : null;
const INCLUDE_UNPAIRED = flag('include-unpaired');
const UPLOAD = flag('upload');
const DELETE_ID = opt('delete');
const SALT = process.env.EXPORT_SALT || crypto.randomBytes(16).toString('hex');
const BATCH = 100;

const log = (...a) => console.error('[export]', ...a);
const want = (task) => !ONLY || ONLY.has(task);

// ── PII scrubbing ───────────────────────────────────────────────────────────
const DROP_KEYS = new Set([
  'email', 'emails', 'guestemail', 'phone', 'phonenumber', 'mobile', 'firstname', 'lastname', 'fullname', 'candidatename',
  'linkedinurl', 'linkedin', 'githuburl', 'github', 'portfoliourl', 'website', 'websiteurl', 'personalwebsite',
  'twitter', 'twitterurl', 'address', 'streetaddress', 'zip', 'zipcode', 'postalcode', 'profilepicture', 'avatar',
  'avatarurl', 'photo', 'photourl', 'resumeurl', 'userid', 'candidateid', 'slug', 'username', 'dateofbirth', 'dob',
  'ssn', 'contact', 'contactinfo', 'socials', 'sociallinks', 'links',
]);
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s"'<>)\]]+|\b(?:linkedin\.com|github\.com|gitlab\.com)\/[^\s"'<>)\]]+/gi;
const PHONE_RE = /(?<!\w)(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]?\d{3,4}[\s.-]?\d{3,4}(?!\w)/g;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pseudonym = (id) => (id == null ? null : crypto.createHmac('sha256', SALT).update(String(id)).digest('hex').slice(0, 16));

/** Who to scrub for one record: the user's own identifying strings. */
function identityTerms(user, profile) {
  const terms = [];
  const add = (v, tag) => { if (v && String(v).trim().length >= 3) terms.push([String(v).trim(), tag]); };
  if (user) {
    add(user.email, '[EMAIL]');
    if (user.firstName && user.lastName) add(`${user.firstName} ${user.lastName}`, '[NAME]');
    add(user.lastName, '[NAME]');
    add(user.firstName, '[NAME]');
  }
  if (profile) {
    add(profile.phone, '[PHONE]');
    for (const k of ['linkedinUrl', 'githubUrl', 'portfolioUrl']) add(profile[k], '[URL]');
  }
  // Longest first, so "Jane Doe" is replaced before "Jane".
  return terms.sort((a, b) => b[0].length - a[0].length)
    .map(([v, tag]) => [new RegExp(`\\b${escapeRe(v)}\\b`, 'gi'), tag]);
}

function scrubText(s, terms) {
  let out = s;
  for (const [re, tag] of terms) out = out.replace(re, tag);
  return out.replace(EMAIL_RE, '[EMAIL]').replace(URL_RE, '[URL]').replace(PHONE_RE, (m) => {
    // Years and short ranges ("2019-2023", "2,000") are not phone numbers.
    const digits = m.replace(/\D/g, '');
    return digits.length >= 9 ? '[PHONE]' : m;
  });
}

function scrub(value, terms) {
  if (value == null) return value;
  if (typeof value === 'string') return scrubText(value, terms);
  if (Array.isArray(value)) return value.map((v) => scrub(v, terms));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (DROP_KEYS.has(k.toLowerCase())) continue;
      out[k] = scrub(v, terms);
    }
    return out;
  }
  return value;
}

// ── lookups (cached) ────────────────────────────────────────────────────────
const userCache = new Map();
async function identityFor(userId) {
  if (!userId) return [];
  if (!userCache.has(userId)) {
    const [user, profile] = await Promise.all([
      User.findByPk(userId, { attributes: ['id', 'email', 'firstName', 'lastName'], raw: true }),
      Profile.findOne({ where: { userId }, attributes: ['phone', 'linkedinUrl', 'githubUrl', 'portfolioUrl'], raw: true }),
    ]);
    userCache.set(userId, identityTerms(user, profile));
    if (userCache.size > 5000) userCache.delete(userCache.keys().next().value);
  }
  return userCache.get(userId);
}

const PROFILE_FIELDS = ['title', 'headline', 'summary', 'skills', 'experience', 'education', 'projects', 'certifications', 'location'];
async function currentProfile(userId) {
  if (!userId) return null;
  const attrs = Object.keys(Profile.rawAttributes).filter((a) => PROFILE_FIELDS.includes(a));
  return Profile.findOne({ where: { userId }, attributes: attrs, raw: true });
}

const jobText = (j) => (j ? [j.description, j.requirements].filter(Boolean).join('\n\n') : '');
const jobInput = (j, source) => (j && jobText(j) ? { title: j.title, company: j.company, description: jobText(j), source } : null);

async function externalJobById(id) {
  if (!id) return null;
  return ExternalJob.findByPk(id, { attributes: ['id', 'title', 'company', 'description', 'requirements'], raw: true });
}
async function jobById(id) {
  if (!id) return null;
  return Job.findByPk(id, { attributes: ['id', 'title', 'company', 'description', 'requirements'], raw: true });
}
async function externalJobByUrl(url) {
  if (!url) return null;
  return ExternalJob.findOne({
    where: { [Op.or]: [{ applyUrl: url }, { sourceUrl: url }] },
    attributes: ['id', 'title', 'company', 'description', 'requirements'],
    raw: true,
  });
}

// ── batching ────────────────────────────────────────────────────────────────
async function* rows(Model, { where = {}, attributes } = {}) {
  const base = { ...where };
  if (SINCE) base.createdAt = { [Op.gte]: SINCE };
  let offset = 0;
  let seen = 0;
  while (seen < LIMIT) {
    const batch = await Model.findAll({
      where: base, attributes, raw: true, order: [['createdAt', 'ASC'], ['id', 'ASC']],
      limit: Math.min(BATCH, LIMIT - seen), offset,
    });
    if (!batch.length) return;
    for (const r of batch) { seen++; yield r; }
    offset += batch.length;
  }
}

const nonEmpty = (v) => v != null && !(typeof v === 'object' && Object.keys(v).length === 0) && v !== '';

// ── exporters ───────────────────────────────────────────────────────────────
async function exportTailoring(write) {
  for await (const t of rows(TailoredProfile)) {
    if (!nonEmpty(t.tailoredData)) continue;
    let job = null;
    const ea = await ExternalApplication.findOne({ where: { tailoredProfileId: t.id }, attributes: ['externalJobId'], raw: true });
    if (ea?.externalJobId) job = jobInput(await externalJobById(ea.externalJobId), 'external_application');
    if (!job && t.applyPilotApplicationId) {
      const ap = await ApplyPilotApplication.findByPk(t.applyPilotApplicationId, { attributes: ['jobId', 'externalJobId'], raw: true });
      job = jobInput(await externalJobById(ap?.externalJobId), 'apply_pilot')
        || jobInput(await jobById(ap?.jobId), 'apply_pilot');
    }
    if (!job) job = jobInput(await externalJobByUrl(t.jobUrl), 'url_match');
    if (!job && !INCLUDE_UNPAIRED) { write.skipped('resume_tailoring'); continue; }

    const terms = await identityFor(t.userId);
    await write({
      task: 'resume_tailoring',
      id: t.id,
      user: pseudonym(t.userId),
      created_at: t.createdAt,
      paired: !!job,
      input: {
        job: job || { title: t.jobTitle, company: t.companyName, description: null, source: 'not_stored' },
        resume: scrub(t.originalProfileSnapshot, terms),
      },
      output: {
        tailored_resume: scrub(t.tailoredData, terms),
        match_score: t.matchScore,
        skill_gaps: scrub(t.skillGaps, terms),
        learning_plan: scrub(t.learningPlan, terms),
      },
    });
  }
}

async function exportApplyPilot(write) {
  for await (const a of rows(ApplyPilotApplication)) {
    if (![a.tailoredResume, a.coverLetter, a.whyPicked, a.matchBreakdown].some(nonEmpty) && !a.match) continue;
    const job = jobInput(await externalJobById(a.externalJobId), 'external_job') || jobInput(await jobById(a.jobId), 'job');
    if (!job && !INCLUDE_UNPAIRED) { write.skipped('apply_pilot'); continue; }

    const terms = await identityFor(a.userId);
    await write({
      task: 'apply_pilot',
      id: a.id,
      user: pseudonym(a.userId),
      created_at: a.createdAt,
      paired: !!job,
      input: {
        job: job || { title: a.role, company: a.company, description: null, source: 'not_stored' },
        // The profile as it is today, not as it was when this ran.
        candidate_profile_current: scrub(await currentProfile(a.userId), terms),
      },
      output: {
        match: a.match,
        match_breakdown: scrub(a.matchBreakdown, terms),
        why_picked: scrub(a.whyPicked, terms),
        tailored_resume: scrub(a.tailoredResume, terms),
        cover_letter: scrub(a.coverLetter, terms),
        form_answers: scrub(a.formAnswers, terms),
      },
      // What actually happened. Useful as a quality label for the outputs above.
      outcome: { status: a.status, outcome_type: a.outcomeType, rejection_reason: scrub(a.rejectionReason, terms) },
    });
  }
}

async function exportJobApplications(write) {
  const where = { [Op.or]: [{ aiMatchScore: { [Op.ne]: null } }, { aiAnalysis: { [Op.ne]: null } }] };
  for await (const a of rows(JobApplication, { where })) {
    const job = jobInput(await jobById(a.jobId), 'job');
    if (!job && !INCLUDE_UNPAIRED) { write.skipped('job_application_match'); continue; }
    const terms = await identityFor(a.candidateId);
    const resume = a.parsedResumeData || await currentProfile(a.candidateId);
    await write({
      task: 'job_application_match',
      id: a.id,
      user: pseudonym(a.candidateId || a.guestEmail),
      created_at: a.createdAt,
      paired: !!job && !!resume,
      input: { job, resume: scrub(resume, terms), resume_source: a.parsedResumeData ? 'parsed_resume' : 'current_profile' },
      output: { ai_match_score: a.aiMatchScore, ai_analysis: scrub(a.aiAnalysis, terms) },
      outcome: { status: a.status },
    });
  }
}

async function exportOutputOnly(write) {
  for await (const c of rows(AiAnalysisCache)) {
    const terms = await identityFor(c.userId);
    await write({ task: `${c.kind}_output_only`, id: c.id, user: pseudonym(c.userId), created_at: c.createdAt, paired: false,
      input: null, output: scrub(c.resultJson, terms) });
  }
  for await (const g of rows(GuestAnalysisCache)) {
    await write({ task: 'linkedin_analysis_output_only', id: g.id, user: null, created_at: g.createdAt, paired: false,
      input: { target_title: g.targetTitle }, output: scrub(g.analysisJson, []), model: g.modelUsed });
  }
  for await (const i of rows(CandidateInsights)) {
    const terms = await identityFor(i.userId);
    await write({ task: 'candidate_insights_output_only', id: i.id, user: pseudonym(i.userId), created_at: i.createdAt, paired: false,
      input: null,
      output: scrub({
        strengths_analysis: i.strengthsAnalysis, general_fit_profile: i.generalFitProfile,
        career_narrative: i.careerNarrative, recent_job_assessments: i.recentJobAssessments,
      }, terms) });
  }
}

// ── Cloudinary (the Render web shell has no download) ───────────────────────
function cloudinary() {
  if (!process.env.CLOUDINARY_CLOUD_NAME) throw new Error('CLOUDINARY_CLOUD_NAME is not set');
  const c = require(path.join(BACKEND, 'node_modules/cloudinary')).v2;
  c.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return c;
}

async function uploadPrivately(file) {
  const c = cloudinary();
  const publicId = `profileai/exports/${path.basename(file)}-${crypto.randomBytes(6).toString('hex')}`;
  await c.uploader.upload(file, { resource_type: 'raw', type: 'private', public_id: publicId, overwrite: false });
  const url = c.utils.private_download_url(publicId, '', {
    resource_type: 'raw', type: 'private', attachment: true,
    expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
  });
  log('uploaded as a private file. Download link (valid 24 hours):');
  console.error(`\n${url}\n`);
  log(`once you have the file: node scripts/exportTrainingData.js --delete ${publicId}`);
}

// ── main ────────────────────────────────────────────────────────────────────
(async () => {
  if (DELETE_ID) {
    const res = await cloudinary().uploader.destroy(DELETE_ID, { resource_type: 'raw', type: 'private', invalidate: true });
    log('delete:', res.result);
    return;
  }
  if (UPLOAD && TO_STDOUT) { log('--upload and --stdout cannot be combined'); process.exitCode = 1; return; }

  const gzip = zlib.createGzip();
  const sink = TO_STDOUT ? process.stdout : fs.createWriteStream(OUT);
  gzip.pipe(sink);
  const counts = {};
  const skipped = {};
  const write = (rec) => {
    counts[rec.task] = (counts[rec.task] || 0) + 1;
    if (!gzip.write(JSON.stringify(rec) + '\n')) return new Promise((r) => gzip.once('drain', r));
  };
  write.skipped = (task) => { skipped[task] = (skipped[task] || 0) + 1; };

  try {
    await sequelize.authenticate();
    log(`connected. since=${SINCE ? SINCE.toISOString() : 'all'} limit=${LIMIT} unpaired=${INCLUDE_UNPAIRED}`);
    if (want('resume_tailoring')) { log('resume_tailoring…'); await exportTailoring(write); }
    if (want('apply_pilot')) { log('apply_pilot…'); await exportApplyPilot(write); }
    if (want('job_application_match')) { log('job_application_match…'); await exportJobApplications(write); }
    if (INCLUDE_UNPAIRED && want('output_only')) { log('output-only caches…'); await exportOutputOnly(write); }
  } catch (err) {
    log('FAILED:', err.stack || err.message);
    process.exitCode = 1;
  } finally {
    const done = new Promise((r) => (TO_STDOUT ? gzip.once('end', r) : sink.once('finish', r)));
    gzip.end();
    await done;
    await sequelize.close().catch(() => {});
    log('written:', JSON.stringify(counts));
    if (Object.keys(skipped).length) log('skipped (no job text to pair with):', JSON.stringify(skipped));
    if (!TO_STDOUT) log('file:', OUT, `${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} MB`);
    if (UPLOAD && !process.exitCode) {
      try {
        await uploadPrivately(OUT);
        fs.unlinkSync(OUT);
      } catch (err) {
        log(`upload FAILED (file kept at ${OUT}):`, err.message);
        process.exitCode = 1;
      }
    }
  }
})();
