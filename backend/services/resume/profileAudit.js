/**
 * Profile Audit — the same counting, on the pass that writes the record.
 *
 * The tailoring path counts everything it asks for. The enhancement path asked
 * for the same things and counted none of them: `enhanceProfileData` built a
 * prompt, parsed the JSON, and returned it. Every rule in the enhancement
 * prompt was therefore enforced the way the tailoring rules were enforced
 * before draftAudit.js existed — by the model confirming it had followed them,
 * in the same call that wrote the text.
 *
 * That gap is worse than it looks, because enhancement writes the stored
 * profile every future application is built from. A ghost metric, a self-rating
 * or an invented number that survives here is not one bad resume; it is the
 * baseline, and it comes back on every tailored run that starts from it. The
 * fabrication diff in draftAudit.js deliberately refuses to treat the stored
 * profile as a source of truth for exactly this reason — but refusing to trust
 * the profile is not the same as fixing it.
 *
 * What this module does NOT check, and why:
 *   - the metric CAP. Enhancement keeps every real number; capping here would
 *     delete data before any tailoring pass could choose between the figures.
 *     Same reasoning as metricRules('enhance') in writingRules.js.
 *   - repeated metric VALUES. The same 30% at two companies is a credibility
 *     tell on one tailored resume and a fact about the candidate's history in
 *     the record. Tailoring picks; the record keeps.
 *   - the skills CAP, for the same reason: this list is the menu, not the meal.
 *   - anything needing a job description — keyword frequency, JD echo, identity
 *     drift toward a posting, gap coverage. There is no posting here.
 */

const {
  auditMetrics,
  auditVariation,
  auditBannedLanguage,
  auditConsistency,
  auditEducation,
  auditArtifacts,
  auditSummary,
  auditSkillsProvenance,
} = require('./draftAudit');

/**
 * Enhancement output and tailoring output describe the same resume in two
 * shapes: education is `institution`/`period` here and `school`/`year` there,
 * projects are `name` here and `title` there. The checks are written against
 * one shape, so the other is translated rather than duplicated — a check that
 * exists twice is a check that will disagree with itself.
 */
function toDraftShape(profile) {
  const p = profile || {};
  return {
    summary: p.summary || '',
    skills: p.skills,
    skillsGrouped: p.skillsGrouped,
    experience: (p.experience || []).map((e) => ({
      company: e.company,
      title: e.title,
      period: e.period || e.duration || [e.startDate, e.endDate || (e.current ? 'Present' : '')].filter(Boolean).join(' - '),
      description: e.description,
    })),
    projects: (p.projects || []).map((pr) => ({
      title: pr.title || pr.name,
      description: pr.description,
    })),
    education: (p.education || []).map((e) => ({
      school: e.school || e.institution,
      degree: e.degree,
      field: e.field,
      year: e.year || e.period || e.graduationYear,
    })),
  };
}

/**
 * Run every JD-independent check over an enhanced profile.
 *
 * @param {Object} input
 * @param {Object} input.profile - the enhanced profile, in enhancement shape
 * @param {string} input.sourceText - the PRE-enhancement profile, serialized.
 *   Required: it is what every "did you invent this" question is asked against,
 *   and degrading to "looks fine" without it is the failure being fixed.
 * @param {Date} [input.now]
 * @returns {Object} per-check evidence plus `blocking`, `questions`, `passed`.
 */
function auditProfile({ profile, sourceText, now = new Date() }) {
  if (!sourceText || !String(sourceText).trim()) {
    throw new Error('auditProfile requires sourceText — there is nothing to check the enhancement against without it');
  }

  const draft = toDraftShape(profile);

  const metrics = auditMetrics(draft, { originalText: sourceText });
  const variation = auditVariation(draft);
  const banned = auditBannedLanguage(draft);
  const summary = auditSummary(draft, '', sourceText);
  const consistency = auditConsistency(draft, sourceText);
  const education = auditEducation(draft, sourceText);
  const artifacts = auditArtifacts(draft, sourceText);
  const skills = auditSkillsProvenance(draft, sourceText, []);

  const report = { metrics, variation, banned, summary, consistency, education, artifacts, skills, now };

  report.blocking = buildProfileBlockingList(report);
  report.questions = buildProfileQuestions(report);

  // The cap fields exist on the shared reports and are deliberately ignored
  // above; `passed` says so explicitly rather than leaving a reader to wonder
  // whether they were forgotten.
  report.passed = report.blocking.length === 0;

  // What still needs a writer, after the deterministic repairs have run. The
  // enhancement pass pays for a second model round only for these — a joined
  // compound, a fixable banned word and an untraceable skill are all repaired
  // in code, and spending a model call on them is how a one-call endpoint
  // quietly becomes a three-call one.
  report.needsRewrite = buildProfileBlockingList({
    ...report,
    artifacts: { joinedWords: [], clean: true },
    banned: { ...banned, hits: banned.hits.filter((h) => !h.fixable) },
    skills: { ...skills, unevidenced: [], bulletOnly: [] },
    consistency: { ...consistency, companyCasing: [] },
  });

  return report;
}

