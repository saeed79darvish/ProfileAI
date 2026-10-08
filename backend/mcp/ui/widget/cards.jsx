/**
 * ProfilleAI MCP App widget — renders job / portfolio / resume-download cards
 * inside Claude's sandboxed iframe.
 *
 * Data contract: the MCP server injects `window.__MCP_DATA__` (a JSON object)
 * into the HTML at tool-call time, so this bundle is fully self-contained and
 * needs no network. Shape:
 *   { kind: 'jobs'|'portfolio'|'resumeDownloads', title, jobs?, portfolio?, resumes? }
 *
 * The iframe NEVER navigates. The primary action posts a "link" intent to the
 * host (MCP-UI + Apps SDK conventions) and the host opens the deep link in a
 * new tab — carrying the user back to ProfilleAI's AI tools for that job.
 */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

/** Ask the host to open a URL in a new tab. Never navigate the iframe itself. */
function openInHost(url) {
  if (!url) return;
  // Apps SDK (OpenAI-style hosts)
  try { window.openai?.openExternal?.({ href: url }); } catch (_) {}
  // MCP-UI standard link intent
  try { window.parent?.postMessage({ type: 'link', payload: { url } }, '*'); } catch (_) {}
  // Generic fallback some hosts listen for
  try { window.parent?.postMessage({ type: 'openLink', url }, '*'); } catch (_) {}
}

function Badge({ children, tone }) {
  return <span className={`pa-badge${tone ? ' pa-badge--' + tone : ''}`}>{children}</span>;
}

function MatchScore({ score }) {
  if (score == null) return null;
  const tone = score >= 80 ? 'good' : score >= 60 ? 'ok' : 'low';
  return <Badge tone={tone}>{score}% match</Badge>;
}

function ActionButton({ label, url, primary }) {
  return (
    <button
      type="button"
      className={`pa-btn${primary ? ' pa-btn--primary' : ''}`}
      onClick={() => openInHost(url)}
    >
      {label}
    </button>
  );
}

function JobCard({ job, expanded }) {
  const [open, setOpen] = useState(false);
  const showDetail = expanded || open;
  return (
    <article className="pa-card" aria-label={`${job.title} at ${job.company || 'company'}`}>
      <div className="pa-card__head">
        <div className="pa-card__title">{job.title}</div>
        <MatchScore score={job.matchScore} />
      </div>
      <div className="pa-card__meta">
        {job.company && <span>{job.company}</span>}
        {job.location && <span>· {job.location}</span>}
        {job.salaryRange && <span>· {job.salaryRange}</span>}
      </div>
      {job.shortDescription && <p className="pa-card__desc">{job.shortDescription}</p>}

      {showDetail && (job.fullDescription || (job.requirements && job.requirements.length > 0)) && (
        <div className="pa-card__detail">
          {job.fullDescription && <p className="pa-card__detail-text">{job.fullDescription}</p>}
          {job.requirements && job.requirements.length > 0 && (
            <>
              <div className="pa-card__detail-h">Requirements</div>
              <ul className="pa-list">
                {job.requirements.slice(0, 8).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="pa-card__actions">
        <ActionButton label="Prepare with AI" url={job.deepLinkUrl} primary />
        {!expanded && (job.fullDescription || (job.requirements && job.requirements.length > 0)) && (
          <button
            type="button"
            className="pa-btn"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Less' : 'Details'}
          </button>
        )}
      </div>
    </article>
  );
}

function ResumeCard({ resume }) {
  return (
    <article className="pa-card" aria-label={`Resume for ${resume.jobTitle}`}>
      <div className="pa-card__head">
        <div className="pa-card__title">{resume.jobTitle}</div>
        <MatchScore score={resume.matchScore} />
      </div>
      <div className="pa-card__meta">
        {resume.company && <span>{resume.company}</span>}
        {resume.createdAt && <span>· {new Date(resume.createdAt).toLocaleDateString()}</span>}
      </div>
      <div className="pa-card__actions">
        <ActionButton label="Download resume" url={resume.downloadUrl} primary />
      </div>
    </article>
  );
}

function PortfolioCard({ portfolio, expanded }) {
  const p = portfolio;
  return (
    <article className="pa-card" aria-label="Portfolio">
      <div className="pa-card__head">
        <div className="pa-card__title">{p.name || 'Portfolio'}</div>
      </div>
      {p.headline && <div className="pa-card__meta"><span>{p.headline}</span>{p.location && <span>· {p.location}</span>}</div>}
      {p.summary && <p className="pa-card__desc">{p.summary}</p>}

      {p.skills && p.skills.length > 0 && (
        <div className="pa-chips">
          {p.skills.slice(0, expanded ? 24 : 10).map((s, i) => <span key={i} className="pa-chip">{s}</span>)}
        </div>
      )}

      {expanded && p.projects && p.projects.length > 0 && (
        <div className="pa-card__detail">
          <div className="pa-card__detail-h">Projects</div>
          {p.projects.slice(0, 6).map((pr, i) => (
            <div key={i} className="pa-proj">
              <div className="pa-proj__name">{pr.name}</div>
              {pr.description && <div className="pa-proj__desc">{pr.description}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="pa-card__actions">
        <ActionButton label="View full portfolio" url={p.deepLinkUrl} primary />
        {p.links && p.links.map((l, i) => (
          <ActionButton key={i} label={l.label} url={l.url} />
        ))}
      </div>
    </article>
  );
}

function App() {
  const data = (typeof window !== 'undefined' && window.__MCP_DATA__) || {};
  const [expanded, setExpanded] = useState(false);
  const kind = data.kind || (data.jobs ? 'jobs' : data.resumes ? 'resumeDownloads' : data.portfolio ? 'portfolio' : 'jobs');

  const items = kind === 'jobs' ? (data.jobs || []) : kind === 'resumeDownloads' ? (data.resumes || []) : [];
  const isEmpty = kind === 'portfolio' ? !data.portfolio : items.length === 0;

  return (
    <div className="pa-root" data-kind={kind}>
      <div className="pa-toolbar">
        <div className="pa-toolbar__title">{data.title || 'ProfilleAI'}</div>
        {!isEmpty && (
          <button
            type="button"
            className="pa-btn pa-btn--ghost"
            aria-pressed={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Compact' : 'Expand'}
          </button>
        )}
      </div>

      {isEmpty ? (
        <div className="pa-empty">Nothing to show yet.</div>
      ) : (
        <div className={`pa-grid${expanded ? ' pa-grid--expanded' : ''}`}>
          {kind === 'jobs' && items.map((j) => <JobCard key={j.jobId} job={j} expanded={expanded} />)}
          {kind === 'resumeDownloads' && items.map((r) => <ResumeCard key={r.id} resume={r} />)}
          {kind === 'portfolio' && <PortfolioCard portfolio={data.portfolio} expanded={expanded} />}
        </div>
      )}
    </div>
  );
}

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
