import React, { useState } from 'react';

/**
 * Onboarding guide: how to connect ProfilleAI to Claude and what to ask.
 * Public page (no auth) so it can be linked from marketing, docs, or an
 * in-app "Connect to Claude" button.
 */

const MCP_URL = 'https://api.profilleai.com/mcp';

/**
 * Each entry maps to a real MCP tool in backend/mcp/server.js. Keep this
 * list in sync with the tools actually registered there — promising Claude
 * can do something it has no tool for is the fastest way to make the whole
 * connector feel broken.
 */
const CAPABILITIES = [
  {
    icon: '💼',
    title: 'Search jobs and open the right one',
    body:
      'Claude searches the ProfilleAI job board and returns company, location, salary, and a link straight into one-click AI Resume Tailoring. Ask it to drill into any role for the full requirements and benefits.',
  },
  {
    icon: '🎤',
    title: 'Run a mock interview off your real prep',
    body:
      'This is the one worth connecting for. Claude pulls a role you already tailored for — its match score, the interview questions with why each is asked, your STAR examples, and your flagged skill gaps — then drills you on them out loud. Same prep you see in the app, now conversational.',
  },
  {
    icon: '📄',
    title: 'Reach your resumes and portfolio',
    body:
      'List every tailored resume version with PDF/Word download links, or have Claude show your portfolio card — headline, top skills, projects, and links.',
  },
  {
    icon: '🤝',
    title: 'Send a first message',
    body:
      'Ask Claude to reach out to a recruiter or hiring contact you found through a search. Capped at 20 messages a day.',
  },
];

const PROMPT_GROUPS = [
  {
    label: 'Find jobs',
    icon: '💼',
    prompts: [
      'Use ProfilleAI to find senior frontend engineer jobs in San Francisco.',
      'Find remote React roles on ProfilleAI and show me the best matches.',
      'Pull the full requirements and benefits for that second role.',
    ],
  },
  {
    label: 'Interview prep',
    icon: '🎤',
    prompts: [
      'List my tailored resumes on ProfilleAI.',
      'Prep me for my Frontend Engineer interview — run a mock interview and drill my skill gaps.',
      'Ask me the behavioral questions from that role one at a time and critique my answers.',
      'What gaps did ProfilleAI flag for that role, and how should I answer if they come up?',
    ],
  },
  {
    label: 'Portfolio & resumes',
    icon: '📄',
    prompts: [
      'Show my ProfilleAI portfolio.',
      'Give me the download links for my ProfilleAI resume versions.',
    ],
  },
  {
    label: 'Networking',
    icon: '🤝',
    prompts: [
      'Message the recruiter about that role on ProfilleAI.',
    ],
  },
];

const TROUBLESHOOTING = [
  {
    q: 'Claude searched the web instead of using ProfilleAI',
    a: 'Say “ProfilleAI” in the prompt. Without it Claude has no reason to prefer the connector over a plain web search.',
  },
  {
    q: 'It says you have no tailored resumes',
    a: 'Interview prep is built from a resume you tailored for a specific job. Tailor one in ProfilleAI first, then ask Claude again.',
  },
  {
    q: 'Claude connected but can’t see your data',
    a: 'The connector acts as whoever authorized it. Re-run the authorize step and confirm you signed in with the same ProfilleAI account you use here.',
  },
  {
    q: 'There’s no “Add custom connector” button',
    a: 'Custom connectors aren’t available on every Claude plan. If you don’t see the option under Settings → Connectors, your current plan doesn’t include them.',
  },
];

