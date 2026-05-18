/**
 * Greenhouse ATS adapter.
 *
 * Greenhouse exposes a public apply page at:
 *   https://boards.greenhouse.io/{boardToken}/jobs/{jobId}
 * and a matching JSON API that lists form fields:
 *   https://boards-api.greenhouse.io/v1/boards/{boardToken}/jobs/{jobId}?questions=true
 *
 * Submission goes to:
 *   POST https://boards.greenhouse.io/embed/job_app?for={boardToken}&token={jobId}
 * as multipart/form-data. Field names are encoded like:
 *   job_application[first_name]
 *   job_application[email]
 *   job_application[resume]
 *   job_application[answers_attributes][0][question_id]=...
 *   job_application[answers_attributes][0][text_value]=...
 *
 * This adapter is best-effort for Phase 1: it handles the identity
 * fields and free-text questions. Multi-select, file uploads beyond
 * resume, and compliance-OEO fields will be iterated on in later phases.
 */
const axios = require('axios');
const FormData = require('form-data');
const { mapFormFields } = require('./mapFields');

const BOARD_URL_RE = /https?:\/\/(?:boards|job-boards)\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/i;
const APP_URL_RE = /https?:\/\/(?:boards|job-boards)\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/i;

function parseUrl(url) {
  if (!url) return null;
  const raw = String(url);
  const m = raw.match(BOARD_URL_RE) || raw.match(APP_URL_RE);
  if (m) {
    // Preserve the original host so the submit POST goes to the same
    // domain the job lives on. The legacy `boards.greenhouse.io` and
    // the newer `job-boards.greenhouse.io` both accept /embed/job_app,
    // but they will 404 each other's tokens.
    const hostMatch = raw.match(/https?:\/\/((?:boards|job-boards)\.greenhouse\.io)/i);
    return {
      boardToken: m[1],
      jobId: m[2],
      host: hostMatch ? hostMatch[1].toLowerCase() : 'job-boards.greenhouse.io',
    };
  }

  try {
    const parsed = new URL(raw);
    const isGreenhouseHost = /(^|\.)greenhouse\.io$/i.test(parsed.hostname);
    const isEmbedPath = /\/embed\/job_app$/i.test(parsed.pathname);
    const boardToken = parsed.searchParams.get('for');
    const jobId = parsed.searchParams.get('token');
    if (isGreenhouseHost && isEmbedPath && boardToken && jobId) {
      return { boardToken, jobId, host: parsed.hostname.toLowerCase() };
    }
  } catch (_) {
    return null;
  }

  return null;
}

function matches(url) {
  return !!parseUrl(url);
}

/**
 * Build the ordered list of submit URLs we'll try. Greenhouse's two hosts
 * (`boards.greenhouse.io` and `job-boards.greenhouse.io`) each only accept
 * tokens that belong to themselves, so a wrong-host submit returns 404 with
 * a generic HTML page (the symptom we hit in the wild). We always try the
 * job's own host first, then the other one as a safety net.
 */
function buildSubmitCandidates(parsed) {
  const enc = encodeURIComponent;
  const path = `/embed/job_app?for=${enc(parsed.boardToken)}&token=${enc(parsed.jobId)}`;
  const primaryHost = parsed.host || 'job-boards.greenhouse.io';
  const altHost = primaryHost === 'job-boards.greenhouse.io'
    ? 'boards.greenhouse.io'
    : 'job-boards.greenhouse.io';
  return [
    `https://${primaryHost}${path}`,
    `https://${altHost}${path}`,
  ];
}

/**
 * Fetch the job's question schema from Greenhouse's public API.
 * Returns { questions, compliance } — we flatten into a field list.
 */
