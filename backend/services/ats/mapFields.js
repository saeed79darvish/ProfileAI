/**
 * mapFields · map the application's stored answers to an ATS form schema.
 *
 * During prep we asked Claude to draft answers for a *generic* set of
 * questions ("Why this company?", "Salary expectations", etc.) and we
 * also know the candidate's Profile (name, email, phone, LinkedIn...).
 * At submission time each ATS gives us a different set of actual field
 * names/ids. This module bridges the two: it uses Claude to fuzzy-match
 * the answers to fields, and deterministically fills the simple
 * identity fields (name / email / resume) without a round-trip.
 */
const { callAI, safeParseJSON } = require('../ai/core');
const { resolveConsentField } = require('./consentHeuristic');

// -------------------------------------------------------------
// Dropdown coercion — for select / radio / multi_select fields the ATS
// will reject anything that isn't an exact option. The LLM tends to
// over-explain ("Yes, I am authorized to work" instead of "Yes"), so we
// resolve the AI's freeform string back to the closest allowed option.
//
// Strategy (in order): exact label, exact value, case-insensitive label,
// case-insensitive value, label substring, value substring. If nothing
// matches we return null and let the caller flag the field as a blocker.
// -------------------------------------------------------------
const SELECT_TYPES = new Set([
  'select', 'multi_select', 'radio', 'react-select',
  'yes_no', 'dropdown',
]);

function isSelectField(field) {
  if (!field) return false;
  const t = String(field.type || '').toLowerCase();
  if (SELECT_TYPES.has(t)) return true;
  // Some adapters omit a clear type but provide options — treat them as select.
  return Array.isArray(field.options) && field.options.length > 0;
}

