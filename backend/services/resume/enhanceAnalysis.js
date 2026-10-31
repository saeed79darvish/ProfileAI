/**
 * Enhance with AI, step one: what is wrong with each section, and what the
 * candidate can ask the rewrite to do about it.
 *
 * The old flow asked for a tone and a few global emphasis chips before anyone
 * had looked at the resume, so the choices were guesses. Now the profile is
 * read first and every section reports its own findings, and the candidate
 * picks from actions written for that section.
 *
 * Findings come from two places:
 *   - code, for everything countable ("6 bullets start with Led", a 78-word
 *     summary, a tech stack inside a job title). Counted, never estimated.
 *   - one cheap model call, for judgement the code cannot make ("combines two
 *     roles"). It is told what the code already found so it does not repeat
 *     it, and its action ids are checked against the catalog below.
 *
 * If the model call fails the code findings still stand on their own; the
 * analysis never blocks the rewrite.
 */

/** First word of a bullet, lowercased; same rule as draftAudit's. */
function openingWord(bullet) {
  const m = String(bullet).replace(/^[^A-Za-z]+/, '').match(/^[A-Za-z][A-Za-z'-]*/);
  return m ? m[0].toLowerCase() : '';
}

/** The sections this flow analyses and rewrites, in display order. */
const ENHANCE_SECTIONS = ['title', 'summary', 'experience', 'education'];

/**
 * Everything the candidate can ask for, per section. `instruction` is what the
 * rewrite prompt receives when the action is chosen; it is binding there, so
 * each one is written to stay inside the honesty rules rather than against
 * them.
 */
const ACTIONS = {
  title: {
    match_target: {
      label: 'Match target role',
      needsTargetRole: true,
      instruction: 'Rewrite the title toward the target role given above, using only roles and seniority the experience supports. Never claim a level the history does not show.',
    },
    one_role: {
      label: 'Use one clear role',
      instruction: 'Make the title one recognisable job title a recruiter would search for. If it joins two roles, lead with the one the recent experience supports; a secondary specialism may follow a " · ".',
    },
    add_stack: {
      label: 'Add main stack',
      instruction: 'Add the one or two technologies the most recent roles use most, after a " · " (e.g. "Frontend Engineer · React"). Only technologies named in the profile.',
    },
  },
  summary: {
    lead_impact: {
      label: 'Lead with impact',
      instruction: 'Open with what this person built or owns and for whom, never with a count of years. Years may appear later, stated as the dated roles support them.',
    },
    add_metrics: {
      label: 'Add metrics',
      instruction: 'The summary MUST carry one or two figures copied exactly from the experience. The candidate chose this, so it waives SUMMARY DISCIPLINE\'s no-numbers rule for these figures only. Never round, combine or add a number that is not in the profile.',
    },
    shorten: {
      label: 'Shorten to 3 lines',
      instruction: 'Cut the summary to at most 3 sentences and about 40–60 words. Keep the claims the experience evidences; drop restatements.',
    },
  },
  experience: {
    vary_verbs: {
      label: 'Vary action verbs',
      instruction: 'No opening verb may start more than two bullets across the whole experience section. Replace repeated openers with the specific verb for what was actually done.',
    },
    add_results: {
      label: 'Add results to bullets',
      instruction: 'Attach a result to a bullet only where the profile states that result for that work. Never add a number that is not in the profile; a bullet with no stated result is written clearly without one, and the candidate is asked for the figure afterwards.',
    },
    clean_titles: {
      label: 'Clean up job titles',
      instruction: 'Job titles carry the title only: take technology lists and parentheticals out of them (e.g. "Senior UI Engineer (React, Node)" becomes "Senior UI Engineer"). Never change the seniority or the role.',
    },
    trim_older: {
      label: 'Trim older roles',
      instruction: 'For roles that ended more than 8 years ago, keep only the two strongest bullets. Recent roles keep every bullet.',
    },
  },
  education: {
    tidy: {
      label: 'Tidy formatting',
      instruction: 'Make degree names and dates consistent across entries (one date format, one degree style such as "B.S. Computer Science"). Never drop, merge or invent an entry, school, degree or year.',
    },
  },
};

/** "drop:<term>" asks for a dated term to be removed from the summary. */
const DROP_PREFIX = 'drop:';

/**
 * Terms that date a summary rather than describe the work. Offered as a
 * "Drop" action when present; never pre-selected, because some candidates
 * are applying to places that still use them.
 */
const DATED_TERMS = ['Waterfall', 'SVN', 'jQuery', 'AngularJS', 'Flash', 'Visual Basic', 'Perl', 'CoffeeScript', 'Backbone.js'];

const ROLE_JOINERS = /\s*(?:,|\/|\||\band\b|&)\s*/i;
const YEARS_OPENER = /^[^.]{0,80}?\bwith\s+\d+\+?\s+years?\b|^\s*\d+\+?\s+years?\b/i;
const WEAK_OPENERS = [/^responsible for\b/i, /^work(?:ed|s)? on\b/i, /^helped\b/i, /^was part of\b/i, /^involved in\b/i, /^assisted\b/i];
const HAS_NUMBER = /\d/;
// A figure plus the words it qualifies: "30% improvement in data retrieval".
// Case-sensitive on purpose: [KMB] is a unit only in capitals, so the "m" of
// "million" stays part of the words.
const METRIC_PHRASE = /(\$?\d[\d,.]*(?:\s?(?:%|[KMB]\+?|\+|x\b))?)((?:\s+[a-z][a-z-]*){0,4})/g;
const TRAILING_FILLER = /\s+(?:in|of|per|for|to|and|with|on|at|by|the|a|an)$/;

const wordCount = (text) => String(text || '').split(/\s+/).filter(Boolean).length;

function splitBullets(description) {
  return String(description || '')
    .split(/\n/)
    .map((line) => line.replace(/^\s*[•\-*–]\s*/, '').trim())
    .filter(Boolean);
}

/** "Led", "Lead" and "Leading" count as the same opener; so do -ed/-ing pairs. */
function openerStem(word) {
  const w = word.toLowerCase();
  if (w === 'lead' || w === 'led' || w === 'leading') return 'led';
  return w.replace(/(?:ing|ed)$/, '');
}

function roleLabel(entry, i) {
  return String(entry.company || entry.title || entry.position || `role ${i + 1}`).trim();
}

function roleTitle(entry) {
  return String(entry.title || entry.position || '').trim();
}

/** The year a role ended, or null when it is current or undated. */
function endYear(entry, now = new Date()) {
  if (entry.current || entry.isCurrent) return now.getFullYear();
  const raw = String(entry.endDate || '').trim() || String(entry.period || '').split(/[-–—]|\bto\b/i).pop();
  if (/present|current/i.test(raw || '')) return now.getFullYear();
  const m = String(raw || '').match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

/** Indexes of roles that ended more than `years` years ago. */
function olderRoleIndexes(experience = [], years = 8, now = new Date()) {
  const cutoff = now.getFullYear() - years;
  const out = [];
  (experience || []).forEach((entry, i) => {
    const y = endYear(entry || {}, now);
    if (y !== null && y < cutoff) out.push(i);
  });
  return out;
}

function listNames(names) {
  if (names.length <= 1) return names.join('');
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.length} roles`;
}

/** Metrics the experience states, with a few words of context each. */
function experienceMetrics(experience = []) {
  const found = [];
  for (const entry of experience) {
    for (const bullet of splitBullets(entry && entry.description)) {
      for (const m of bullet.matchAll(METRIC_PHRASE)) {
        const figure = m[1].trim();
        if (/^\d{4}$/.test(figure) || !/[%KMBx+$]|\d\s*\S/.test(m[0])) continue; // a year or a bare digit
        let phrase = `${figure}${m[2] || ''}`.trim().replace(/[,.;]+$/, '');
        while (TRAILING_FILLER.test(phrase)) phrase = phrase.replace(TRAILING_FILLER, '');
        if (phrase.split(/\s+/).length >= 2 || /[%KMBx+]/.test(figure)) found.push(phrase);
      }
    }
  }
  return found;
}

// ── Code findings, per section ─────────────────────────────────────────────

function analyzeTitle(profile) {
  const title = String(profile.title || profile.headline || '').trim();
  const issues = [];
  const topics = new Set();
  const recommended = new Set();
  if (!title) {
    return { meta: 'Not set', issues: ['No title yet, so recruiters see no role at the top of your profile.'], recommended: ['one_role'] };
  }
  const parts = title.split(ROLE_JOINERS).filter((p) => p.trim().length > 2);
  if (parts.length >= 2) {
    issues.push('Combines two roles, so recruiters can’t tell which one you are.'); topics.add('two_roles');
    recommended.add('one_role');
  }
  if (/\(.+\)/.test(title)) {
    issues.push('Has a parenthetical, which search filters and ATS parsers often drop.'); topics.add('title_format');
    recommended.add('one_role');
  }
  if (title.length > 60) {
    issues.push(`It’s ${title.length} characters; titles over 60 get cut off in search results.`); topics.add('title_length');
    recommended.add('one_role');
  }
  return { meta: title, issues, recommended: [...recommended], topics: [...topics] };
}

function analyzeSummary(profile) {
  const summary = String(profile.summary || '').trim();
  const issues = [];
  const topics = new Set();
  const recommended = new Set();
  const extraActions = [];
  if (!summary) {
    return {
      meta: 'Not written yet',
      issues: ['No summary yet; recruiters read it before anything else.'],
      recommended: ['lead_impact'],
      extraActions,
    };
  }
  const metrics = experienceMetrics(profile.experience);
  // "6+ years" is a tenure, not a result; it doesn't count as a number here.
  const summaryFigures = summary.replace(/\d+\+?\s*years?\b/gi, '');
  if (!HAS_NUMBER.test(summaryFigures) && metrics.length) {
    const examples = [...new Set(metrics)].slice(0, 2);
    issues.push(`No numbers, though your experience includes ${examples.join(' and ')}.`); topics.add('no_numbers');
    recommended.add('add_metrics');
  }
  if (YEARS_OPENER.test(summary)) {
    issues.push('It opens with years of experience instead of what you’ve achieved.'); topics.add('years_opener');
    recommended.add('lead_impact');
  }
  const words = wordCount(summary);
  if (words > 60) {
    issues.push(`It’s ${words} words; 40–60 reads better.`); topics.add('too_long');
    recommended.add('shorten');
  }
  for (const term of DATED_TERMS) {
    if (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(summary)) {
      extraActions.push({ id: `${DROP_PREFIX}${term}`, label: `Drop “${term}”` });
    }
  }
  return { meta: summary, issues, recommended: [...recommended], extraActions, topics: [...topics] };
}

function analyzeExperience(profile, now = new Date()) {
  const experience = Array.isArray(profile.experience) ? profile.experience.filter(Boolean) : [];
  const issues = [];
  const topics = new Set();
  const recommended = new Set();
  const extraActions = [];
  const bulletCount = experience.reduce((n, e) => n + splitBullets(e.description).length, 0);
  const meta = `${experience.length} role${experience.length === 1 ? '' : 's'} · ${bulletCount} bullet${bulletCount === 1 ? '' : 's'}`;
  if (!experience.length) {
    return { meta: 'No roles yet', issues: [], recommended: [], extraActions };
  }

  // Repeated openers across the whole section.
  const stems = new Map();
  for (const entry of experience) {
    for (const bullet of splitBullets(entry.description)) {
      const opener = openingWord(bullet);
      if (opener.length < 3) continue;
      const stem = openerStem(opener);
      const seen = stems.get(stem) || { count: 0, forms: new Set() };
      seen.count += 1;
      seen.forms.add(opener.charAt(0).toUpperCase() + opener.slice(1));
      stems.set(stem, seen);
    }
  }
  const top = [...stems.values()].sort((a, b) => b.count - a.count)[0];
  if (top && top.count >= 3) {
    const forms = [...top.forms].slice(0, 2).map((f) => `“${f}”`).join(' or ');
    issues.push(`${top.count} bullets start with ${forms}.`); topics.add('repeated_verbs');
    recommended.add('vary_verbs');
  }

  const noResults = experience
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => splitBullets(e.description).length && !HAS_NUMBER.test(String(e.description || '')))
    .map(({ e, i }) => roleLabel(e, i));
  if (noResults.length) {
    issues.push(`The ${listNames(noResults)} bullets list tasks but no results.`); topics.add('no_results');
    recommended.add('add_results');
  }

  const stacked = experience.map(roleTitle).filter((t) => /\(.+\)/.test(t) || t.split(/,/).length > 2);
  if (stacked.length) {
    const example = stacked[0].length > 40 ? `${stacked[0].slice(0, 38).trim()}…)` : stacked[0];
    issues.push(`Job titles include tech stacks, e.g. “${example}”.`); topics.add('title_stack');
    recommended.add('clean_titles');
  }

  const weak = experience.flatMap((e) => splitBullets(e.description)).filter((b) => WEAK_OPENERS.some((re) => re.test(b)));
  if (weak.length) {
    const phrase = (weak[0].match(/^\S+(?:\s+(?:for|on|in|with))?/) || [''])[0];
    issues.push(`${weak.length} bullet${weak.length === 1 ? ' opens' : 's open'} with “${phrase}”, which says nothing about what you did.`); topics.add('weak_opener');
    recommended.add('vary_verbs');
  }

  if (olderRoleIndexes(experience, 8, now).length) {
    extraActions.push({ id: 'trim_older', label: ACTIONS.experience.trim_older.label });
  }
  return { meta, issues, recommended: [...recommended], extraActions, topics: [...topics] };
}

function analyzeEducation(profile) {
  const education = Array.isArray(profile.education) ? profile.education.filter(Boolean) : [];
  if (!education.length) return { meta: 'No entries yet', issues: [], recommended: [] };
  const issues = [];
  const topics = new Set();
  const recommended = new Set();
  const dateStyles = new Set(
    education
      .map((e) => String(e.period || e.year || e.endDate || e.graduationYear || '').trim())
      .filter(Boolean)
      .map((d) => (/^\d{4}$/.test(d) ? 'year' : /^\d{4}-\d{2}/.test(d) ? 'iso' : /[A-Za-z]{3}/.test(d) ? 'month' : 'other'))
  );
  if (dateStyles.size > 1) {
    issues.push('Dates use more than one format.'); topics.add('date_format');
    recommended.add('tidy');
  }
  const missing = education
    .map((e, i) => ({ i, school: e.institution || e.school, degree: e.degree }))
    .filter((x) => !x.school || !x.degree);
  if (missing.length) {
    // The rewrite cannot fill these in, so it is reported but not recommended.
    issues.push(`Entry ${missing[0].i + 1} is missing its ${missing[0].school ? 'degree' : 'school'}; add it in Edit.`); topics.add('missing_detail');
  }
  const meta = `${education.length} entr${education.length === 1 ? 'y' : 'ies'}`;
  return { meta, issues, recommended: [...recommended], topics: [...topics] };
}

/** Everything the code can find, without a model. */
function findSectionIssues(profile = {}, now = new Date()) {
  return {
    title: analyzeTitle(profile),
    summary: analyzeSummary(profile),
    experience: analyzeExperience(profile, now),
    education: analyzeEducation(profile),
  };
}

// ── The model's half ──────────────────────────────────────────────────────

const MAX_ISSUES = 3;

/** What an issue is about, so the model cannot restate one the code found. */
const ISSUE_TOPICS = [
  'two_roles', 'title_format', 'title_length', 'title_search',
  'no_numbers', 'years_opener', 'too_long', 'vague', 'dated_terms',
  'repeated_verbs', 'weak_opener', 'no_results', 'title_stack', 'scope_unclear',
  'date_format', 'missing_detail', 'other',
];
const MAX_ISSUE_CHARS = 140;

function buildAnalysisPrompt(aiProfile, codeFindings) {
  const catalog = Object.fromEntries(
    ENHANCE_SECTIONS.map((s) => [s, Object.entries(ACTIONS[s]).map(([id, a]) => `${id}: ${a.label}`)])
  );
  const already = Object.fromEntries(ENHANCE_SECTIONS.map((s) => [s, codeFindings[s].issues]));
  const covered = Object.fromEntries(ENHANCE_SECTIONS.map((s) => [s, codeFindings[s].topics || []]));
  return {
    system: 'You review resumes for a recruiter. You point out concrete, fixable problems in plain words, and you never invent facts about the candidate.',
    prompt: `Review this candidate's profile section by section and report what would make a recruiter skip past it.

PROFILE:
${JSON.stringify(aiProfile, null, 2)}

ALREADY FOUND BY CODE (do not repeat or rephrase these):
${JSON.stringify(already, null, 2)}

TOPICS ALREADY COVERED, per section (report nothing on these topics):
${JSON.stringify(covered)}

ISSUE TOPICS: ${ISSUE_TOPICS.join(', ')}

ACTIONS THE CANDIDATE CAN CHOOSE, per section:
${JSON.stringify(catalog, null, 2)}

RULES:
- Report at most 2 NEW issues per section, only real ones, each tagged with one topic from ISSUE TOPICS. Never a topic already covered for that section. An empty list is a good answer.
- Each issue is one plain sentence under 20 words, addressed to the candidate ("your", "you"), naming the exact thing in their text.
- Quote their words when it helps. Never state a number that is not in the profile.
- No generic advice ("use strong verbs", "tailor to each job"). No praise.
- recommend: action ids from the catalog for that section that would fix the issues, including the ones already found. Ids only.

Return ONLY JSON:
{"title":{"issues":[{"topic":"...","text":"..."}],"recommend":[]},"summary":{"issues":[],"recommend":[]},"experience":{"issues":[],"recommend":[]},"education":{"issues":[],"recommend":[]}}`,
    max_tokens: 900,
    temperature: 0.2,
  };
}

/**
 * Merge the model's findings into the code's. Code findings come first and are
 * never dropped; the model can add issues and recommendations, never remove
 * them, and anything it names outside the catalog is ignored.
 */
function mergeAnalysis(codeFindings, modelFindings) {
  const out = {};
  for (const section of ENHANCE_SECTIONS) {
    const code = codeFindings[section];
    const model = (modelFindings && typeof modelFindings === 'object' && modelFindings[section]) || {};
    const known = new Set(code.issues.map((i) => i.toLowerCase()));
    const coveredTopics = new Set(code.topics || []);
    const extra = (Array.isArray(model.issues) ? model.issues : [])
      .map((i) => (typeof i === 'string' ? { topic: 'other', text: i } : i))
      .filter((i) => i && typeof i.text === 'string' && !coveredTopics.has(i.topic))
      .map((i) => i.text.trim().replace(/\s+/g, ' '))
      .filter((i) => i && i.length <= MAX_ISSUE_CHARS && !known.has(i.toLowerCase()));
    const issues = [...code.issues, ...extra].slice(0, MAX_ISSUES);

    const recommended = new Set(code.recommended);
    // A model recommendation only counts when the section has something to fix.
    if (issues.length) {
      for (const id of Array.isArray(model.recommend) ? model.recommend : []) {
        if (typeof id === 'string' && ACTIONS[section][id] && !ACTIONS[section][id].needsTargetRole) recommended.add(id);
      }
    }
    // trim_older is offered, never pre-selected: cutting bullets is the
    // candidate's call.
    recommended.delete('trim_older');

    const actions = Object.entries(ACTIONS[section])
      .filter(([id]) => id !== 'trim_older' || (code.extraActions || []).some((a) => a.id === 'trim_older'))
      .map(([id, a]) => ({ id, label: a.label, ...(a.needsTargetRole ? { needsTargetRole: true } : {}) }));
    for (const a of code.extraActions || []) {
      if (!actions.some((x) => x.id === a.id)) actions.push(a);
    }

    out[section] = {
      meta: code.meta,
      issues,
      actions,
      recommended: [...recommended].filter((id) => actions.some((a) => a.id === id)),
      // Sections with nothing to fix start unchecked.
      selected: issues.length > 0 && recommended.size > 0,
    };
  }
  return out;
}

/**
 * The rewrite instructions for the sections and actions the candidate chose.
 * Anything not in the catalog is dropped here, so a client cannot put free
 * text into the binding instructions except through the note field.
 */
function instructionsFor(sections = [], actions = {}, notes = {}, { metrics = [] } = {}) {
  const lines = [];
  for (const section of ENHANCE_SECTIONS) {
    if (!sections.includes(section)) continue;
    const chosen = Array.isArray(actions[section]) ? actions[section] : [];
    for (const id of chosen) {
      if (typeof id !== 'string') continue;
      if (section === 'summary' && id.startsWith(DROP_PREFIX)) {
        const term = id.slice(DROP_PREFIX.length).trim();
        if (term && term.length <= 40) lines.push(`- summary: Remove "${term}" from the summary.`);
        continue;
      }
      const action = ACTIONS[section] && ACTIONS[section][id];
      if (!action) continue;
      lines.push(`- ${section}: ${action.instruction}`);
      if (section === 'summary' && id === 'add_metrics' && metrics.length) {
        lines.push(`  The figures the experience states, to choose from: ${[...new Set(metrics)].slice(0, 6).map((m) => `"${m}"`).join(', ')}.`);
      }
    }
    const note = String((notes && notes[section]) || '').trim();
    if (note) lines.push(`- ${section}, the candidate's own instruction: ${note.slice(0, 300)}`);
  }
  if (sections.includes('experience')) {
    // Returned as prose, the bullets read as "lost" to the additive check and
    // the whole role came back unchanged; and the Review step compares line
    // by line. So the shape is part of the instruction, not left to the model.
    const trimming = (actions.experience || []).includes('trim_older');
    lines.push(`- experience: Return each description as bullets, one per line, separated by "\n" — exactly as many lines as the source description, in the same order, each line a rewrite of the line it replaces. Never join bullets into a paragraph or split one into two.${trimming ? ' The only exception: roles that ended more than 8 years ago keep their two strongest lines.' : ''}`);
  }
  return lines;
}

module.exports = {
  ACTIONS,
  ENHANCE_SECTIONS,
  DROP_PREFIX,
  findSectionIssues,
  buildAnalysisPrompt,
  mergeAnalysis,
  instructionsFor,
  olderRoleIndexes,
  splitBullets,
  experienceMetrics,
};
