const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePublicProfileHtml, canonicalProfileUrl, toDate } = require('./linkedinPublicService');

// The public profile page's structure, with made-up content. Class names
// carry a literal ">" the way LinkedIn's Tailwind classes do.
const PAGE = `
<html><head><title>Jane Doe - Senior Frontend Engineer at Acme | LinkedIn</title>
<script type="application/ld+json">{"@context":"http://schema.org","@graph":[{"@type":"Person","name":"Jane Doe","address":{"@type":"PostalAddress","addressLocality":"Austin, Texas, United States"},"description":"Fallback about."}]}</script>
</head><body>
<section class="core-section-container" data-section="summary">
  <h2>About</h2>
  <div class="core-section-container__content break-words"><p>I build fast, accessible web apps &amp; design systems.</p></div>
</section>
<section class="core-section-container" data-section="experience">
  <ul>
    <li class="profile-section-card experience-item" data-section="currentPositionsDetails">
      <h3 class="[&amp;>*]:mb-0 font-semibold"><span class="experience-item__title">Senior Frontend Engineer</span></h3>
      <h4 class="text-md [&amp;>*]:mb-0"><a href="#"><span class="experience-item__subtitle">Acme</span></a></h4>
      <p class="experience-item__meta-item"><span class="date-range text-md"><time>Mar 2022</time> - Present <span>2 yrs</span></span></p>
      <div class="show-more-less-text"><p class="show-more-less-text__text--less">Led the checkout rewrite.<br>Cut load time 40%.</p></div>
    </li>
    <li class="profile-section-card experience-item" data-section="pastPositionsDetails">
      <h3 class="[&amp;>*]:mb-0"><span class="experience-item__title">Frontend Developer</span></h3>
      <h4><span class="experience-item__subtitle">Beta Corp</span></h4>
      <p><span class="date-range"><time>2019</time> - <time>Feb 2022</time></span></p>
    </li>
  </ul>
</section>
<section data-section="educationsDetails">
  <ul>
    <li class="profile-section-card education__list-item">
      <h3 class="[&amp;>*]:mb-0 text-[18px]"> State University </h3>
      <h4><span class="education__item education__item--degree-info">BSc</span><span class="education__item education__item--degree-info">Computer Science</span></h4>
      <span class="date-range"><time>2015</time> - <time>2019</time></span>
    </li>
  </ul>
</section>
</body></html>`;

test('reads a public profile page into the resume shape', () => {
  const d = parsePublicProfileHtml(PAGE, 'https://www.linkedin.com/in/jane-doe/');
  assert.equal(d.firstName, 'Jane');
  assert.equal(d.lastName, 'Doe');
  assert.equal(d.title, 'Senior Frontend Engineer at Acme');
  assert.equal(d.location, 'Austin, Texas, United States');
  assert.equal(d.summary, 'I build fast, accessible web apps & design systems.');
  assert.equal(d.experience.length, 2);
  assert.deepEqual(d.experience[0], {
    title: 'Senior Frontend Engineer', company: 'Acme', startDate: '2022-03', endDate: null, current: true,
    description: 'Led the checkout rewrite.\nCut load time 40%.',
  });
  assert.equal(d.experience[1].startDate, '2019');
  assert.equal(d.experience[1].endDate, '2022-02');
  assert.equal(d.experience[1].current, false);
  assert.deepEqual(
    [d.education[0].institution, d.education[0].degree, d.education[0].field, d.education[0].startDate, d.education[0].endDate],
    ['State University', 'BSc', 'Computer Science', '2015', '2019']
  );
  assert.deepEqual(d.skills, []);
});

test('falls back to the structured data when the About section is missing', () => {
  const d = parsePublicProfileHtml(PAGE.replace(/<section[^]*?data-section="summary"[^]*?<\/section>/, ''));
  assert.equal(d.summary, 'Fallback about.');
});

test('only LinkedIn profile URLs are read, in one canonical form', () => {
  assert.equal(canonicalProfileUrl('linkedin.com/in/jane-doe'), 'https://www.linkedin.com/in/jane-doe/');
  assert.equal(canonicalProfileUrl('https://uk.linkedin.com/in/jane-doe/details/experience'), 'https://www.linkedin.com/in/jane-doe/');
  assert.equal(canonicalProfileUrl('https://www.linkedin.com/company/acme'), '');
  assert.equal(canonicalProfileUrl('https://evil.example/in/linkedin.com/in/x'), '');
});

test('dates come out as YYYY-MM or YYYY', () => {
  assert.equal(toDate('Jan 2020'), '2020-01');
  assert.equal(toDate('September 2021'), '2021-09');
  assert.equal(toDate('2018'), '2018');
  assert.equal(toDate('Present'), '');
});