function normalizeForCompare(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Given an AI-generated answer string (or array, for multi-select) and
 * an options list of either strings or {label, value} objects, return
 * the answer the ATS will actually accept — or null if no option matches.
 *
 * Returns the option's `label` (string) or, for multi-select, an array of
 * labels. Adapter is responsible for label→value translation if needed.
 */
function coerceAnswerToOption(answer, options, { multi = false } = {}) {
  if (answer == null || answer === '') return null;
  if (!Array.isArray(options) || options.length === 0) return answer;

  const normalizedOptions = options.map((opt) => {
    if (opt && typeof opt === 'object') {
      return {
        label: String(opt.label ?? opt.value ?? ''),
        value: String(opt.value ?? opt.label ?? ''),
        normLabel: normalizeForCompare(opt.label ?? opt.value ?? ''),
        normValue: normalizeForCompare(opt.value ?? opt.label ?? ''),
      };
    }
    const s = String(opt);
    return { label: s, value: s, normLabel: normalizeForCompare(s), normValue: normalizeForCompare(s) };
  }).filter((o) => o.label || o.value);

  const resolveOne = (raw) => {
    if (raw == null) return null;
    const str = String(raw).trim();
    if (!str) return null;
    const norm = normalizeForCompare(str);
    if (!norm) return null;

    // 1. Exact label / value match (case-sensitive).
    let hit = normalizedOptions.find((o) => o.label === str || o.value === str);
    if (hit) return hit.label;
    // 2. Case-insensitive label / value match.
    hit = normalizedOptions.find((o) => o.normLabel === norm || o.normValue === norm);
    if (hit) return hit.label;
    // 3. Answer-contains-option: AI returned "Yes, I am authorized" → option "Yes".
    //    Prefer the longest matching option to avoid "No" matching inside "Now".
    hit = normalizedOptions
      .filter((o) => o.normLabel && new RegExp(`(^|\\s)${o.normLabel.replace(/\s+/g, '\\s+')}(\\s|$)`).test(norm))
      .sort((a, b) => b.normLabel.length - a.normLabel.length)[0];
    if (hit) return hit.label;
    // 4. Option-contains-answer: AI returned "authorized" → option "Yes, authorized to work".
    hit = normalizedOptions
      .filter((o) => o.normLabel && o.normLabel.includes(norm) && norm.length >= 2)
      .sort((a, b) => a.normLabel.length - b.normLabel.length)[0];
    if (hit) return hit.label;
    return null;
  };

  if (multi) {
    const arr = Array.isArray(answer)
      ? answer
      : String(answer).split(/\s*[,;\n]\s*/).filter(Boolean);
    const resolved = arr.map(resolveOne).filter(Boolean);
    return resolved.length ? resolved : null;
  }

  // Single-select: if the AI helpfully returned an array, pick the first match.
  if (Array.isArray(answer)) {
    for (const a of answer) {
      const r = resolveOne(a);
      if (r) return r;
    }
    return null;
  }
  return resolveOne(answer);
}

// -------------------------------------------------------------
// Deterministic pass — the "you already know these" fields.
// Covers 60–70% of a typical Greenhouse form without an LLM call.
// Returns a partial { fieldKey: value } plus the unmatched fields.
// -------------------------------------------------------------
const IDENTITY_MATCHERS = [
  { keys: ['first_name', 'firstname', 'fname', 'givenname'],
    get: ({ user }) => user?.firstName },
  { keys: ['last_name', 'lastname', 'lname', 'familyname', 'surname'],
    get: ({ user }) => user?.lastName },
  { keys: ['full_name', 'name', 'fullname'],
    get: ({ user }) => [user?.firstName, user?.lastName].filter(Boolean).join(' ') },
  { keys: ['email', 'emailaddress', 'email_address'],
    get: ({ user }) => user?.email },
  { keys: ['phone', 'phonenumber', 'phone_number', 'mobile', 'tel', 'telephone'],
    get: ({ profile }) => profile?.phone },
  { keys: ['linkedin', 'linkedin_url', 'linkedin_profile', 'urls[linkedin]'],
    get: ({ profile }) => profile?.linkedinUrl },
  { keys: ['github', 'github_url', 'urls[github]'],
    get: ({ profile }) => profile?.githubUrl },
  { keys: ['website', 'portfolio', 'portfolio_url', 'urls[portfolio]', 'urls[website]'],
    get: ({ profile }) => profile?.portfolioUrl || profile?.websiteUrl },
  { keys: ['location', 'city', 'current_location', 'candidate_location', 'candidatelocation', 'candidate-location'],
    get: ({ profile }) => profile?.location },
  { keys: ['zip', 'zipcode', 'zip_code', 'postalcode', 'postal_code'],
    get: ({ profile }) => profile?.zipCode },
];

function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Check whether a normalised candidate string matches a normalised key.
 * Exact equality always works.  For substring matching we require the key
 * to be long enough (≥ 5 chars) to avoid false positives from short keys
 * like "tel" matching inside "candidatelocation" or "city" inside
 * "ethnicity".
 */
function keyMatches(candidate, normKey) {
  if (candidate === normKey) return true;
  if (normKey.length >= 5 && candidate.includes(normKey)) return true;
  return false;
}

function fillIdentityFields(fields, ctx) {
  const mapped = {};
  const remaining = [];
  for (const f of fields) {
    // Prefer matching by `name`, then `label`, then `id`.
    const candidates = [f.name, f.label, f.id].map(normalize).filter(Boolean);
    const matcher = IDENTITY_MATCHERS.find((m) =>
      m.keys.some((k) => candidates.some((c) => keyMatches(c, normalize(k))))
    );
    if (matcher) {
      const v = matcher.get(ctx);
      if (process.env.APPLYPILOT_DEBUG) {
        console.log(`[DEBUG] identity match: ${f.name} → "${v}" (keys: ${matcher.keys.join(',')})`);
      }
      if (v != null && v !== '') {
        mapped[f.name || f.id] = v;
        continue;
      }
    }
    remaining.push(f);
  }
  return { mapped, remaining };
}

// -------------------------------------------------------------
// Consent/attestation pass — for any required single-checkbox field
// that looks like a universal acknowledgment ("I agree", "I certify",
// GDPR/EEO accuracy-of-information), resolve it without a round-trip.
// Training memory overrides the heuristic in both directions; see
// ./consentHeuristic.js for the layered rules.
//
// Returns { mapped, resolutions, remaining } — resolutions get
// forwarded up into the submission receipt so the Review timeline can
// show every auto-resolved field.
// -------------------------------------------------------------
function applyConsentHeuristic(fields, { memory }) {
  const mapped = {};
  const resolutions = [];
  const remaining = [];
  for (const f of fields) {
    const decision = resolveConsentField(f, memory);
    if (!decision) {
      remaining.push(f);
      continue;
    }
    // Translate the decision into a field value the adapter can consume.
    //   - 'yes' → 'yes' (Puppeteer fillField treats this as click, the
    //     Greenhouse API adapter encodes it as a truthy string).
    //   - 'no' → skip: intentionally DO NOT map, so the checkbox stays
    //     unchecked. Still record the resolution so the timeline knows
    //     the field was considered.
    if (decision.value === 'yes') {
      mapped[f.name || f.id] = 'yes';
    }
    resolutions.push({
      fieldName: f.name || f.id,
      label: f.label || f.rawName || '',
      value: decision.value,
      resolvedVia: decision.via,
      reason: decision.reason,
      at: new Date().toISOString(),
    });
  }
  return { mapped, resolutions, remaining };
}

// -------------------------------------------------------------
// LLM pass — for every field we couldn't auto-fill, ask Claude to
// pick the best answer from formAnswers (prepped earlier) or synthesize
// one from memory. Returns both the mapping and a list of fields that
// Claude wasn't confident about (human-in-loop signal).
// -------------------------------------------------------------
// "How did you hear about this job?" pickers. Preference order matches
// how ApplyPilot actually finds jobs (job boards / job sites), then the
// usual generic fallbacks.
const REFERRAL_LABEL_RE = /how did you (hear|find|learn)|where did you (hear|find|see)|referral source|source of (this )?(application|referral)|how were you referred/i;
const REFERRAL_PREFS = [/job (site|board)|online job|job search (site|engine)/i, /internet|online|web/i, /company (website|site|career)|careers? (page|site)/i, /linkedin/i, /^other/i];
function answerReferralSource(fields) {
  const mapped = {};
  const remaining = [];
  for (const f of fields) {
    const opts = Array.isArray(f.options) ? f.options.map((o) => (typeof o === 'string' ? o : (o?.label ?? o?.value))).filter(Boolean) : [];
    if (!REFERRAL_LABEL_RE.test(String(f.label || '')) || !opts.length) { remaining.push(f); continue; }
    let pick = null;
    for (const re of REFERRAL_PREFS) { pick = opts.find((o) => re.test(String(o))); if (pick) break; }
    if (!pick) { remaining.push(f); continue; }
    mapped[f.name || f.id] = pick;
  }
  return { mapped, remaining };
}

// Prep sometimes drafts stubs like "[email not provided in profile]".
// Passing those to the matcher risks typing the stub into a real form,
// so they are dropped; identity fields are filled from the account.
function isPlaceholderAnswer(v) {
  const s = String(v == null ? '' : v).trim();
  return !s || /^\[[^\]]*\]$/.test(s) || /not provided in (your |the )?profile/i.test(s);
}
function usableDrafts(formAnswers) {
  return (Array.isArray(formAnswers) ? formAnswers : []).filter((a) => a && !isPlaceholderAnswer(a.answer));
}

