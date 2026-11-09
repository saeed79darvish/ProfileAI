/**
 * Pure helpers for "Aim this prep": which areas to offer for a role, and putting the questions
 * and topics a person is aiming at first. Area ids and keywords mirror backend/services/interviewFocus.js.
 * Ranking only reorders what the shared research already found; it adds and removes nothing.
 */

export const AREA_LABELS = {
  performance: 'Web performance', architecture: 'Architecture and system design', design_systems: 'Design systems and CSS', accessibility: 'Accessibility',
  state: 'React and state management', testing: 'Testing', api: 'APIs and the backend', data: 'Data and databases', reliability: 'Reliability and incidents',
  security: 'Security', leading: 'Leading and influencing people', strategy: 'Technical strategy and trade-offs', algorithms: 'Algorithms and data structures', ml: 'AI and machine learning',
};

const KEYWORDS = {
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

export const COMPANY_TYPES = [
  { id: 'big_tech', label: 'Big tech' }, { id: 'scale_up', label: 'Scale-up' }, { id: 'startup', label: 'Early-stage startup' },
  { id: 'agency', label: 'Agency or consultancy' }, { id: 'not_sure', label: 'Not sure yet' },
];
export const WORRIES = [
  { id: 'technical_depth', label: 'Going deep on technical questions' }, { id: 'system_design', label: 'System design' }, { id: 'behavioral', label: 'Behavioral questions' },
  { id: 'speaking_clearly', label: 'Explaining my thinking out loud' }, { id: 'coding_speed', label: 'Coding under time pressure' }, { id: 'not_sure', label: 'Not sure yet' },
];
export const MAX_AREAS = 5;

const SENIOR = /\b(senior|sr|staff|principal|lead|manager|director|head|architect)\b/i;

/** The areas to offer for a role and level. Always 5 to 8 ids, most relevant first. */
export function areaOptions(role, level) {
  const r = `${role || ''} ${level || ''}`.toLowerCase();
  const has = (re) => re.test(r);
  let ids;
  if (has(/full.?stack/)) ids = ['state', 'api', 'performance', 'architecture', 'data', 'testing', 'security'];
  else if (has(/front.?end|\bui\b|\bweb\b|react|vue|angular|javascript|typescript/)) ids = ['performance', 'architecture', 'state', 'design_systems', 'accessibility', 'testing'];
  else if (has(/back.?end|\bapi\b|server|platform|infra|devops|sre|site reliab/)) ids = ['api', 'data', 'architecture', 'reliability', 'security', 'performance', 'testing'];
  else if (has(/machine learning|\bml\b|\bai\b|data scien|data engineer|analytics/)) ids = ['ml', 'data', 'algorithms', 'architecture', 'reliability'];
  else ids = ['algorithms', 'architecture', 'api', 'data', 'testing'];
  if (SENIOR.test(r)) ids = [...ids, 'leading', 'strategy'];
  return [...new Set(ids)].map((id) => ({ id, label: AREA_LABELS[id] }));
}

/** Focus the page can trust: known ids only, at most five areas. Null when nothing is chosen. */
export function cleanFocus(f) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) return null;
  const areas = [...new Set((Array.isArray(f.areas) ? f.areas : []).filter((a) => typeof a === 'string' && KEYWORDS[a]))].slice(0, MAX_AREAS);
  const companyType = COMPANY_TYPES.some((c) => c.id === f.companyType) ? f.companyType : '';
  const worry = WORRIES.some((w) => w.id === f.worry) ? f.worry : '';
  return areas.length || companyType || worry ? { areas, companyType, worry } : null;
}

/** Toggle an area on or off, keeping at most five. */
export function toggleArea(areas, id) {
  const list = Array.isArray(areas) ? areas : [];
  if (list.includes(id)) return list.filter((a) => a !== id);
  return list.length >= MAX_AREAS ? list : [...list, id];
}

/** How many of the chosen areas a text touches. */
export function focusScore(text, focus) {
  const f = cleanFocus(focus);
  if (!f || !f.areas.length) return 0;
  const t = ` ${String(text || '').toLowerCase()} `;
  return f.areas.reduce((n, a) => n + (KEYWORDS[a].some((k) => t.includes(k)) ? 1 : 0), 0);
}

/** The same items, those touching the chosen areas first (most first), everything else in its own order. Never adds or drops one. */
export function rankByFocus(items, focus, textOf = (x) => x && (x.text || x.name)) {
  const list = Array.isArray(items) ? items : [];
  const f = cleanFocus(focus);
  if (!f || !f.areas.length) return list;
  return list.map((x, i) => ({ x, i, s: focusScore(textOf(x), f) })).sort((a, b) => b.s - a.s || a.i - b.i).map((e) => e.x);
}

/** "Web performance, Architecture and system design · Scale-up", for the collapsed card. */
export function focusSummary(focus) {
  const f = cleanFocus(focus);
  if (!f) return '';
  const company = COMPANY_TYPES.find((c) => c.id === f.companyType && c.id !== 'not_sure');
  return [f.areas.map((a) => AREA_LABELS[a]).join(', '), company ? company.label : ''].filter(Boolean).join(' · ');
}
