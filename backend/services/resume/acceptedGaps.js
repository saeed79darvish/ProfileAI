/**
 * What "accept this gap" actually does.
 *
 * It did nothing visible. A candidate reviewed eight gaps, accepted them, and
 * got back a resume containing none of them — and a panel still listing all
 * eight under "STILL MISSING". From the outside the feature looked broken,
 * because functionally it was.
 *
 * Two causes, and they compounded:
 *
 * 1. The UI said accepting adds the gap to a "learning plan". The backend
 *    prompt said "candidate wants these added to their resume". Two different
 *    promises for one button.
 * 2. The prompt asked the model to weave accepted gaps in with honest framing,
 *    while every surrounding rule told it never to write a term it cannot trace
 *    to the original resume. Facing that conflict the model did the safe thing
 *    and added nothing — correctly, by its instructions. A request the user
 *    made explicitly was then silently dropped.
 *
 * The resolution is to stop asking. An accepted gap is applied here, in code,
 * into a skills group named for what it is — the candidate said they want the
 * posting's requirement represented, and a group labelled "Familiar with"
 * represents it without claiming depth the resume cannot show. A recruiter can
 * read the difference; a keyword scanner finds the term either way.
 *
 * Anything that still cannot be applied is reported rather than dropped, so the
 * user learns their choice did not land instead of assuming it did.
 */

/** The group accepted-but-unevidenced skills are filed under. */
const FAMILIAR_GROUP = 'Familiar with';

const norm = (v) => String(v || '').toLowerCase().trim();

/** Flatten a grouped or flat skills value into a list of strings. */
function listSkills(skills) {
  if (Array.isArray(skills)) return skills.filter((s) => typeof s === 'string');
  if (skills && typeof skills === 'object') {
    return Object.values(skills).flat().filter((s) => typeof s === 'string');
  }
  return [];
}

/**
 * Apply the candidate's accepted gaps to the draft.
 *
 * A gap already represented in the resume (the model did weave it in, or the
 * candidate had it after all) is left alone — it does not also get a "Familiar
 * with" entry, which would read as hedging on something they can defend.
 *
 * @param {Object} draft - tailored resume, mutated in place
 * @param {string[]} acceptedGaps
 * @param {Object} [opts]
 * @param {(term: string) => boolean} [opts.isEvidenced] - does the ORIGINAL
 *   resume support this term? Evidenced gaps are placed as ordinary skills.
 * @returns {{ added: string[], alreadyPresent: string[], group: string|null }}
 */
function applyAcceptedGaps(draft, acceptedGaps, { isEvidenced = () => false } = {}) {
  const accepted = (Array.isArray(acceptedGaps) ? acceptedGaps : [])
    .map((g) => (typeof g === 'string' ? g.trim() : ''))
    .filter(Boolean);
  if (accepted.length === 0) return { added: [], alreadyPresent: [], group: null };

  // Everything the resume already says, so nothing is added twice.
  const present = new Set(listSkills(draft.skills).map(norm));
  for (const key of Object.keys(draft.skillsGrouped || {})) {
    for (const s of draft.skillsGrouped[key] || []) present.add(norm(s));
  }
  const prose = [
    draft.summary || '',
    ...(draft.experience || []).map((e) => (e && e.description) || ''),
    ...(draft.projects || []).map((p) => (p && p.description) || ''),
  ].join(' ').toLowerCase();

  const added = [];
  const alreadyPresent = [];
  const familiar = [];
  const evidenced = [];

  for (const gap of accepted) {
    const key = norm(gap);
    if (present.has(key) || prose.includes(key)) {
      alreadyPresent.push(gap);
      continue;
    }
    // Something the original DOES support belongs with the real skills; it was
    // only ever a "gap" because the tailored draft had not surfaced it.
    (isEvidenced(gap) ? evidenced : familiar).push(gap);
    added.push(gap);
    present.add(key);
  }

  if (added.length === 0) return { added, alreadyPresent, group: null };

  // Work in the grouped shape when there is one; the flat array is rebuilt
  // afterwards so both views agree.
  if (!draft.skillsGrouped || typeof draft.skillsGrouped !== 'object') {
    draft.skillsGrouped = Array.isArray(draft.skills) && draft.skills.length
      ? { Skills: [...draft.skills] }
      : {};
  }
  if (evidenced.length > 0) {
    const firstGroup = Object.keys(draft.skillsGrouped)[0] || 'Skills';
    draft.skillsGrouped[firstGroup] = [...(draft.skillsGrouped[firstGroup] || []), ...evidenced];
  }
  if (familiar.length > 0) {
    draft.skillsGrouped[FAMILIAR_GROUP] = [
      ...(draft.skillsGrouped[FAMILIAR_GROUP] || []),
      ...familiar,
    ];
  }
  draft.skills = Object.values(draft.skillsGrouped).flat();

  return { added, alreadyPresent, group: familiar.length > 0 ? FAMILIAR_GROUP : null };
}

/**
 * An accepted gap is a decision, not an outstanding gap.
 *
 * Re-listing it under "STILL MISSING" tells the candidate their choice was
 * ignored — which, before `applyAcceptedGaps` existed, it had been.
 *
 * @param {Array<{requirement: string}>} gaps
 * @param {string[]} acceptedGaps
 */
function withoutAcceptedGaps(gaps, acceptedGaps) {
  const accepted = new Set((Array.isArray(acceptedGaps) ? acceptedGaps : []).map(norm));
  if (accepted.size === 0) return Array.isArray(gaps) ? gaps : [];
  return (Array.isArray(gaps) ? gaps : []).filter((g) => {
    const text = norm(g && g.requirement);
    if (!text) return true;
    // Exact match, or the gap line is the accepted term plus an explanation
    // ("NestJS (hard blocker): no NestJS anywhere in the resume").
    for (const term of accepted) {
      if (text === term) return false;
      if (term.length > 2 && text.startsWith(term)) return false;
    }
    return true;
  });
}

module.exports = { applyAcceptedGaps, withoutAcceptedGaps, FAMILIAR_GROUP };