async function llmMatchFields(fields, { app, profile, user, memory = [], demographics = {}, job = null }) {
  if (!fields.length) return { mapped: {}, lowConfidence: [] };

  // Build a demographics section for the prompt if the candidate has
  // filled in any demographic / EEO answers in their ApplyPilot setup.
  const demoLines = [];
  if (demographics.workAuthorization) demoLines.push(`- Work authorization: ${demographics.workAuthorization}`);
  if (demographics.sponsorship) demoLines.push(`- Requires sponsorship: ${demographics.sponsorship}`);
  if (demographics.gender || demographics.genderIdentity) {
    demoLines.push(`- Gender identity: ${demographics.genderIdentity || demographics.gender}`);
  }
  if (demographics.transgender) demoLines.push(`- Transgender experience: ${demographics.transgender}`);
  if (demographics.sexualOrientation) demoLines.push(`- Sexual orientation: ${demographics.sexualOrientation}`);
  if (demographics.disability) demoLines.push(`- Disability (ADA): ${demographics.disability}`);
  if (demographics.veteran) demoLines.push(`- Veteran status: ${demographics.veteran}`);
  if (Array.isArray(demographics.ethnicity) && demographics.ethnicity.length) {
    demoLines.push(`- Race / Ethnicity (NOT location): ${demographics.ethnicity.join(', ')}`);
  }
  const demoBlock = demoLines.length
    ? `\nDEMOGRAPHICS / EEO (use these for any self-identification or work-eligibility fields):\n${demoLines.join('\n')}\n`
    : '';

  // Rich profile context — without these, the LLM has nothing to draw on
  // when a custom long-form question (e.g. "Briefly describe a project
  // where you applied RAG / agentic workflows…") isn't covered by the
  // generic pre-drafted formAnswers. We include experience bullets,
  // skills, and recent projects so the LLM can SYNTHESISE a tailored
  // free-text answer rather than returning null and silently skipping
  // the field.
  const experienceBlock = (() => {
    const xs = Array.isArray(profile?.experience) ? profile.experience : [];
    if (!xs.length) return '(none)';
    return xs.slice(0, 6).map((x) => {
      const bullets = Array.isArray(x.achievements)
        ? x.achievements.slice(0, 3).map((b) => `    • ${String(b).slice(0, 220)}`).join('\n')
        : '';
      const desc = !bullets && x.description ? `    ${String(x.description).slice(0, 320)}` : '';
      return `- ${x.title || x.role || 'Role'} @ ${x.company || ''} (${x.startDate || ''}–${x.endDate || x.current ? 'present' : ''})\n${bullets || desc}`.trim();
    }).join('\n');
  })();
  const skillsBlock = (() => {
    const s = profile?.skills;
    if (!s) return '(none)';
    if (Array.isArray(s)) return s.slice(0, 40).map((x) => x?.name || x).filter(Boolean).join(', ');
    if (typeof s === 'object') {
      const flat = []
        .concat(s.core || [], s.technical || [], s.software || [], s.industry || [], s.soft || []);
      return flat.slice(0, 40).map((x) => x?.name || x).filter(Boolean).join(', ') || '(none)';
    }
    return '(none)';
  })();
  const projectsBlock = (() => {
    const ps = Array.isArray(profile?.projects) ? profile.projects : [];
    if (!ps.length) return '(none)';
    return ps.slice(0, 4).map((p) => {
      const tech = Array.isArray(p.techStack) ? p.techStack.slice(0, 8).join(', ') : '';
      return `- ${p.title || p.name || 'Project'}: ${(p.description || '').slice(0, 220)}${tech ? ` [${tech}]` : ''}`;
    }).join('\n');
  })();
  // Without education the LLM had to answer every "Do you have a
  // Bachelor's degree…?" screener with null, which blocked the whole
  // application even for candidates with the degree on their profile.
  const educationBlock = (() => {
    const es = Array.isArray(profile?.education) ? profile.education : [];
    const lines = es.filter((e) => e && typeof e === 'object').slice(0, 4).map((e) => {
      const school = e.institution || e.school || e.name || '';
      const degree = e.degree || e.degreeType || '';
      const field = e.field || e.fieldOfStudy || e.major || '';
      const end = e.endDate || e.graduationDate || e.year || '';
      return `- ${[degree, field && `in ${field}`].filter(Boolean).join(' ') || 'Studies'}${school ? `, ${school}` : ''}${end ? ` (${end})` : ''}`;
    });
    return lines.length ? lines.join('\n') : '(none)';
  })();
  const locationLine = profile?.location || profile?.currentLocation || '';

  // Long dropdowns (universities, countries, "how did you hear") used to
  // be cut to their first 12 options, so the right answer was usually
  // not in what the LLM saw and it had to return null. Short lists go in
  // whole; long ones are narrowed to options that share a word with the
  // candidate's own data, plus catch-alls like "Other".
  // Each hint word carries a weight: the candidate's school words count
  // most, so "University of California, Davis" outranks the dozens of
  // options that only share a common word like "San" or "State".
  const hintWeights = (() => {
    const stop = new Set(['the', 'and', 'for', 'university', 'college', 'school', 'institute', 'state', 'of', 'in', 'at']);
    const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !stop.has(w));
    const w = new Map();
    const add = (texts, weight) => texts.flatMap(words).forEach((x) => w.set(x, Math.max(w.get(x) || 0, weight)));
    const edu = Array.isArray(profile?.education) ? profile.education : [];
    add(edu.flatMap((e) => [e?.institution, e?.school, e?.name]), 3);
    add(edu.flatMap((e) => [e?.degree, e?.field]), 2);
    add([locationLine, ...(app.formAnswers || []).map((a) => a?.answer), 'United States', 'Company website', 'LinkedIn'], 1);
    return { w, words };
  })();
  const optionsForPrompt = (opts) => {
    if (!Array.isArray(opts)) return undefined;
    if (opts.length <= 40) return opts;
    const scored = opts.map((o) => {
      const label = String(o?.label || o?.value || '');
      const score = hintWeights.words(label).reduce((s, x) => s + (hintWeights.w.get(x) || 0), 0)
        + (/^(other|none|prefer not|decline)/i.test(label) ? 0.5 : 0);
      return { o, score };
    }).filter((x) => x.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 40).map((x) => x.o);
  };
  const jdBlock = (() => {
    const desc = job?.description || job?.jobDescription || job?.requirements || '';
    return desc ? String(desc).slice(0, 1200) : '(no JD captured)';
  })();

  const prompt = `You are filling an ATS application form on behalf of a candidate. Return JSON only.

You have TWO jobs:
  (a) MATCH the candidate's pre-drafted answers to the ATS field schema, and
  (b) GENERATE tailored answers for any custom free-text questions that the pre-drafted set doesn't cover (e.g. "Describe a project where you applied X", "Why do you want to work here?", "What resonates with our mission?"). Use the candidate's experience, skills, projects, cover letter, and memory as raw material. NEVER fabricate employers, titles, dates, or numeric metrics that aren't in the source material.

CANDIDATE
- Name: ${[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Unknown'}
- Email: ${user?.email || ''}
- Headline: ${profile?.headline || profile?.title || ''}
- Lives in: ${locationLine || 'Unknown'}
- Summary: ${(profile?.summary || '').slice(0, 600)}
- Skills: ${skillsBlock}

EDUCATION:
${educationBlock}

APPLICATION ANSWERS THE CANDIDATE GAVE IN SETUP (use these directly):
- Phone: ${profile?.phone || 'Unknown'}
- Salary expectation: ${profile?.salaryExpectation || 'Unknown'}
- Can start: ${profile?.noticePeriod || 'Unknown'}
- Willing to relocate: ${profile?.relocationWillingness === true ? 'Yes' : profile?.relocationWillingness === false ? 'No' : 'Depends on the role'}
- LinkedIn: ${profile?.linkedinUrl || 'Unknown'}
- GitHub: ${profile?.githubUrl || 'Unknown'}
- Website / portfolio: ${profile?.portfolioUrl || 'Unknown'}

EXPERIENCE (most recent first):
${experienceBlock}

PROJECTS:
${projectsBlock}

MEMORY (things the candidate taught the agent — quote verbatim when fit):
${(memory || []).slice(0, 20).map((m) => `- ${m.topic}/${m.key}: ${m.value}`).join('\n') || '(none)'}

PRE-DRAFTED ANSWERS (from application prep — generic Q&A; the actual ATS form usually has additional custom questions not covered here):
${JSON.stringify(usableDrafts(app.formAnswers).slice(0, 20), null, 2)}

COVER LETTER (lift relevant sentences when answering "why us / why this role"):
${(app.coverLetter || '').slice(0, 1200)}
${demoBlock}
JOB:
- Company: ${app.company || ''}
- Role: ${app.role || ''}
- Description: ${jdBlock}

UNMATCHED ATS FIELDS (one mapping per field please):
${JSON.stringify(fields.map((f) => ({
  name: f.name, label: f.label, type: f.type, required: !!f.required,
  options: optionsForPrompt(f.options), maxLength: f.maxLength,
})), null, 2)}

Rules:
- If the field is a short identity field (name/email/phone/linkedin) and you DO know it, fill it.
- For FREE-TEXT fields (textarea, text without options): if a pre-drafted answer fits, use it; OTHERWISE WRITE A FRESH ANSWER (1-4 sentences, candidate's voice, grounded in the EXPERIENCE / PROJECTS / SKILLS / COVER LETTER / MEMORY above). Do NOT return null for optional or required free-text fields just because there's no exact pre-drafted match — synthesise from the source material. Only return null if you genuinely have no relevant material at all (e.g. asks about a technology the candidate has zero experience with).
- For long/essay fields (label mentions "describe", "tell us", "briefly", "what resonates", "why", "how would you", or maxLength ≥ 300, or type=textarea): always attempt synthesis. Pick the most relevant project/experience and tell a concrete story.
- For select/radio fields WITH provided options, return one of the provided options EXACTLY (verbatim, character-for-character — do NOT paraphrase, do NOT add explanations, do NOT change capitalization), or null. Example: options=["Yes","No"] → answer="Yes" not "Yes, I am authorized to work in the US".
- For multi_select fields, return an array of exact option strings.
- For select/radio/react-select fields WITHOUT options listed, infer the best answer from DEMOGRAPHICS, PRE-DRAFTED ANSWERS, or MEMORY. Use the most common option phrasing (e.g. "Yes", "No", "Male", "Female", "Prefer not to say", "I decline to self-identify").
- For EEO / demographic / self-identification / work-eligibility fields, match from the DEMOGRAPHICS section above. If the candidate hasn't disclosed (no value in DEMOGRAPHICS) and a "Decline to self-identify" / "Prefer not to say" option exists, choose it. Never fabricate ethnicity, gender, veteran, or disability status.
- For "How did you hear about us" / referral-source fields WITH options, always pick the closest option (e.g. "Job Board" or "LinkedIn" → "Job site" / "LinkedIn" / "Online job board"; otherwise "Company website" or "Other"). Never return null for these: they are not facts about the candidate.
- For COUNTRY / country-of-residence fields, answer from "Lives in". A US city or state (e.g. "San Francisco, CA") means "United States"; pick the matching option verbatim. Only return null when "Lives in" is Unknown.
- For EDUCATION / degree questions, answer from EDUCATION. A Bachelor's or higher in Computer Science, Math, Statistics, Physics, Engineering, Economics or Data Science counts as a "quantitative" field. If EDUCATION is (none), return null; never invent a degree.
- For a "Degree" dropdown when EDUCATION has no degree level (bootcamps, certificates, extension programs): pick the option that honestly describes it, such as "Certificate", "Other", "Some college" or "No degree", whichever exists. Do not return null when such an option exists. For "Discipline" / "Field of study" pick the option closest to the field of study in EDUCATION (e.g. software engineering or programming -> "Computer Science"). For "School" pick the closest institution or "Other".
- For salary expectation / desired pay questions, answer with the Salary expectation above (as a number or range, matching the field's format). Only return null when it is Unknown.
- For phone, notice period / start date, relocation and links, use APPLICATION ANSWERS THE CANDIDATE GAVE IN SETUP. Only return null when the value is Unknown.
- For SECURITY CLEARANCE / EXPORT CONTROL fields: only answer "Yes" if the candidate's MEMORY or DEMOGRAPHICS explicitly states they hold one. Otherwise pick the option that means "No" / "N/A — never held". Never claim a clearance the candidate didn't disclose.
- Respect \`maxLength\` if given — clamp synthesised answers to fit.
- IMPORTANT: Provide a mapping for EVERY field in the list. For fields you genuinely cannot answer, set answer to null and add a short reason.

Return JSON:
{
  "mappings": [
    { "fieldName": "...", "answer": "..." | null, "confidence": 0-100, "reason": "..." }
  ]
}`;

  const res = await callAI({
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4000,
    temperature: 0.3,
  });
  const raw = res.choices[0].message.content.trim();
  const jsonSlice = raw.match(/\{[\s\S]*\}/)?.[0] || raw;
  const parsed = safeParseJSON(jsonSlice, { mappings: [] });

  const mapped = {};
  const lowConfidence = [];
  for (const row of parsed.mappings || []) {
    if (!row?.fieldName) continue;
    const field = fields.find((f) => (f.name || f.id) === row.fieldName);
    if (!field) continue;
    if (row.answer == null || row.answer === '') {
      if (field.required) {
        lowConfidence.push({ field, reason: row.reason || 'Claude could not answer' });
      }
      continue;
    }

    // For select/radio/dropdown fields with options, coerce the AI's
    // answer back to one of the allowed option strings. The ATS will
    // reject anything else, so an un-coerceable answer becomes a blocker
    // rather than letting the submission fail at the network call.
    if (isSelectField(field) && Array.isArray(field.options) && field.options.length) {
      const isMulti = String(field.type || '').toLowerCase() === 'multi_select';
      const coerced = coerceAnswerToOption(row.answer, field.options, { multi: isMulti });
      if (coerced == null) {
        if (field.required) {
          lowConfidence.push({
            field,
            reason: `AI answer "${String(row.answer).slice(0, 60)}" did not match any option (${field.options.slice(0, 4).map((o) => (o?.label ?? o)).join(' / ')}${field.options.length > 4 ? ' …' : ''})`,
          });
        }
        continue;
      }
      const finalVal = Array.isArray(coerced) ? coerced.join(', ') : coerced;
      mapped[field.name || field.id] = finalVal;
      if ((row.confidence ?? 100) < 55 && field.required) {
        lowConfidence.push({ field, reason: row.reason || 'low confidence' });
      }
      continue;
    }

    // Clamp to maxLength so form validation doesn't bounce.
    let answer = String(row.answer);
    if (field.maxLength && answer.length > field.maxLength) {
      answer = answer.slice(0, field.maxLength);
    }
    mapped[field.name || field.id] = answer;

    if ((row.confidence ?? 100) < 55 && field.required) {
      lowConfidence.push({ field, reason: row.reason || 'low confidence' });
    }
  }

  // Any required fields we still have no answer for are blocking.
  for (const f of fields) {
    const key = f.name || f.id;
    if (f.required && mapped[key] == null) {
      if (!lowConfidence.find((l) => (l.field.name || l.field.id) === key)) {
        lowConfidence.push({ field: f, reason: 'required but unmapped' });
      }
    }
  }

  return { mapped, lowConfidence };
}

