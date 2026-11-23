/**
 * Which element takes a person from a job posting to its application form, if any.
 * Pure over the document it is given, so tests can run it on small pages.
 *
 * It returns only what a person would click next on the same site: the "Application"
 * tab on Ashby, the Apply link on Greenhouse or Lever. It returns nothing when the page
 * already shows a form, and nothing for an Apply link that leaves the site, which is
 * the person's to follow.
 */

// What the "go to the form" control says across job boards: Ashby (Application tab), Greenhouse,
// Lever, Workable, BambooHR, SmartRecruiters ("I'm interested"), Jobvite, iCIMS, Teamtailor.
// The whole label must match, so "Applications status", "Apply filters" and "Reapply" never do.
const APPLY_LABEL = new RegExp(
  '^(' + [
    'apply', 'apply now', 'apply here', 'apply online', 'apply manually',
    'apply (for|to) (this |the )?(job|role|position|opening|vacancy)',
    'apply for this (job|role|position)( now)?',
    'application', 'application form',
    'start (your |an )?application', 'start applying', 'begin application',
    "i['’]?m interested", 'i am interested',
  ].join('|') + ')[.!]?$',
  'i',
);

const REAL_FIELD =
  'input:not([type="hidden"]):not([type="search"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]), textarea, select';

/** `layout: false` skips the size check, for a test document that has no layout engine. */
export function findApplyTarget(doc: Document, win: Window, opts: { layout?: boolean } = {}): HTMLElement | null {
  const layout = opts.layout !== false;
  const visible = (el: Element) => {
    const style = win.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    if (!layout) return true;
    const r = (el as HTMLElement).getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const ours = (el: Element) => !!el.closest('[id^="profileai-"]');

  const fields = Array.from(doc.querySelectorAll<HTMLElement>(REAL_FIELD)).filter((el) => !ours(el) && visible(el));
  if (fields.length >= 4) return null; // already on the form

  const label = (el: Element) => (el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
  const sameSite = (el: Element) => {
    // By tag name, not instanceof: the element can belong to another window (a frame or a test page).
    const href = el.tagName === 'A' ? el.getAttribute('href') : null;
    if (!href || href.startsWith('#')) return true;
    try { return new URL(href, win.location.href).origin === win.location.origin; } catch { return false; }
  };

  const candidates = Array.from(doc.querySelectorAll<HTMLElement>('a, button, [role="tab"], [role="button"]'));
  return candidates.find((el) => !ours(el) && visible(el) && APPLY_LABEL.test(label(el)) && sameSite(el)) || null;
}
