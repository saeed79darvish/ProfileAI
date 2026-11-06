/**
 * answerMemoryService: the pure rules behind "answer memory".
 *
 *  - answerQuestions: application questions answered from what the person told
 *    us. Fact questions never reach the model; sensitive ones are never answered.
 *  - cleanBullets / matchRole / mergeBullets: dictated work experience turned
 *    into résumé bullets, matched to a role, and appended without duplicates.
 *
 * No I/O here. Routes pass the memory in and a `runModel` callback, which is
 * what lets the tests prove the model is not called for a fact question.
 */

const {
  detectFact, detectStory, mapFactToOption, factToText, deriveFacts, needsFactOf, STORIES,
} = require('../config/answerCatalog');

const CATCH_ALL = /additional information|anything else|personal preferences|other (comments|information)|comments?\b.*\boptional|is there anything/i;

const wordCount = (text) => String(text || '').trim().split(/\s+/).filter(Boolean).length;

/** Strips formatting artifacts the model sometimes adds to a form answer. */
const cleanAnswer = (text) => String(text || '')
  .replace(/^[-•*]\s+/gm, '')
  .replace(/^\d+\.\s+/gm, '')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/\*([^*]+)\*/g, '$1')
  .replace(/^#+\s+/gm, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

/** JSON out of a model reply: tolerates code fences, repairs a truncated reply. */
function parseModelJson(raw, repair) {
  let text = String(raw || '').trim()
    .replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  const start = text.search(/[{[]/);
  if (start > 0) text = text.slice(start);
  try { return JSON.parse(text); } catch { /* fall through to repair */ }
  try {
    const fix = repair || require('./resumeParserService').repairTruncatedJSON;
    return fix(text);
  } catch { return null; }
}

/**
 * @param {object} args
 * @param {string[]} args.questions
 * @param {Array<object>} [args.questionMeta]
 * @param {{answerFacts?: object, answerStories?: object}} [args.memory]
 * @param {(call: {items: Array, storyContext: string}) => Promise<Object<string,string>>} args.runModel
 *        Only ever receives the open-ended questions.
 * @returns {Promise<{answers: Object<string,string>, details: Object<string,object>, modelCalled: boolean}>}
 */
async function answerQuestions({ questions, questionMeta, memory, runModel }) {
  const facts = deriveFacts(memory);
  const stories = (memory && memory.answerStories) || {};
  const meta = Array.isArray(questionMeta) ? questionMeta : [];
  const details = {};
  const modelItems = [];

  questions.forEach((question, index) => {
    const m = meta[index] || {};
    const options = Array.isArray(m.options) ? m.options : [];
    const fieldType = m.fieldType || 'text';
    const hit = detectFact(question);

    if (hit && hit.sensitive) {
      details[question] = { answer: '', source: 'needs_you' };
      return;
    }

    if (hit) {
      const stored = facts[hit];
      if (!stored) {
        details[question] = { answer: '', source: 'needs_you', factId: hit, needsFact: needsFactOf(hit) };
        return;
      }
      // Dropdowns built with react-select only list their options when opened, so the
      // page cannot send them up front. A question phrased as yes or no is answered
      // against Yes and No instead of being returned as prose the page cannot match.
      const yesNoStyle = !options.length && /^\s*(are|do|does|will|would|can|could|is|have|has)\b/i.test(question);
      const answer = options.length || yesNoStyle
        ? (mapFactToOption(hit, stored.value, options.length ? options : ['Yes', 'No'], question)
            || (yesNoStyle ? factToText(hit, stored.value, stored.note) : null))
        : factToText(hit, stored.value, stored.note);
      if (!answer) {
        // The person told us, but this form's wording does not fit it: theirs to answer.
        details[question] = { answer: '', source: 'needs_you', factId: hit };
        return;
      }
      details[question] = { answer, source: 'fact', factId: hit, choiceValue: stored.value };
      return;
    }

    const storyId = detectStory(question);
    const story = storyId && stories[storyId] && stories[storyId].text ? storyId : null;
    const catchAll = CATCH_ALL.test(question) || (m.optional === true && fieldType === 'textarea');
    if (catchAll && !story) {
      details[question] = { answer: '', source: 'ai' };
      return;
    }
    modelItems.push({ index, question, meta: m, storyId: story });
  });

  let modelCalled = false;
  if (modelItems.length) {
    const storyContext = STORIES
      .filter((s) => stories[s.id] && stories[s.id].text)
      .map((s) => `${s.label}: ${stories[s.id].text}`)
      .join('\n');
    modelCalled = true;
    const raw = (await runModel({ items: modelItems, storyContext })) || {};
    for (const item of modelItems) {
      let rawAnswer = typeof raw[item.question] === 'string' ? raw[item.question] : '';
      if (!rawAnswer && modelItems.length === 1) {
        // The model may hand the answer back under a slightly reworded key (the page
        // appends instructions to the question text). With one question there is
        // only one answer it can mean.
        const only = Object.values(raw).filter((v) => typeof v === 'string' && v.trim());
        if (only.length === 1) rawAnswer = only[0];
      }
      const answer = cleanAnswer(rawAnswer);
      const detail = answer
        ? { answer, source: item.storyId ? 'story' : 'ai' }
        : { answer: '', source: 'needs_you' };
      if (answer && item.meta.fieldType === 'textarea') detail.wordCount = wordCount(answer);
      details[item.question] = detail;
    }
  }

  const answers = {};
  for (const [question, d] of Object.entries(details)) {
    if (typeof d.answer === 'string' && d.answer.trim()) answers[question] = d.answer;
  }
  return { answers, details, modelCalled };
}

/* ---------- dictated experience ---------- */

const MAX_BULLETS = 3;
const MAX_BULLET_CHARS = 300;

/** 1 to 3 plain bullets: no bullet characters, no dashes, no markdown. */
function cleanBullets(input) {
  const lines = Array.isArray(input) ? input : String(input || '').split(/\n+/);
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    let t = String(line || '')
      .replace(/^[\s\-–—•·▪●◦*]+/, '')
      .replace(/^\d+[.)]\s+/, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/[*_`#>]/g, '')
      .replace(/\s*[–—]\s*/g, ', ')
      .replace(/\s+-\s+/g, ', ')
      .replace(/\s+/g, ' ')
      .replace(/^[,\s]+|[,\s]+$/g, '')
      .trim();
    if (t.length > MAX_BULLET_CHARS) t = t.slice(0, MAX_BULLET_CHARS).replace(/\s+\S*$/, '');
    const key = t.toLowerCase();
    if (!t || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length === MAX_BULLETS) break;
  }
  return out;
}

const STOP = new Set(['the', 'and', 'for', 'senior', 'junior', 'lead', 'staff', 'principal', 'intern', 'with', 'at', 'of']);
const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length >= 3 && !STOP.has(w));
const hasPhrase = (hay, needle) => {
  const n = String(needle || '').toLowerCase().trim();
  if (n.length < 2) return false;
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(hay);
};

/**
 * Which role a spoken description is about. roleIndex only when one role is
 * clearly ahead (its company or title is named); otherwise null with the
 * candidates so the person can pick.
 */
function matchRole(transcript, roleHint, experience) {
  const roles = Array.isArray(experience) ? experience : [];
  const text = String(transcript || '').toLowerCase();
  const hint = String(roleHint || '').toLowerCase();
  const scored = roles.map((r, index) => {
    const title = String(r?.title || '');
    const company = String(r?.company || '');
    let score = 0;
    if (hasPhrase(text, company)) score += 3;
    if (hasPhrase(hint, company)) score += 4;
    if (hasPhrase(text, title)) score += 3;
    if (hasPhrase(hint, title)) score += 4;
    const tw = words(title);
    if (tw.length) {
      const hits = tw.filter((w) => hasPhrase(text, w) || hasPhrase(hint, w)).length;
      score += hits;
    }
    // Company words ("Equinix Inc" named as "Equinix").
    for (const w of words(company)) {
      if (!['inc', 'llc', 'ltd', 'corp', 'company', 'group'].includes(w) && (hasPhrase(text, w) || hasPhrase(hint, w))) score += 3;
    }
    return { index, title, company, score };
  });
  const ranked = [...scored].sort((a, b) => b.score - a.score || a.index - b.index);
  const best = ranked[0];
  const second = ranked[1];
  const clear = best && best.score >= 3 && (!second || best.score > second.score);
  return {
    roleIndex: clear ? best.index : null,
    roleCandidates: ranked.slice(0, 5).map(({ index, title, company }) => ({ index, title, company })),
  };
}

const lineKey = (s) => String(s || '').toLowerCase().replace(/^[\s\-–—•·▪●◦*]+/, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Appends bullets to a role description ("• " lines), skipping ones already there. */
function mergeBullets(description, bullets) {
  const existing = String(description || '').split('\n').map((l) => l.trimEnd()).filter((l) => l.trim());
  const seen = new Set(existing.map(lineKey));
  const added = [];
  for (const raw of Array.isArray(bullets) ? bullets : []) {
    const text = String(raw || '').replace(/^[\s\-–—•·▪●◦*]+/, '').trim();
    const key = lineKey(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    added.push(`• ${text}`);
  }
  return { description: [...existing, ...added].join('\n'), added };
}

module.exports = {
  answerQuestions, parseModelJson, cleanAnswer, wordCount, CATCH_ALL,
  cleanBullets, matchRole, mergeBullets,
};