/**
 * Main entry. Adapters call this once they've extracted the ATS field
 * schema. Returns:
 *   {
 *     values:      { [fieldName]: string },   // fill these
 *     blockers:    [{ field, reason }]        // pause & ping the candidate
 *     resolutions: [{ fieldName, label, value, resolvedVia, reason, at }]
 *                                             // audit trail for auto-resolved
 *                                             // consent/attestation fields.
 *                                             // Forwarded to the receipt so
 *                                             // Review's timeline can render
 *                                             // exactly what got auto-ticked.
 *   }
 */
async function mapFormFields({ app, fields, profile, user, memory, demographics, job = null }) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return { values: {}, blockers: [], resolutions: [] };
  }

  // Defense in depth: file-type fields (resume, cover letter PDF, etc.)
  // are handled by the adapter's buildFormBody, never by Claude. If an
  // adapter forgets to filter them out, we'd flag them as required-but-
  // unmapped and falsely block the submission.
  const mappable = fields.filter((f) => f.type !== 'file');

  const ctx = { app, profile, user, memory, demographics, job };
  // Pass 1 — deterministic identity fields (name/email/phone/…).
  const pass1 = fillIdentityFields(mappable, ctx);
  // Pass 2 — consent/attestation checkboxes via training-memory or the
  // conservative label heuristic.
  const pass2 = applyConsentHeuristic(pass1.remaining, ctx);
  // Pass 2b — "How did you hear about us?" is not a fact about the
  // candidate, so it's answered by rule instead of pausing on an unsure AI.
  const pass2b = answerReferralSource(pass2.remaining);
  // Pass 3 — everything else → LLM.
  const pass3 = await llmMatchFields(pass2b.remaining, ctx);

  return {
    values: { ...pass1.mapped, ...pass2.mapped, ...pass2b.mapped, ...pass3.mapped },
    blockers: pass3.lowConfidence,
    resolutions: pass2.resolutions,
  };
}

module.exports = { mapFormFields, fillIdentityFields, applyConsentHeuristic, coerceAnswerToOption };