function CopyButton({ text, label = 'Copy', small }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (_) { /* clipboard blocked */ }
  };
  return (
    <button
      type="button"
      onClick={copy}
      style={{ ...S.copyBtn, ...(small ? S.copyBtnSm : {}), ...(copied ? S.copyBtnDone : {}) }}
      aria-label={copied ? 'Copied' : label}
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

export default function IntegrationsClaude() {
  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <header style={S.header}>
          <div style={S.logo}>✦</div>
          <h1 style={S.h1}>Use ProfilleAI inside Claude</h1>
          <p style={S.lede}>
            Connect ProfilleAI as a custom connector and Claude can search jobs, prep you for
            interviews using your real skill gaps, show your portfolio, and pull your resume
            downloads — all from your own account.
          </p>
        </header>

        {/* What you actually get */}
        <section style={S.section}>
          <h2 style={S.h2}>What Claude can do once it&apos;s connected</h2>
          <div style={S.caps}>
            {CAPABILITIES.map((c) => (
              <div key={c.title} style={S.cap}>
                <span style={S.capIcon} aria-hidden>{c.icon}</span>
                <div>
                  <div style={S.capTitle}>{c.title}</div>
                  <div style={S.capBody}>{c.body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Connect steps */}
        <section style={S.section}>
          <h2 style={S.h2}>Connect it (about a minute)</h2>
          <ol style={S.steps}>
            <li style={S.step}>
              <span style={S.stepNum}>1</span>
              <div>
                <div style={S.stepTitle}>Open Claude&apos;s connector settings</div>
                <div style={S.stepText}>In Claude: <strong>Settings → Connectors → Add custom connector</strong>.</div>
              </div>
            </li>
            <li style={S.step}>
              <span style={S.stepNum}>2</span>
              <div style={{ flex: 1 }}>
                <div style={S.stepTitle}>Paste the ProfilleAI URL</div>
                <div style={S.urlRow}>
                  <code style={S.code}>{MCP_URL}</code>
                  <CopyButton text={MCP_URL} label="Copy URL" />
                </div>
                <div style={S.stepText}>Leave the OAuth fields blank — Claude registers automatically.</div>
              </div>
            </li>
            <li style={S.step}>
              <span style={S.stepNum}>3</span>
              <div>
                <div style={S.stepTitle}>Authorize with your ProfilleAI account</div>
                <div style={S.stepText}>
                  Click <strong>Connect</strong>, sign in, and press <strong>Allow</strong> on the ProfilleAI screen.
                  That&apos;s what lets Claude use <em>your</em> resumes and interview prep.
                </div>
              </div>
            </li>
          </ol>
        </section>

        {/* Prompt library */}
        <section style={S.section}>
          <h2 style={S.h2}>What to ask Claude</h2>
          <div style={S.tipBox}>
            <strong>Two things to remember:</strong> say <strong>“ProfilleAI”</strong> in your prompt (otherwise
            Claude may just web-search), and make sure you&apos;re signed in when you authorized.
          </div>
          <div style={S.groups}>
            {PROMPT_GROUPS.map((g) => (
              <div key={g.label} style={S.group}>
                <div style={S.groupHead}><span aria-hidden>{g.icon}</span> {g.label}</div>
                {g.prompts.map((p) => (
                  <div key={p} style={S.promptRow}>
                    <span style={S.promptText}>“{p}”</span>
                    <CopyButton text={p} small />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* Troubleshooting */}
        <section style={S.section}>
          <h2 style={S.h2}>If something doesn&apos;t work</h2>
          <div style={S.faqs}>
            {TROUBLESHOOTING.map((t) => (
              <div key={t.q} style={S.faq}>
                <div style={S.faqQ}>{t.q}</div>
                <div style={S.faqA}>{t.a}</div>
              </div>
            ))}
          </div>
        </section>

        <footer style={S.footer}>
          Each result links back into ProfilleAI — open a job to tailor your resume, or download a
          version — so Claude becomes the front door to your job search.
        </footer>
      </div>
    </div>
  );
}

const PURPLE = '#6941C6';
const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #f7f5ff 0%, #eef2ff 100%)', padding: '32px 16px' },
  wrap: { maxWidth: 720, margin: '0 auto' },
  header: { textAlign: 'center', marginBottom: 28 },
  logo: {
    width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
    background: `linear-gradient(135deg, ${PURPLE}, #7C5CFC)`, color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
  },
  h1: { fontSize: 30, fontWeight: 800, color: '#16181d', margin: '0 0 12px', lineHeight: 1.2 },
  lede: { fontSize: 16, color: '#4b5563', lineHeight: 1.6, margin: '0 auto', maxWidth: 560 },
  section: { background: '#fff', borderRadius: 18, padding: '24px 24px', marginBottom: 18, boxShadow: '0 4px 24px rgba(79,70,229,0.08)' },
  h2: { fontSize: 18, fontWeight: 700, color: '#16181d', margin: '0 0 16px' },
  steps: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 18 },
  step: { display: 'flex', gap: 14, alignItems: 'flex-start' },
  stepNum: {
    flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: '#f0ecfb', color: PURPLE,
    fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  stepTitle: { fontSize: 15, fontWeight: 700, color: '#16181d', marginBottom: 3 },
  stepText: { fontSize: 14, color: '#4b5563', lineHeight: 1.5 },
  urlRow: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '6px 0 8px' },
  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13.5, color: '#16181d',
    background: '#f4f4f6', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', wordBreak: 'break-all',
  },
  tipBox: {
    background: '#fffbeb', border: '1px solid #fde68a', color: '#7c5b12', borderRadius: 12,
    padding: '12px 14px', fontSize: 13.5, lineHeight: 1.55, marginBottom: 16,
  },
  caps: { display: 'flex', flexDirection: 'column', gap: 16 },
  cap: { display: 'flex', gap: 13, alignItems: 'flex-start' },
  capIcon: {
    flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: '#f0ecfb',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
  },
  capTitle: { fontSize: 15, fontWeight: 700, color: '#16181d', marginBottom: 3 },
  capBody: { fontSize: 14, color: '#4b5563', lineHeight: 1.55 },
  faqs: { display: 'flex', flexDirection: 'column', gap: 14 },
  faq: { borderLeft: '3px solid #ececf1', paddingLeft: 13 },
  faqQ: { fontSize: 14.5, fontWeight: 700, color: '#16181d', marginBottom: 4 },
  faqA: { fontSize: 14, color: '#4b5563', lineHeight: 1.55 },
  groups: { display: 'flex', flexDirection: 'column', gap: 16 },
  group: {},
  groupHead: { fontSize: 13, fontWeight: 700, color: PURPLE, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 },
  promptRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '10px 12px', border: '1px solid #ececf1', borderRadius: 10, marginBottom: 8,
  },
  promptText: { fontSize: 14, color: '#374151', lineHeight: 1.45 },
  copyBtn: {
    flexShrink: 0, padding: '9px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
    background: PURPLE, color: '#fff', fontSize: 13, fontWeight: 700,
  },
  copyBtnSm: { padding: '6px 12px', fontSize: 12 },
  copyBtnDone: { background: '#0f9d58' },
  footer: { textAlign: 'center', fontSize: 13.5, color: '#6b7280', lineHeight: 1.6, padding: '4px 8px 20px' },
};
