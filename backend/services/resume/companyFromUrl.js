/**
 * A company name from a job URL, for records saved without one.
 *
 * Every Ashby posting was saved with no company (the extension did not read
 * Ashby's "Role @ Company" tab title), so its tailored resume showed up in the
 * list as a bare job title among other bare job titles. The hosted ATSes put
 * the employer's slug in the first path segment — jobs.ashbyhq.com/solace/…,
 * boards.greenhouse.io/initech/…, jobs.lever.co/hooli/… — which is enough to
 * label the card.
 */
const HOSTED_ATS = /(?:^|\.)(?:ashbyhq\.com|greenhouse\.io|lever\.co|workable\.com|breezy\.hr|jobvite\.com|smartrecruiters\.com|bamboohr\.com|rippling\.com|applytojob\.com)$/i;

function companyFromJobUrl(jobUrl) {
  try {
    const u = new URL(String(jobUrl || ''));
    const host = u.hostname.toLowerCase();
    if (/myworkdayjobs\.com$/.test(host)) {
      // acme.wd5.myworkdayjobs.com
      return titleCase(host.split('.')[0]);
    }
    if (HOSTED_ATS.test(host)) {
      const seg = u.pathname.split('/').filter(Boolean)[0] || '';
      if (seg && !/^(jobs?|careers?|embed|job|position|apply)$/i.test(seg) && !/^[0-9a-f-]{20,}$/i.test(seg)) {
        return titleCase(seg);
      }
      return '';
    }
    // A company careers site: careers.northwind.com / northwind.com/careers
    const parts = host.replace(/^www\./, '').split('.');
    const base = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    if (/linkedin|indeed|glassdoor|ziprecruiter|google|wellfound|angel/i.test(base)) return '';
    return base ? titleCase(base) : '';
  } catch (_) {
    return '';
  }
}

function titleCase(slug) {
  return String(slug || '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = { companyFromJobUrl };