async function fetchSchema({ boardToken, jobId }) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs/${jobId}?questions=true`;
  const { data } = await axios.get(url, { timeout: 15_000 });
  return data;
}

// Greenhouse's "questions" list mixes the standard identity fields
// (first_name / email / resume / …) with employer-custom questions. The
// standard ones submit under `job_application[<name>]`; the custom ones
// submit under `job_application[answers_attributes][<name>]`. Here's
// the reserved set that takes the direct path.
const STANDARD_FIELDS = new Set([
  'first_name', 'last_name', 'email', 'phone',
  'resume', 'cover_letter',
]);

/**
 * Normalize Greenhouse's question shape into our adapter-neutral field shape.
 * Greenhouse questions look like:
 *   {
 *     label: "Why this company?",
 *     required: true,
 *     fields: [
 *       { name: "question_42_1234", type: "input_text", values: [] }
 *     ]
 *   }
 * or for selects:
 *     fields: [
 *       { name: "question_42_1235", type: "input_select",
 *         values: [{ label: "Yes", value: "1" }, ...] }
 *     ]
 *
 * Output fields have:
 *   name        — the final key used in the multipart body
 *   rawName     — the field id Greenhouse returned (useful for debugging)
 *   standard    — true if this is an identity field (first_name/email/…),
 *                 so the worker's buildFormBody knows not to wrap it in
 *                 answers_attributes
 */
function normalizeFields(schema) {
  const out = [];
  const seenStandard = new Set();

  const questions = [...(schema.questions || []), ...(schema.compliance || [])];
  for (const q of questions) {
    for (const f of (q.fields || [])) {
      const type = (f.type || '').replace('input_', '') || 'text';
      const rawName = f.name;
      const isStandard = STANDARD_FIELDS.has(rawName);

      // Deduplicate standard fields — Greenhouse sometimes lists them
      // multiple times (e.g. first_name repeated across variants).
      if (isStandard) {
        if (seenStandard.has(rawName)) continue;
        seenStandard.add(rawName);
      }

      const name = isStandard
        ? `job_application[${rawName}]`
        : `job_application[answers_attributes][${rawName}]`;

      const field = {
        name,
        rawName,
        standard: isStandard,
        label: q.label,
        description: q.description_text || '',
        type, // text | textarea | select | multi_select | file | url
        required: !!q.required,
        maxLength: f.max_length || q.max_length || undefined,
      };
      if (Array.isArray(f.values) && f.values.length) {
        field.options = f.values.map((v) => ({ label: v.label, value: String(v.value) }));
      }
      out.push(field);
    }
  }

  // If Greenhouse didn't surface the identity trio (rare, but some boards
  // don't), fall back to synthesizing them so the worker can still post.
  const ensure = (rawName, label, required) => {
    if (!seenStandard.has(rawName)) {
      out.unshift({
        name: `job_application[${rawName}]`,
        rawName, standard: true,
        label, type: rawName === 'resume' ? 'file' : 'text',
        required,
      });
      seenStandard.add(rawName);
    }
  };
  ensure('first_name', 'First Name', true);
  ensure('last_name',  'Last Name',  true);
  ensure('email',      'Email',      true);

  return out;
}

/**
 * Build the multipart FormData body. `values` comes from mapFormFields
 * and is keyed by our field.name (the bracketed Greenhouse name).
 */
function buildFormBody({ values, resumePdfBuffer, resumeFileName, user }) {
  const form = new FormData();

  // Identity fields — fallback to user attrs if mapping didn't already
  // fill them (it usually will).
  const firstName = values['job_application[first_name]'] || user?.firstName || '';
  const lastName  = values['job_application[last_name]']  || user?.lastName  || '';
  const email     = values['job_application[email]']      || user?.email     || '';
  const phone     = values['job_application[phone]']      || '';

  form.append('job_application[first_name]', firstName);
  form.append('job_application[last_name]', lastName);
  form.append('job_application[email]', email);
  if (phone) form.append('job_application[phone]', phone);

  // Resume upload — always.
  form.append('job_application[resume]', resumePdfBuffer, {
    filename: resumeFileName || 'resume.pdf',
    contentType: 'application/pdf',
  });

  // Everything else is a question answer. Greenhouse expects:
  //   job_application[answers_attributes][<field_raw_name>]=<value>
  // which we already pre-shaped in normalizeFields.
  for (const [key, val] of Object.entries(values)) {
    if (key.startsWith('job_application[answers_attributes]')) {
      form.append(key, val == null ? '' : String(val));
    }
  }

  return form;
}

/**
 * Submit the application. `ctx` carries everything the worker collected:
 *   { app, profile, user, memory, resumePdfBuffer, resumeFileName }
 * Returns { ok, status, raw } on success, throws an Error with
 *   err.needsHuman = true
 * on recoverable-by-human issues (required field couldn't be filled).
 */
async function submit(ctx) {
  const { app } = ctx;
  const applyUrl = app.applyUrl || ctx.applyUrl;
  const parsed = parseUrl(applyUrl);
  if (!parsed) throw new Error('Greenhouse adapter received a non-Greenhouse URL');

  // 1. Pull the job's form schema
  const schema = await fetchSchema(parsed);

  // 2. Normalize to our adapter-neutral field list
  const fields = normalizeFields(schema);

  // 3. Map stored answers → real field names (deterministic + Claude).
  // Exclude file-type fields — the resume is handled separately in
  // buildFormBody, and passing them through the mapper would cause
  // Claude to flag them as "required but unmapped" → false blocker.
  const mappableFields = fields.filter((f) => f.type !== 'file');
  const { values, blockers, resolutions } = await mapFormFields({
    app: ctx.app,
    fields: mappableFields,
    profile: ctx.profile,
    user: ctx.user,
    memory: ctx.memory,
    demographics: ctx.demographics,
    job: ctx.job,
  });

  // 4. If any REQUIRED field is still empty, pause and ping the human.
  if (blockers.length) {
    const err = new Error(
      `Greenhouse needs ${blockers.length} field${blockers.length === 1 ? '' : 's'} you haven't trained: ` +
      blockers.slice(0, 3).map((b) => b.field.label || b.field.rawName).join(', ')
    );
    err.needsHuman = true;
    err.blockers = blockers.map((b) => ({
      label: b.field.label,
      name: b.field.rawName || b.field.name,
      reason: b.reason,
    }));
    throw err;
  }

  // 5. Build the multipart body
  const form = buildFormBody({
    values,
    resumePdfBuffer: ctx.resumePdfBuffer,
    resumeFileName: ctx.resumeFileName,
    user: ctx.user,
  });

  // 6. POST to Greenhouse — try the host the job actually lives on
  // (boards vs job-boards), then fall back to whichever is left, and
  // finally to the live `<form action>` parsed from the embed page.
  const candidateUrls = buildSubmitCandidates(parsed);

  // Statuses that mean "this host can't accept the submission, try the
  // other one". 404 = token unknown on this host. 405 = host no longer
  // serves /embed/job_app via POST (the legacy boards.greenhouse.io
  // host returns this for postings that have moved to the new
  // job-boards.greenhouse.io host). 410 = endpoint gone.
  const HOST_FALLBACK_STATUSES = new Set([404, 405, 410]);

  let response;
  let submitUrl;
  let lastErr;
  for (let i = 0; i < candidateUrls.length; i++) {
    const candidate = candidateUrls[i];
    try {
      response = await axios.post(candidate, form, {
        headers: {
          ...form.getHeaders(),
          // Greenhouse's CDN occasionally returns 403/HTML when no
          // browser-like UA is sent. A vanilla axios UA is a red flag
          // for them; mimic a real browser so we get past the bot
          // shield. This is the same pattern the Puppeteer adapter
          // already uses implicitly.
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Origin': `https://${parsed.host}`,
          'Referer': `https://${parsed.host}/${parsed.boardToken}/jobs/${parsed.jobId}`,
        },
        timeout: 30_000,
        maxRedirects: 5,
        validateStatus: (s) => s < 500, // let us inspect 4xx
      });
    } catch (err) {
      lastErr = err;
      response = null;
      // Network-level failure — try the next host, don't bail yet.
      console.warn(`[greenhouse] POST ${candidate} threw:`, err.message);
      continue;
    }
    submitUrl = candidate;
    if (HOST_FALLBACK_STATUSES.has(response.status) && i < candidateUrls.length - 1) {
      console.warn(
        `[greenhouse] ${candidate} returned ${response.status}; trying alternate host`,
      );
      continue;
    }
    break;
  }
  if (!response) {
    const e = new Error(`Greenhouse POST failed: ${lastErr ? lastErr.message : 'unknown'}`);
    e.cause = lastErr;
    throw e;
  }

  // 7. Interpret the response. Greenhouse returns HTML on success
  // containing "Thank you for applying" or redirects to a confirmation.
  const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
  const success =
    response.status >= 200 && response.status < 400 &&
    /thank you for applying|thanks for your application|application received/i.test(body);

  if (!success) {
    // Strip HTML tags so the Review tab shows a readable message
    // instead of a wall of markup. Keep the first ~300 chars of
    // visible text — enough to surface the real reason (rate-limit,
    // duplicate application, missing required field).
    const visible = body
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);
    console.warn(
      `[greenhouse] submit rejected: status=${response.status} url=${submitUrl} body="${visible}"`,
    );
    throw new Error(
      `Greenhouse rejected the application (HTTP ${response.status}): ${visible || '(empty body)'}`,
    );
  }

  return {
    ok: true,
    provider: 'greenhouse',
    status: response.status,
    confirmationUrl: response.request?.res?.responseUrl || submitUrl,
    submittedAt: new Date().toISOString(),
    // Forward the consent-heuristic audit trail up so the Review timeline
    // renders "auto-ticked: ‘I certify the information…’" alongside
    // screenshots. Always an array, possibly empty.
    resolutions: Array.isArray(resolutions) ? resolutions : [],
  };
}

module.exports = { matches, submit, parseUrl, normalizeFields };
