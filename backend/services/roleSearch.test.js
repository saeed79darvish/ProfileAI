/* Title and search-text understanding: utils/roleQuery and utils/searchQuery.
   Kept here because the test glob only covers services/. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { deriveRoleQuery, splitTitleTokens, normalizeRoleCompounds } = require('../utils/roleQuery');
const { buildJobSearchTsquery, relaxedSearches } = require('../utils/searchQuery');
const { titleTerms } = require('./coachMarket');
const { rankJobs } = require('./jobRelevanceService');

test('every spelling of a compound role word is one word', () => {
  for (const t of ['Front-End', 'Front End', 'front/end', 'Front_End', 'Frontend']) {
    assert.equal(normalizeRoleCompounds(t).toLowerCase(), 'frontend', t);
  }
  assert.equal(normalizeRoleCompounds('Back-End / Full Stack Dev Ops').toLowerCase(), 'backend / fullstack devops');
  // Not compounds.
  assert.equal(normalizeRoleCompounds('Front Desk Agent'), 'Front Desk Agent');
  assert.equal(normalizeRoleCompounds('Fallback Endpoint'), 'Fallback Endpoint');
});

test('a profile title becomes the search its owner means', () => {
  assert.equal(deriveRoleQuery('Front/End UI Architect'), 'Frontend UI Engineer');
  assert.equal(deriveRoleQuery('Senior UI Software Architect Engineer'), 'UI Engineer');
  assert.equal(deriveRoleQuery('Back End Developer at Stripe'), 'Backend Developer');
  assert.equal(deriveRoleQuery('Backend Architect'), 'Backend Engineer');
  // Architects whose postings do say Architect keep it.
  assert.equal(deriveRoleQuery('Solutions Architect'), 'Solutions Architect');
  assert.equal(deriveRoleQuery('Software Architect'), 'Software Architect');
});

test('title words for counting and scoring see one frontend', () => {
  assert.deepEqual(titleTerms('Senior Front-End Engineer'), ['frontend', 'engineer']);
  assert.deepEqual(splitTitleTokens('Front End UI Architect').specialty, ['frontend', 'ui', 'architect']);
});

test('a Frontend Engineer scores on title against a Front-End posting', () => {
  const profile = { title: 'Frontend Engineer', skills: [] };
  const [hyphen] = rankJobs([{ id: 1, title: 'Front-End Engineer', description: '' }], profile);
  const [joined] = rankJobs([{ id: 2, title: 'Frontend Engineer', description: '' }], profile);
  assert.ok(hyphen.titleMatch > 0);
  assert.equal(hyphen.titleMatch, joined.titleMatch);
});

test('an architect of a software surface searches its engineers too', () => {
  const tsq = buildJobSearchTsquery('UI Architecture');
  assert.match(tsq, /\bui\b/);
  assert.match(tsq, /architect \| architecture \| engineer \| developer/);
  // A Solutions Architect is not widened to engineers.
  assert.doesNotMatch(buildJobSearchTsquery('Solutions Architect'), /engineer/);
});

test('a search that finds nothing widens one word at a time', () => {
  assert.deepEqual(relaxedSearches('Registered Nurse ICU Night'), ['registered nurse icu', 'registered nurse']);
  assert.deepEqual(relaxedSearches('Senior Backend Engineer Kotlin'), ['senior backend engineer', 'backend engineer']);
  // Never down to a bare "engineer", never to nothing.
  assert.deepEqual(relaxedSearches('Frontend Engineer'), []);
  assert.deepEqual(relaxedSearches('nurse'), []);
});
