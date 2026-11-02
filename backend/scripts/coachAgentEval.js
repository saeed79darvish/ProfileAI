/**
 * Replays conversations through the coach's typed turn and checks what it
 * DID, not how it worded it: whether it opened the call, put buttons up,
 * took an answer back, or looked a feature up before describing it.
 *
 *   node scripts/coachAgentEval.js            # every case, real model calls
 *   node scripts/coachAgentEval.js voice      # cases whose name contains "voice"
 *
 * Each case costs one or two small model calls. The page state is set by
 * hand, which is the point: "today's call is used" cannot be produced on
 * demand in a browser.
 */
require('dotenv').config();

/* Did it look something up? The turn's result does not carry the tool
   calls, so the runner is watched instead, so this has
   to be in place before the service takes its copy. */
const agent = require('../services/coachAgent');
const realRunner = agent.createToolRunner;
let lookups = [];
agent.createToolRunner = (opts) => {
  const runner = realRunner(opts);
  return { ...runner, run: (name, input) => { if (name === 'look_up_feature') lookups.push(input.feature); return runner.run(name, input); } };
};

const { coachTurn } = require('../services/profileCoachService');

const newGrad = {
  profile: { field: 'Software & IT', careerStage: 'new_grad', title: 'Junior Full Stack Developer', roleTypes: ['full_time'], workStyle: 'flexible' },
  missing: ['education', 'a project', 'skills'],
  asked: 'Where did you study, and what?',
  next: { question: 'Tell me about a project you are proud of.' },
  state: {
    imports: [],
    step: { number: 11, total: 24 },
    answered: [
      { step: 'sector', question: 'Which field are you in?', answer: 'Software & IT' },
      { step: 'careerStage', question: 'Where are you in your career right now?', answer: "I'm a new grad / student" },
      { step: 'lookingFor', question: 'What kind of work are you looking for?', answer: 'Full-time' },
      { step: 'workStyle', question: 'Remote, hybrid, or on-site?', answer: 'Flexible' },
    ],
  },
};
const afterEmptyCall = [
  { role: 'coach', text: 'How would you like to do the rest? We can talk it through, about 5 minutes, or carry on here in the chat.' },
  { role: 'me', text: 'Talk it through' },
  { role: 'event', text: 'The live call ended after 4 seconds. Nothing was said on it.' },
  { role: 'coach', text: 'Where did you study, and what?' },
];

const CASES = [
  {
    name: 'voice: lets talk after an empty call, call available',
    ...newGrad, history: afterEmptyCall, message: 'lets talk',
    access: { signedIn: false, voice: 'can_call' }, lastCall: 'ended_empty',
    expect: { action: 'voice' },
  },
  {
    name: 'voice: lets talk after an empty call, guest call used',
    ...newGrad, history: afterEmptyCall, message: 'lets talk',
    access: { signedIn: false, voice: 'guest_call_used' }, lastCall: 'ended_empty',
    expect: { action: 'account', reason: 'voice', notSaid: /can.?t do (a )?(full )?voice|only (read|type) text/i },
  },
  {
    name: 'voice: asks how to get to voice',
    ...newGrad, history: afterEmptyCall, message: 'how to go to voice optoions?',
    access: { signedIn: false, voice: 'can_call' }, lastCall: 'ended_empty',
    expect: { action: 'voice' },
  },
  {
    name: 'voice: signed in, plan used up',
    ...newGrad, history: [], message: 'can we do this by voice instead',
    access: { signedIn: true, voice: 'plan_limit' },
    expect: { action: null, said: /mic/i },
  },
  {
    name: 'not voice: "talk" meaning help',
    ...newGrad, history: [], message: "can we talk about this, I'm not sure what counts as study for a bootcamp",
    access: { signedIn: false, voice: 'can_call' },
    expect: { action: null },
  },
  {
    name: 'import: CV mid-question',
    ...newGrad, history: [], message: 'actually can I just upload my CV instead',
    access: { signedIn: false, voice: 'can_call' },
    expect: { action: 'import' },
  },
  {
    name: 'rewind: not a new grad',
    ...newGrad, history: [], message: "wait I'm not a new grad, I've been working for 3 years",
    access: { signedIn: false, voice: 'can_call' },
    expect: { action: 'rewind', step: 'careerStage' },
  },
  {
    name: 'feature: cover letters',
    ...newGrad, history: [], message: 'can you also write my cover letters?',
    access: { signedIn: false, voice: 'can_call' },
    expect: { action: null, lookedUp: true },
  },
  {
    name: 'feature: what happens after',
    ...newGrad, history: [], message: 'what do I get at the end of this?',
    access: { signedIn: false, voice: 'can_call' },
    expect: { action: null, lookedUp: true },
  },
  {
    name: 'save: guest finishing tomorrow',
    ...newGrad, history: [], message: "I have to go, can I finish this tomorrow?",
    access: { signedIn: false, voice: 'can_call' },
    expect: { action: 'account', reason: 'save' },
  },
  {
    name: 'save: signed in needs no account',
    ...newGrad, history: [], message: "I have to go, can I finish this tomorrow?",
    access: { signedIn: true, voice: 'can_call' },
    expect: { action: null },
  },
  {
    name: 'answer: plain education answer',
    ...newGrad, history: [], message: 'University of Toronto, BSc Computer Science, finished 2025',
    access: { signedIn: false, voice: 'can_call' },
    expect: { action: null, learned: 'school' },
  },
];

async function main() {
  const only = process.argv[2];
  let failed = 0;
  for (const c of CASES.filter((x) => !only || x.name.includes(only))) {
    lookups = [];
    const started = Date.now();
    const turn = await coachTurn({
      profile: c.profile,
      missing: c.missing,
      history: c.history,
      message: c.message,
      asked: c.asked,
      options: [],
      next: c.next,
      followUps: 0,
      access: c.access,
      state: { ...c.state, lastCall: c.lastCall || 'none' },
    });
    const action = turn.actions[0] || null;
    const problems = [];
    const e = c.expect;
    if ((action?.type || null) !== e.action) problems.push(`action ${action?.type || 'none'}, wanted ${e.action || 'none'}`);
    if (e.reason && action?.reason !== e.reason) problems.push(`reason ${action?.reason}, wanted ${e.reason}`);
    if (e.step && action?.step !== e.step) problems.push(`step ${action?.step}, wanted ${e.step}`);
    if (e.notSaid && e.notSaid.test(turn.say)) problems.push('said something it must not');
    if (e.said && !e.said.test(turn.say)) problems.push(`did not say ${e.said}`);
    if (e.lookedUp && !lookups.length) problems.push('described a feature without looking it up');
    if (e.learned && !turn.learned[e.learned]) problems.push(`learned no ${e.learned}`);
    if (problems.length) failed += 1;
    console.log(`${problems.length ? 'FAIL' : 'pass'}  ${c.name}  (${Date.now() - started}ms)`);
    console.log(`      say: ${turn.say || '(nothing)'}`);
    if (lookups.length) console.log(`      looked up: ${lookups.join(', ')}`);
    for (const p of problems) console.log(`      ${p}`);
  }
  console.log(failed ? `\n${failed} failed` : '\nall passed');
  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
