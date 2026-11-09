import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaOptions, cleanFocus, toggleArea, focusScore, rankByFocus, focusSummary, MAX_AREAS } from './targeting.js';

test('areaOptions: depends on the role, adds leadership from senior up', () => {
  const ids = (role, level) => areaOptions(role, level).map((a) => a.id);
  assert.deepEqual(ids('Frontend engineer', 'Mid'), ['performance', 'architecture', 'state', 'design_systems', 'accessibility', 'testing']);
  assert.ok(ids('Frontend engineer', 'Staff').includes('leading'));
  assert.ok(ids('Backend engineer', '').includes('reliability'));
  assert.ok(ids('Full stack developer', 'Senior').includes('strategy'));
  assert.ok(ids('Machine learning engineer', '').includes('ml'));
  assert.ok(ids('Barista', '').length >= 5);
  assert.ok(areaOptions('Frontend engineer').every((a) => a.label));
});

test('cleanFocus and toggleArea keep it small and known', () => {
  assert.equal(cleanFocus(null), null);
  assert.equal(cleanFocus({ areas: ['nope'], companyType: 'x' }), null);
  assert.deepEqual(cleanFocus({ areas: ['performance', 'performance'], companyType: 'startup', worry: 'behavioral' }), { areas: ['performance'], companyType: 'startup', worry: 'behavioral' });
  assert.deepEqual(toggleArea(['performance'], 'testing'), ['performance', 'testing']);
  assert.deepEqual(toggleArea(['performance', 'testing'], 'testing'), ['performance']);
  const full = ['performance', 'architecture', 'state', 'testing', 'api'];
  assert.equal(full.length, MAX_AREAS);
  assert.deepEqual(toggleArea(full, 'security'), full);
});

test('rankByFocus puts matching items first, keeps every item and the rest in order', () => {
  const qs = [{ text: 'Tell me about a conflict' }, { text: 'How do you improve load performance?' }, { text: 'Make a slow list accessible and fast' }, { text: 'Why this company?' }];
  const out = rankByFocus(qs, { areas: ['performance', 'accessibility'] });
  assert.deepEqual(out.map((q) => q.text), ['Make a slow list accessible and fast', 'How do you improve load performance?', 'Tell me about a conflict', 'Why this company?']);
  assert.equal(out.length, qs.length);
  assert.strictEqual(rankByFocus(qs, null), qs);
  assert.deepEqual(rankByFocus([{ name: 'Design systems' }, { name: 'Web performance' }], { areas: ['performance'] }).map((t) => t.name), ['Web performance', 'Design systems']);
  assert.equal(focusScore('anything', { areas: [] }), 0);
});

test('focusSummary is short and skips "not sure"', () => {
  assert.equal(focusSummary(null), '');
  assert.equal(focusSummary({ areas: ['performance', 'architecture'], companyType: 'scale_up' }), 'Web performance, Architecture and system design · Scale-up');
  assert.equal(focusSummary({ areas: ['testing'], companyType: 'not_sure' }), 'Testing');
});
