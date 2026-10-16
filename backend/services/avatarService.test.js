const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isLinkedInCdnUrl, isExpiredLinkedInUrl, persistAvatar, resolveAvatar } = require('./avatarService');

// The candidate's actual stored link: expired 2026-08-27, now 403.
const EXPIRED = 'https://media.licdn.com/dms/image/v2/D5603AQE-YawOGtzDPw/profile-displayphoto-scale_400_400/B56Z0gfVVfHIAg-/0/1774366578755?e=1787788800&v=beta&t=SopWx';
const NOW = Date.parse('2026-10-16T12:00:00Z');
const VALID = EXPIRED.replace('e=1787788800', `e=${Math.floor(NOW / 1000) + 60 * 86400}`);
const GOOGLE = 'https://lh3.googleusercontent.com/a/ACg8ocKaz7VC0DQ_EBsO21VmodBrDuv84zcKP7fRK_k0HFGLShn8Z8c=s96-c';
const CLOUDINARY = 'https://res.cloudinary.com/x/image/upload/v1/profileai/profiles/abc.jpg';

test('LinkedIn CDN links are recognised; others are not', () => {
  assert.equal(isLinkedInCdnUrl(EXPIRED), true);
  assert.equal(isLinkedInCdnUrl(GOOGLE), false);
  assert.equal(isLinkedInCdnUrl(CLOUDINARY), false);
  assert.equal(isLinkedInCdnUrl(''), false);
});

test('the reported link is expired; a fresh one is not', () => {
  assert.equal(isExpiredLinkedInUrl(EXPIRED, NOW), true);
  assert.equal(isExpiredLinkedInUrl(VALID, NOW), false);
  assert.equal(isExpiredLinkedInUrl('https://media.licdn.com/x.jpg', NOW), true, 'no expiry means untrusted');
  assert.equal(isExpiredLinkedInUrl(GOOGLE, NOW), false);
});

test('an expired stored photo falls back to the working sign-in photo', () => {
  assert.deepEqual(resolveAvatar(EXPIRED, GOOGLE, NOW), { url: GOOGLE, needsUpdate: true });
});

test('with no working fallback the dead link is cleared, not kept', () => {
  assert.deepEqual(resolveAvatar(EXPIRED, null, NOW), { url: null, needsUpdate: true });
  assert.deepEqual(resolveAvatar(EXPIRED, EXPIRED, NOW), { url: null, needsUpdate: true });
});

test('a still-valid LinkedIn link is kept but flagged for copying', () => {
  assert.deepEqual(resolveAvatar(VALID, GOOGLE, NOW), { url: VALID, needsUpdate: true });
});

test('a Cloudinary or Google photo needs nothing', () => {
  assert.deepEqual(resolveAvatar(CLOUDINARY, GOOGLE, NOW), { url: CLOUDINARY, needsUpdate: false });
  assert.deepEqual(resolveAvatar(GOOGLE, null, NOW), { url: GOOGLE, needsUpdate: false });
});

test('a valid LinkedIn link is copied to Cloudinary', async () => {
  const calls = [];
  const uploader = { upload: async (url, opts) => { calls.push([url, opts]); return { secure_url: CLOUDINARY }; } };
  assert.equal(await persistAvatar(VALID, { userId: 'u1', uploader, now: NOW }), CLOUDINARY);
  assert.equal(calls[0][0], VALID);
  assert.equal(calls[0][1].folder, 'profileai/profiles');
});

test('an expired LinkedIn link is never uploaded and becomes null', async () => {
  const uploader = { upload: async () => { throw new Error('should not be called'); } };
  assert.equal(await persistAvatar(EXPIRED, { uploader, now: NOW }), null);
});

test('a failed upload keeps the still-valid link rather than losing the photo', async () => {
  const uploader = { upload: async () => { throw new Error('network'); } };
  assert.equal(await persistAvatar(VALID, { uploader, now: NOW }), VALID);
});

test('non-LinkedIn URLs pass through untouched', async () => {
  const uploader = { upload: async () => { throw new Error('should not be called'); } };
  assert.equal(await persistAvatar(GOOGLE, { uploader, now: NOW }), GOOGLE);
  assert.equal(await persistAvatar(CLOUDINARY, { uploader, now: NOW }), CLOUDINARY);
});
