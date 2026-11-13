#!/usr/bin/env node
/**
 * Evaluate resume tailoring: run the real pipeline, judge every result.
 *
 * Usage:
 *   node scripts/tailorEval.js --fixtures <dir> [--only name] [--stale] [--no-judge]
 *
 * <dir> holds:
 *   profile.json        the candidate profile, as the AI sees it
 *   jd_<name>.txt       one posting per file
 *   titles.json         (optional) { "<name>": { "title": "...", "company": "..." } }, what the
 *                       job board header would have supplied
 *   stale_resume.txt    (optional) a resume that is NOT the candidate's, used
 *                       with --stale to reproduce the "wrong stored resume" bug
 *
 * Fixtures are read from disk and never committed: a profile is personal data.
 *
 * For each posting it prints the deterministic check failures and the model
 * judge's scores and issues, then the issues that recur across postings,
 * which are the ones worth fixing in the tailoring logic. A report is written
 * to <dir>/report-<timestamp>.json.
 *
 * This spends AI budget (one tailoring run and one judge call per posting).
 * It talks to whatever database and API key .env points at, so run it locally.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };

const dir = opt('fixtures');
if (!dir) { console.error('--fixtures <dir> is required'); process.exit(2); }
const only = opt('only');

const { deterministicChecks, judgeWithModel } = require('../services/resume/tailorJudge');
const { callAI } = require('../services/ai/core');

const callModel = async ({ prompt, max_tokens }) => {
  const res = await callAI({ messages: [{ role: 'user', content: prompt }], max_tokens, temperature: 0 });
  return res.choices[0].message.content;
};

(async () => {
  const profile = JSON.parse(fs.readFileSync(path.join(dir, 'profile.json'), 'utf8'));
  const staleFile = path.join(dir, 'stale_resume.txt');
  const storedResume = flag('stale') && fs.existsSync(staleFile) ? fs.readFileSync(staleFile, 'utf8') : null;
  const jobs = fs.readdirSync(dir).filter((f) => /^jd_.+\.txt$/.test(f)).map((f) => f.slice(3, -4)).filter((n) => !only || n === only);
  if (!jobs.length) { console.error('no jd_*.txt fixtures found'); process.exit(2); }

  const titlesFile = path.join(dir, 'titles.json');
  const titles = fs.existsSync(titlesFile) ? JSON.parse(fs.readFileSync(titlesFile, 'utf8')) : {};
  const svc = require('../services/resumeParserService');
  const runOne = async (name) => {
    const jobDescription = fs.readFileSync(path.join(dir, `jd_${name}.txt`), 'utf8');
    const meta = titles[name] || {};
    const t0 = Date.now();
    const r = await svc.tailorProfileForJob(profile, jobDescription, storedResume, null, null, { jobTitle: meta.title || name, company: meta.company || '' });
    if (!r.success) return { name, error: r.error };
    const result = r.data;
    const checks = deterministicChecks({ profile, result, jobDescription });
    const judged = flag('no-judge') ? null : await judgeWithModel({ profile, result, jobDescription, callModel });
    return { name, seconds: Math.round((Date.now() - t0) / 1000), result, checks, judged };
  };

  const reports = await Promise.all(jobs.map((n) => runOne(n).catch((e) => ({ name: n, error: e.message }))));

  const recurring = new Map();
  for (const rep of reports) {
    console.log(`\n=== ${rep.name} ${rep.error ? 'ERROR: ' + rep.error : `(${rep.seconds}s)`}`);
    if (rep.error) continue;
    console.log(`headline: ${rep.result.title} | match ${rep.result.matchScore}`);
    console.log(`summary: ${rep.result.summary}`);
    for (const c of rep.result.changelog || []) if (['polished', 'stale_resume_ignored', 'roles_aligned'].includes(c.action)) console.log(`  [${c.action}] ${c.detail}`);
    console.log(rep.checks.pass ? 'checks: all pass' : `checks FAILED:\n${rep.checks.failures.map((f) => `  - ${f.check}: ${f.detail}`).join('\n')}`);
    if (rep.judged) {
      const s = rep.judged.scores || {};
      console.log(`judge: ${Object.entries(s).map(([k, v]) => `${k} ${v}`).join(' | ')}`);
      console.log(`verdict: ${rep.judged.verdict}`);
      for (const i of rep.judged.issues || []) {
        console.log(`  [${i.severity}] ${i.where}: ${i.problem}${i.quote ? `  ("${String(i.quote).slice(0, 90)}")` : ''}`);
        const key = String(i.rule || '').trim();
        if (key) recurring.set(key, (recurring.get(key) || 0) + 1);
      }
    }
  }
  const avg = (k) => {
    const v = reports.filter((r) => r.judged && r.judged.scores && Number.isFinite(r.judged.scores[k])).map((r) => r.judged.scores[k]);
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : 'n/a';
  };
  console.log('\n=== AVERAGE SCORES');
  console.log(['faithfulness', 'human_voice', 'relevance', 'specificity', 'skim'].map((k) => `${k} ${avg(k)}`).join(' | '));
  console.log(`checks passing: ${reports.filter((r) => r.checks && r.checks.pass).length}/${reports.length}`);
  if (recurring.size) {
    console.log('\n=== RULES THE JUDGE WANTS (most requested first)');
    [...recurring].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([rule, n]) => console.log(`  x${n}  ${rule}`));
  }
  const out = path.join(dir, `report-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify(reports, null, 2));
  console.log(`\nreport: ${out}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
