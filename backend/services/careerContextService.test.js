const test = require('node:test');
const assert = require('node:assert/strict');

const { makeCareerContextService } = require('./careerContextService');

/* An in-memory stand-in for the Sequelize model: enough of findOrCreate,
   findOne, update and destroy for the service's rules to be tested. */
const fakeModel = () => {
  const rows = new Map();
  const wrap = (row) => Object.assign(row, {
    update: async (patch) => Object.assign(row, patch, { updatedAt: new Date() }),
  });
  return {
    rows,
    findOrCreate: async ({ where }) => {
      if (!rows.has(where.userId)) {
        rows.set(where.userId, wrap({ userId: where.userId, constraints: {}, summaries: [], assessment: null }));
      }
      return [rows.get(where.userId)];
    },
    findOne: async ({ where }) => rows.get(where.userId) || null,
    destroy: async ({ where }) => rows.delete(where.userId),
  };
};

const make = () => {
  const CareerContext = fakeModel();
  return { CareerContext, service: makeCareerContextService({ CareerContext }) };
};

test('the coach fills gaps but never overwrites what the person set', async () => {
  const { service } = make();
  await service.edit('u1', { target: 'Staff Engineer' });
  const out = await service.merge('u1', { target: 'Principal Engineer', targetWhy: 'Bigger scope' });
  assert.equal(out.target, 'Staff Engineer');
  assert.equal(out.targetWhy, 'Bigger scope');
});

test('a correction made in conversation does overwrite', async () => {
  const { service } = make();
  await service.merge('u1', { target: 'Staff Engineer' });
  const out = await service.merge('u1', { target: 'Engineering Manager' }, { overwrite: true });
  assert.equal(out.target, 'Engineering Manager');
});

test('call summaries are appended, capped, and only text is kept', async () => {
  const { service } = make();
  for (let i = 0; i < 25; i += 1) await service.merge('u1', { summary: `call ${i}` });
  const out = await service.get('u1');
  assert.equal(out.summaries.length, 20);
  assert.equal(out.summaries.at(-1).text, 'call 24');
  assert.deepEqual(Object.keys(out.summaries[0]).sort(), ['at', 'source', 'text']);
});

test('constraints keep only known keys and what was said', async () => {
  const { service } = make();
  const out = await service.merge('u1', { constraints: { location: 'Seattle', salary: '', ssn: '123', roleTypes: ['full-time', ''] } });
  assert.deepEqual(out.constraints, { location: 'Seattle', roleTypes: ['full-time'] });
});

test('one thing, or everything, can be forgotten', async () => {
  const { service } = make();
  await service.merge('u1', { target: 'Staff', targetBlocker: 'No lead experience', summary: 'a', constraints: { location: 'Seattle' } });
  await service.merge('u1', { summary: 'b' });
  let out = await service.forget('u1', { field: 'targetBlocker' });
  assert.equal(out.targetBlocker, '');
  out = await service.forget('u1', { field: 'location' });
  assert.deepEqual(out.constraints, {});
  out = await service.forget('u1', { summaryIndex: 0 });
  assert.deepEqual(out.summaries.map((s) => s.text), ['b']);
  out = await service.clear('u1');
  assert.equal(out.target, '');
  assert.equal((await service.get('u1')).summaries.length, 0);
});
