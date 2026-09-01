/**
 * coachMarket — how many real jobs actually exist for a target role.
 *
 * The coach tells people how hard their target will be to reach. A model
 * asked that question on its own produces a confident guess, and people
 * eventually notice it is a guess. We already hold the answer: the harvested
 * job corpus. Counting it is one query, and it turns "that's competitive"
 * into "there are 34 of these live right now, 6 near you".
 *
 * Ghost postings are excluded on the same threshold the job feed uses, so the
 * number the coach quotes matches what the candidate will see when they go
 * looking. See services/ghostJobDetector.js — postings are scored and demoted,
 * never deleted, so this has to filter at read time.
 */

const { Op, fn, col, where: sqlWhere, literal } = require('sequelize');
const { ExternalJob } = require('../models');
const { GHOST_THRESHOLD } = require('./ghostJobDetector');

// Titles are noisy across boards ("Sr. Frontend Engineer (Remote)"), so match
// on the distinctive words. Seniority and job-board furniture carry no signal
// about WHAT the job is, so they are dropped.
const STOPWORDS = new Set([
  'senior', 'junior', 'lead', 'staff', 'principal', 'head', 'chief', 'sr', 'jr',
  'the', 'and', 'of', 'for', 'a', 'an', 'i', 'ii', 'iii',
  'remote', 'hybrid', 'onsite', 'contract', 'fulltime', 'full', 'time', 'part',
]);

// Role nouns. These are NOT stopwords — "Product Manager" without "manager"
// matches every posting with "product" anywhere in the title, which is how a
// count becomes a number that means nothing. They are only too weak to match
// on ALONE: a bare "Manager" describes half the corpus.
const GENERIC_ROLE_NOUNS = new Set([
  'engineer', 'manager', 'specialist', 'analyst', 'associate', 'consultant',
  'coordinator', 'director', 'developer', 'designer', 'administrator',
  'assistant', 'officer', 'executive', 'representative', 'technician',
]);

/**
 * Pull the words worth matching a title on. Keeps the domain nouns
 * ("frontend", "logistics", "payroll") and drops seniority and job-board
 * furniture, which is what makes a title match too broad to mean anything.
 */
function titleTerms(title) {
  const words = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  // A lone role noun ("Manager", "Engineer") is not something we can count
  // honestly, so we decline to. Returning it would produce a huge number
  // presented as if it meant something about their target.
  if (words.length === 1 && GENERIC_ROLE_NOUNS.has(words[0])) return [];

  return words.slice(0, 3);
}

/**
 * countOpenings — live, non-ghost postings matching a target title.
 *
 * @param {object} p
 * @param {string} p.title     the candidate's target role
 * @param {string} [p.location] free-text location, matched loosely
 * @returns {Promise<{total: number|null, nearby: number|null, terms: string[], samples: string[]}>}
 *          Nulls mean "not measured", never "zero". `total` is null when the
 *          title had no distinctive word to match on ("Manager"), and `nearby`
 *          is null when no location was given. The coach must not turn either
 *          into "there is nothing out there" — that would be a discouraging
 *          claim invented out of missing data.
 */
async function countOpenings({ title, location } = {}) {
  const terms = titleTerms(title);
  if (!terms.length) return { total: null, nearby: null, terms: [], samples: [] };

  const live = [
    { isActive: true },
    literal(`COALESCE("ExternalJob"."ghostScore", 0) < ${GHOST_THRESHOLD}`),
  ];
  // Every distinctive word must appear somewhere in the title. Two terms is a
  // narrow enough net that the number means something.
  const titleMatch = terms.map((term) => sqlWhere(fn('LOWER', col('title')), { [Op.like]: `%${term}%` }));

  const total = await ExternalJob.count({ where: { [Op.and]: [...live, ...titleMatch] } });

  let nearby = null;
  const place = String(location || '').trim();
  if (place) {
    // Match on the city, not the whole "Berlin, Germany" string — boards
    // spell the country half a dozen ways.
    const city = place.split(',')[0].trim().toLowerCase();
    nearby = await ExternalJob.count({
      where: {
        [Op.and]: [
          ...live,
          ...titleMatch,
          {
            [Op.or]: [
              sqlWhere(fn('LOWER', col('location')), { [Op.like]: `%${city}%` }),
              { locationType: 'remote' },
            ],
          },
        ],
      },
    });
  }

  const samples = await ExternalJob.findAll({
    where: { [Op.and]: [...live, ...titleMatch] },
    attributes: ['title', 'company', 'location'],
    order: [['effectivePostedAt', 'DESC']],
    limit: 3,
  });

  return {
    total,
    nearby,
    terms,
    samples: samples.map((j) => [j.title, j.company].filter(Boolean).join(' · ')),
  };
}

module.exports = { countOpenings, titleTerms, STOPWORDS, GENERIC_ROLE_NOUNS };
