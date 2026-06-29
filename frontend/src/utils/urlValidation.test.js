import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isValidHttpUrl, validateHttpUrl } from './urlValidation.js';

// ── isValidHttpUrl ────────────────────────────────────────────────────────────

test('isValidHttpUrl: accepts http:// and https:// URLs', () => {
  assert.equal(isValidHttpUrl('http://example.com'), true);
  assert.equal(isValidHttpUrl('https://example.com'), true);
  assert.equal(isValidHttpUrl('https://example.com/path?q=1#frag'), true);
  assert.equal(isValidHttpUrl('https://sub.example.co.uk/x'), true);
});

test('isValidHttpUrl: accepts http://localhost for dev use', () => {
  assert.equal(isValidHttpUrl('http://localhost:3000'), true);
  assert.equal(isValidHttpUrl('https://localhost'), true);
});

test('isValidHttpUrl: trims surrounding whitespace before parsing', () => {
  assert.equal(isValidHttpUrl('  https://example.com  '), true);
  assert.equal(isValidHttpUrl('\thttps://example.com\n'), true);
});

test('isValidHttpUrl: rejects empty / whitespace / non-string', () => {
  assert.equal(isValidHttpUrl(''), false);
  assert.equal(isValidHttpUrl('   '), false);
  assert.equal(isValidHttpUrl(null), false);
  assert.equal(isValidHttpUrl(undefined), false);
  assert.equal(isValidHttpUrl(123), false);
  assert.equal(isValidHttpUrl({}), false);
});

test('isValidHttpUrl: rejects plain strings and bare hostnames', () => {
  assert.equal(isValidHttpUrl('not-a-valid-url'), false);
  assert.equal(isValidHttpUrl('example.com'), false); // no protocol
  assert.equal(isValidHttpUrl('//example.com'), false); // protocol-relative
});

test('isValidHttpUrl: rejects non-http(s) schemes (XSS / data exfiltration)', () => {
  assert.equal(isValidHttpUrl('javascript:alert(1)'), false);
  assert.equal(isValidHttpUrl('JAVASCRIPT:alert(1)'), false);
  assert.equal(isValidHttpUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isValidHttpUrl('file:///etc/passwd'), false);
  assert.equal(isValidHttpUrl('mailto:foo@bar.com'), false);
  assert.equal(isValidHttpUrl('ftp://example.com'), false);
  assert.equal(isValidHttpUrl('vbscript:msgbox(1)'), false);
});

test('isValidHttpUrl: rejects single-label hosts (no TLD)', () => {
  // "http://abc" is technically a valid URL but never what a candidate
  // means to enter for a portfolio / project link.
  assert.equal(isValidHttpUrl('http://abc'), false);
  assert.equal(isValidHttpUrl('https://foo'), false);
});

// ── validateHttpUrl ───────────────────────────────────────────────────────────

test('validateHttpUrl: empty + allowEmpty (default) returns ""', () => {
  assert.equal(validateHttpUrl(''), '');
  assert.equal(validateHttpUrl('   '), '');
  assert.equal(validateHttpUrl(undefined), '');
});

test('validateHttpUrl: empty + allowEmpty=false returns required error', () => {
  const msg = validateHttpUrl('', { allowEmpty: false, fieldLabel: 'Portfolio URL' });
  assert.match(msg, /Portfolio URL is required/);
});

test('validateHttpUrl: bad URL returns the standard "http(s)" message', () => {
  const msg = validateHttpUrl('not-a-valid-url');
  assert.match(msg, /http:\/\//);
  assert.match(msg, /https:\/\//);
});

test('validateHttpUrl: javascript: URL is rejected with the standard message', () => {
  const msg = validateHttpUrl('javascript:alert(1)');
  assert.notEqual(msg, '');
  assert.match(msg, /https:\/\//);
});

test('validateHttpUrl: hostMatch enforces host substring', () => {
  const linkedinOpts = {
    hostMatch: { regex: /linkedin\./i, message: 'Enter a linkedin.com URL.' },
  };
  assert.equal(validateHttpUrl('https://www.linkedin.com/in/foo', linkedinOpts), '');
  assert.equal(
    validateHttpUrl('https://example.com/in/foo', linkedinOpts),
    'Enter a linkedin.com URL.',
  );
});

test('validateHttpUrl: hostMatch is only checked once URL is syntactically valid', () => {
  // A bad URL should surface the protocol error, not the host-match error,
  // so the user fixes the most basic problem first.
  const msg = validateHttpUrl('not-a-url', {
    hostMatch: { regex: /linkedin\./i, message: 'Enter a linkedin.com URL.' },
  });
  assert.match(msg, /https:\/\//);
});
