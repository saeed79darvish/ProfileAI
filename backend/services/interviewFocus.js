/**
 * What a candidate says they are aiming at on one interview prep: the areas they want to be
 * strongest in, the kind of company, and what worries them most. Kept per user and prep, used
 * to put matching questions and topics first and to steer voice practice. It never changes the
 * shared research, so it costs nothing to use.
 */

/* Area ids are shared with the page (frontend targeting.js). Keywords are matched against
   question and topic text, case-insensitively, as whole-ish words. */
const AREAS = {
  performance: ['performance', 'latency', 'lazy', 'bundle', 'cache', 'caching', 'core web vitals', 'lcp', 'optimi', 'slow', 'render', 'cdn'],
  architecture: ['architect', 'system design', 'scalab', 'micro-frontend', 'microfrontend', 'monorepo', 'module', 'design pattern'],
  design_systems: ['design system', 'component library', 'storybook', 'tokens', 'theming', 'css'],
  accessibility: ['accessib', 'a11y', 'aria', 'screen reader', 'wcag', 'keyboard'],
  state: ['state', 'redux', 'hooks', 'context', 'react', 'virtual dom', 'rendering'],
  testing: ['test', 'tdd', 'e2e', 'unit', 'cypress', 'playwright', 'jest'],
  api: ['api', 'rest', 'graphql', 'http', 'authentication', 'auth', 'backend', 'request'],
  data: ['database', 'sql', 'data model', 'schema', 'query', 'storage', 'index'],
  reliability: ['reliab', 'incident', 'monitor', 'observab', 'on-call', 'outage', 'error handling', 'resilien'],
  security: ['security', 'xss', 'csrf', 'owasp', 'encrypt', 'vulnerab'],
  leading: ['lead', 'mentor', 'conflict', 'stakeholder', 'influence', 'team', 'cross-functional', 'disagree'],
  strategy: ['strategy', 'roadmap', 'trade-off', 'tradeoff', 'prioriti', 'technical direction', 'vision', 'migration'],
  algorithms: ['algorithm', 'data structure', 'complexity', 'leetcode', 'array', 'tree', 'graph'],
  ml: ['machine learning', 'llm', 'model', 'rag', 'prompt', 'embedding', 'ai '],
};
const COMPANY_TYPES = ['big_tech', 'scale_up', 'startup', 'agency', 'not_sure'];
const WORRIES = ['technical_depth', 'system_design', 'behavioral', 'speaking_clearly', 'coding_speed', 'not_sure'];

const MAX_AREAS = 5;

/** Safe focus from anything a client sent: known ids only, at most five areas, known choices only. Null when nothing usable is left. */
function cleanFocus(input) {
  const f = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const areas = [...new Set((Array.isArray(f.areas) ? f.areas : []).filter((a) => typeof a === 'string' && Object.prototype.hasOwnProperty.call(AREAS, a)))].slice(0, MAX_AREAS);
  const companyType = COMPANY_TYPES.includes(f.companyType) ? f.companyType : '';
  const worry = WORRIES.includes(f.worry) ? f.worry : '';
  if (!areas.length && !companyType && !worry) return null;
  return { areas, companyType, worry };
}

/** How many of the chosen areas a piece of text touches. 0 when there is no focus. */
function focusScore(text, focus) {
  const f = cleanFocus(focus);
  if (!f || !f.areas.length) return 0;
  const t = ` ${String(text || '').toLowerCase()} `;
  return f.areas.reduce((n, a) => n + (AREAS[a].some((k) => t.includes(k)) ? 1 : 0), 0);
}

const AREA_LABEL = {
  performance: 'web performance', architecture: 'architecture and system design', design_systems: 'design systems and CSS', accessibility: 'accessibility',
  state: 'React and state management', testing: 'testing', api: 'APIs and the backend', data: 'data and databases', reliability: 'reliability and incidents',
  security: 'security', leading: 'leading and influencing people', strategy: 'technical strategy and trade-offs', algorithms: 'algorithms and data structures', ml: 'AI and machine learning',
};
const COMPANY_LABEL = { big_tech: 'a big tech company', scale_up: 'a scale-up', startup: 'an early-stage startup', agency: 'an agency or consultancy' };
const WORRY_LABEL = {
  technical_depth: 'going deep on technical questions', system_design: 'system design', behavioral: 'behavioral questions', speaking_clearly: 'explaining their thinking out loud', coding_speed: 'coding under time pressure',
};

/** One plain sentence for the voice coach, or '' when there is nothing to say. */
function focusSentence(focus) {
  const f = cleanFocus(focus);
  if (!f) return '';
  const parts = [];
  if (f.areas.length) parts.push(`They want to be strongest in ${f.areas.map((a) => AREA_LABEL[a]).join(', ')}.`);
  if (COMPANY_LABEL[f.companyType]) parts.push(`They are aiming at ${COMPANY_LABEL[f.companyType]}.`);
  if (WORRY_LABEL[f.worry]) parts.push(`What worries them most is ${WORRY_LABEL[f.worry]}.`);
  return parts.join(' ');
}

module.exports = { AREAS, COMPANY_TYPES, WORRIES, MAX_AREAS, cleanFocus, focusScore, focusSentence };