function buildProfileBlockingList(r) {
  const out = [];

  for (const inv of r.metrics.invented || []) {
    out.push(`METRICS: "${inv.value}" in ${inv.location} contains a number (${inv.missing.join(', ')}) that is nowhere in the candidate's own profile. Remove the figure and write the accomplishment without it — never substitute a different number.`);
  }
  for (const est of r.metrics.estimates || []) {
    out.push(`METRICS: "${est.phrase}" in ${est.location} is an estimate, not a measurement. Use the exact figure the profile states, or no figure.`);
  }
  for (const ghost of r.metrics.ghostShapes || []) {
    out.push(`METRICS: "${ghost.phrase}" in ${ghost.location} is a metric with the number taken out. Rewrite the line so it reads as a complete thought without one.`);
  }
  if (r.metrics.inSummary.length) {
    out.push(`SUMMARY: the summary contains ${r.metrics.inSummary.map((i) => i.value).join(', ')}. The summary carries no numbers — a scale claim belongs in the bullet that shows the work.`);
  }
  if (r.summary.overLength) {
    out.push(`SUMMARY: ${r.summary.sentenceCount} sentences, maximum is 3. Cut it down.`);
  }
  for (const chain of r.summary.buzzwordChains) {
    out.push(`SUMMARY: adjective chain "${chain}". Say what the person does and at what level, then stop.`);
  }
  for (const hit of r.banned.hits || []) {
    out.push(`BANNED: "${hit.term}" in ${hit.location}. ${hit.kind === 'abstract_closing' ? 'End the line at its last factual word.' : 'Rewrite the sentence with the plain word for what happened — a self-rating is shown through the work, never declared.'}`);
  }
  for (const off of r.variation.repeatedOpeners || []) {
    out.push(`VARIATION: ${off.count} bullets open with "${off.opener}" (${off.locations.join(', ')}). Rewrite all but one.`);
  }
  for (const adj of r.variation.adjacentRepeats || []) {
    out.push(`VARIATION: two bullets in a row in ${adj.location} open with "${adj.opener}". Rewrite the second.`);
  }
  for (const uni of r.variation.uniformLengthRoles || []) {
    out.push(`VARIATION: every bullet in ${uni.location} is the same length (${uni.lengths.join(', ')} words). Vary them — uniform lines read as a template even when every word is true.`);
  }
  for (const chain of r.variation.buzzwordChains || []) {
    out.push(`VARIATION: "${chain.chain}" in ${chain.location} is a chain of abstract qualities with no concrete anchor. Name the one the work turned on, or cut all of them.`);
  }
  for (const s of r.skills.bulletOnly || []) {
    out.push(`SKILLS: "${s}" appears in a rewritten bullet but nowhere in the candidate's own profile. Remove the skill and the claim that props it up.`);
  }
  for (const mm of r.consistency.titleMismatches || []) {
    out.push(`CONSISTENCY: ${mm.location} header says "${mm.headerTitle}" but a bullet says "${mm.bulletTitle}". The header is authoritative.`);
  }
  if (r.consistency.mixedDateFormats) {
    out.push(`CONSISTENCY: mixed date formats (${r.consistency.dateFormats.join(', ')}). Use one throughout.`);
  }
  for (const c of r.consistency.companyCasing || []) {
    out.push(`CONSISTENCY: company "${c.inDraft}" is spelled "${c.inOriginal}" in the profile. Use the profile's capitalization.`);
  }
  for (const inst of r.education.droppedInstitutions || []) {
    out.push(`EDUCATION: "${inst}" is in the candidate's profile but missing from the enhanced version. Restore it — education is a record, never shortened for polish.`);
  }
  for (const dup of r.education.duplicates || []) {
    out.push(`EDUCATION: duplicate entries for "${dup.degree}". Merge into the single most complete one, keeping the institution name.`);
  }
  for (const a of r.artifacts.joinedWords || []) {
    out.push(`ARTIFACT: "${a.found}" in ${a.location} should be "${a.suggested}".`);
  }
  return out;
}

/**
 * Findings the candidate decides. An incomplete education entry is the clearest
 * case: the enhancement pass cannot know whether the year is missing because
 * the profile never had it or because it dropped it, and guessing either way is
 * worse than asking.
 */
function buildProfileQuestions(r) {
  const questions = [];
  for (const inv of r.metrics.invented || []) {
    questions.push({
      type: 'invented_metric',
      term: inv.value,
      question: `We removed "${inv.value}" from ${inv.location} — that number is not in your profile. If it is real, tell us the figure and we will add it.`,
    });
  }
  for (const s of r.skills.unevidenced || []) {
    questions.push({
      type: 'skill_needs_confirmation',
      term: s,
      question: `"${s}" was added to your skills but nothing else in your profile evidences it. Do you have real experience with it — and in which role — or should it come out?`,
    });
  }
  for (const inc of r.education.incomplete || []) {
    questions.push({
      type: 'education_incomplete',
      term: inc.entry && (inc.entry.degree || inc.entry.school) ? String(inc.entry.degree || inc.entry.school) : `entry ${inc.index + 1}`,
      question: `Your education entry ${inc.index + 1} is missing ${inc.missing.join(' and ')}. An entry with a certificate but no institution reads as a credential with something to hide, so it is worth filling in.`,
    });
  }
  return questions;
}

module.exports = { auditProfile, toDraftShape };
