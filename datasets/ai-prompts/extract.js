// Extract every AI prompt (template/string literals) from the ProfileAI codebase into a dataset.
const fs = require('fs');
const path = require('path');
const FE = path.resolve(__dirname, '../../frontend/node_modules/@babel') + '/';
const parser = require(FE + 'parser');
const traverse = require(FE + 'traverse').default;

const ROOT = path.resolve(__dirname, '../..');
const OUT = process.argv[2];
const files = fs.readFileSync(process.argv[3], 'utf8').split('\n').filter(Boolean);

const MIN_LEN = 180;
const PROMPTISH = /\b(return|json|you are|candidate|resume|job|profile|rules?|respond|output|do not|never|must|recruiter|posting|interview|skills?|bullet)\b/i;

function feature(file, name) {
  const byName = (name || '').toLowerCase();
  const nameMap = [
    ['resume_tailoring', /tailor/], ['job_match_score', /match|fit|strength|evidence|skillgap/],
    ['agent', /agent|pitch|autonomous|scout|negotiat/], ['screening_interview', /screen|interview|intent|reschedule|transcript/],
    ['recruiter_tools', /outreach|salary|comparecandidates|jobdescription|suggestskills/], ['social_post', /post/],
  ];
  if (/aiService\.js$/.test(file)) for (const [f, re] of nameMap) if (re.test(byName)) return f;
  const s = (file + ' ' + (name || '')).toLowerCase();
  const map = [
    ['resume_tailoring', /tailor/],
    ['job_match_score', /jobmatch|match_?score|matchprompt|skillsmatch|analyzematch|culturefit|applicationmatch|skillgaps|assessfit/],
    ['resume_review', /review/],
    ['resume_enhancement', /enhanc/],
    ['resume_writing_rules', /writingrules/],
    ['resume_gap_analysis', /analyzeresumegaps/],
    ['interview_prep', /interviewprep/],
    ['job_ingestion', /hnhiring|jobskillextractor/],
    ['resume_parsing', /resumeparser|parse/],
    ['profile_coach', /coach/],
    ['cover_letter', /coverletter/],
    ['apply_pilot', /applypilot|mapfields|ats\//],
    ['screening_interview', /screening|vapi|interview|triggercall|testphonecall/],
    ['profile_field_rewrite', /routes\/profiles/],
    ['recruiter_tools', /prompts\/job|routes\/jobs/],
    ['profile_tools', /prompts\/profile|routes\/profiles/],
    ['agent', /prompts\/agent|agentarena/],
    ['social_post', /prompts\/post/],
    ['support', /support/],
    ['mcp', /mcp/],
  ];
  for (const [f, re] of map) if (re.test(s)) return f;
  return 'other';
}

function enclosingName(p) {
  const names = [];
  let cur = p;
  while (cur) {
    const n = cur.node;
    if ((cur.isFunctionDeclaration() || cur.isClassMethod() || cur.isObjectMethod()) && n.id?.name) names.unshift(n.id.name);
    else if ((cur.isClassMethod() || cur.isObjectMethod()) && n.key?.name) names.unshift(n.key.name);
    else if (cur.isVariableDeclarator() && n.id?.name) names.unshift(n.id.name);
    else if (cur.isObjectProperty() && (n.key?.name || n.key?.value)) names.unshift(n.key.name || n.key.value);
    else if (cur.isAssignmentExpression() && n.left?.property?.name) names.unshift(n.left.property.name);
    cur = cur.parentPath;
  }
  return names;
}

function roleOf(p, names) {
  const near = names.slice(-3).join('.').toLowerCase();
  let cur = p.parentPath;
  for (let i = 0; i < 6 && cur; i++, cur = cur.parentPath) {
    if (cur.isObjectProperty()) {
      const k = cur.node.key.name || cur.node.key.value;
      if (k === 'system' || k === 'instructions') return 'system';
      if (k === 'content' || k === 'prompt') {
        const obj = cur.parentPath.node;
        const roleProp = obj.properties?.find(pp => (pp.key?.name || pp.key?.value) === 'role');
        if (roleProp?.value?.value) return roleProp.value.value;
        return k === 'prompt' ? 'user' : 'unknown';
      }
    }
  }
  if (/system|instruction|persona|rules?$|guard/.test(near)) return 'system';
  if (/prompt|user|message/.test(near)) return 'user';
  return 'fragment';
}

const records = [];
for (const rel of files) {
  const abs = path.join(ROOT, rel);
  const src = fs.readFileSync(abs, 'utf8');
  let ast;
  try {
    ast = parser.parse(src, { sourceType: 'unambiguous', plugins: ['jsx', 'classProperties', 'optionalChaining', 'topLevelAwait'], errorRecovery: true });
  } catch (e) { console.error('PARSE FAIL', rel, e.message); continue; }

  // Module-level string constants, for resolving ${CONST} references in the same file.
  const consts = {};
  const render = (node) => {
    if (node.type === 'StringLiteral') return node.value;
    if (node.type === 'TemplateLiteral') {
      let out = '';
      node.quasis.forEach((q, i) => {
        out += q.value.cooked ?? q.value.raw;
        const e = node.expressions[i];
        if (e) out += (e.type === 'Identifier' && consts[e.name] != null) ? consts[e.name] : `{{${(() => { const t = src.slice(e.start, e.end).replace(/\s+/g, ' '); return /[`'"]/.test(t) ? t : t.slice(0, 120); })()}}}`;
      });
      return out;
    }
    return null;
  };
  for (const st of ast.program.body) {
    const decls = st.type === 'VariableDeclaration' ? st.declarations : [];
    for (const d of decls) {
      if (d.id?.name && d.init && (d.init.type === 'StringLiteral' || d.init.type === 'TemplateLiteral')) {
        const v = render(d.init); if (v != null) consts[d.id.name] = v;
      }
    }
  }

  const seen = new Set();
  const leaves = (n, acc) => {
    if (n.type === 'BinaryExpression' && n.operator === '+') { leaves(n.left, acc); leaves(n.right, acc); }
    else acc.push(n);
    return acc;
  };
  traverse(ast, {
    BinaryExpression(p) {
      if (p.node.operator !== '+' || (p.parentPath.isBinaryExpression() && p.parentPath.node.operator === '+')) return;
      const parts = leaves(p.node, []);
      if (!parts.some(n => n.type === 'StringLiteral' || n.type === 'TemplateLiteral')) return;
      const text = parts.map(n => render(n) ?? (n.type === 'Identifier' && consts[n.name] != null ? consts[n.name] : `{{${src.slice(n.start, n.end).replace(/\s+/g, ' ').slice(0, 120)}}}`)).join('');
      if (text.length < 60) return;
      parts.forEach(n => seen.add(n.start));
      p.node.__concat = text;
      const names = enclosingName(p);
      const role = roleOf(p, names);
      if (!(role === 'system' || (text.length >= MIN_LEN && PROMPTISH.test(text)))) return;
      emit(p, text, names, role);
    },
    'TemplateLiteral|StringLiteral'(p) {
      if (p.parentPath.isImportDeclaration() || p.parentPath.isExportAllDeclaration()) return;
      // Skip literals nested inside a larger literal (they appear inline as {{...}} there) only if tiny.
      const text = render(p.node);
      if (!text) return;
      const names0 = enclosingName(p);
      const role0 = roleOf(p, names0);
      const inFeedback = /BlockingList/.test(names0.join('.'));
      const shortOk = text.length >= 60 && (role0 === 'system' || inFeedback || /^\s*You are\b/.test(text) || /You are out of time/.test(text));
      if (!(shortOk || (text.length >= MIN_LEN && PROMPTISH.test(text)))) return;
      // Not prompts: regexes, user-facing question copy, canned fallback replies.
      if (/foundation\.js$/.test(rel)) return;
      if (/(^|\.)(question|endCallMessage|message)$/.test(names0.join('.')) || /buildQuestions/.test(names0.join('.'))) return;
      if (/^\s*(SELECT|INSERT|UPDATE|WITH)\b/i.test(text)) return; // SQL
      if (/<\/?(div|html|table|p|span)\b/i.test(text) && !/you are|return/i.test(text)) return; // HTML emails
      if (/^\s*\[ProfilleAI\]/.test(text)) return; // log lines
      const key = p.node.start;
      if (seen.has(key)) return; seen.add(key);
      // Short literals nested inside a bigger prompt literal are already shown inline there.
      if (text.length < MIN_LEN && p.findParent(q => q.isTemplateLiteral())) return;
      emit(p, text, names0, role0);
    },
  });
  function emit(p, text, names, role) {
      // Not prompts: console logs, regex sources, user-facing gap notes.
      if (/^\s*\[ProfilleAI\]/.test(text)) return;
      if (/\(\?:|\\b|\\s\*/.test(text) && !/\s(the|you|a)\s/i.test(text)) return;
      if (/\.detail$/.test(names.join('.'))) return;
      const call = p.findParent(q => q.isCallExpression());
      if (call && /^(pushGap|console\.\w+|logger\.\w+)$/.test(src.slice(call.node.callee.start, call.node.callee.end))) return;
      const line = p.node.loc.start.line;
      records.push({
        id: `${rel.replace(/[\/.]/g, '_')}_L${line}`,
        feature: feature(rel, names.join('.')),
        role: roleOf(p, names),
        source_file: rel,
        line,
        builder: names.join('.') || null,
        has_variables: /\{\{.+?\}\}/.test(text),
        variables: [...new Set([...text.matchAll(/\{\{(.+?)\}\}/g)].map(m => m[1]))],
        char_count: text.length,
        prompt: text.trim(),
      });
  }
}
// Audit feedback lines: one record per builder function.
const fb = {};
for (let i = records.length - 1; i >= 0; i--) {
  const r = records[i];
  if (!/BlockingList/.test(r.builder || '')) continue;
  const k = r.source_file + '|' + r.builder;
  (fb[k] = fb[k] || []).unshift(r); records.splice(i, 1);
}
for (const [k, list] of Object.entries(fb)) {
  const first = list[0];
  const text = list.map(r => '- ' + r.prompt).join('\n');
  records.push({ ...first, feature: /draftAudit/.test(first.source_file) ? 'resume_tailoring' : 'resume_review', role: 'user',
    builder: first.builder + ' (rewrite feedback lines sent back to the model on the enforcement pass; each line is emitted only when its check fails)',
    variables: [...new Set(list.flatMap(r => r.variables))], has_variables: true, char_count: text.length, prompt: text });
}

const byText = new Map();
for (const r of records) {
  const prev = byText.get(r.prompt);
  if (prev) { (prev.also_in = prev.also_in || []).push(`${r.source_file}:${r.line}`); r._dup = true; }
  else byText.set(r.prompt, r);
}
for (let i = records.length - 1; i >= 0; i--) if (records[i]._dup) records.splice(i, 1);
for (const r of records) r.is_test_script = /^backend\/scripts\//.test(r.source_file);
records.sort((a, b) => a.feature.localeCompare(b.feature) || a.source_file.localeCompare(b.source_file) || a.line - b.line);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'prompts.jsonl'), records.map(r => JSON.stringify(r)).join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'prompts.json'), JSON.stringify(records, null, 2));
const by = {};
for (const r of records) by[r.feature] = (by[r.feature] || 0) + 1;
console.log(records.length, 'records'); console.log(by);
