/**
 * resumePdf · render a tailored resume into a PDF buffer.
 *
 * The candidate's full resume lives on the Profile row (skills,
 * experience, education, etc.). `tailoredResume` from prepareApplication
 * is a *diff* on top of that — new summary, new bullets per experience
 * entry, added skills. This module merges the two and renders a
 * single-page PDF via pdfkit (already a dependency).
 *
 * Exports:
 *   renderResumePdf(app) → { buffer, fileName }
 *   uploadResumePdf(buffer, fileName) → Cloudinary secure URL
 *   buildAndUpload(app) → { buffer, url }   ← the common path
 */
const PDFDocument = require('pdfkit');
const streamifier = require('streamifier');
const { cloudinary } = require('../config/cloudinary');
const { User, Profile } = require('../models');

// ---------- HTML→plain-text helper ----------
// The tailored resume sprinkles <b>...</b> tags around JD-aligned
// phrases. pdfkit doesn't do inline HTML, so we strip tags for Phase 1.
// Bold highlighting can come back later with a custom text iterator.
function stripTags(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Best-effort merge of the experience section: for each original
 * experience entry, find a matching diff by section header and swap in
 * the rewritten bullets. Anything in `added` is appended as new entries
 * ("NEW · ...").
 */
function mergeExperience(base = [], diff = [], added = []) {
  const diffBySection = new Map();
  for (const d of diff) {
    if (d?.section) diffBySection.set(String(d.section).toLowerCase(), d);
  }
  const merged = (base || []).map((exp) => {
    const header = [exp.company, exp.title, exp.position]
      .filter(Boolean)
      .join(' · ')
      .toLowerCase();
    const hit = [...diffBySection.entries()].find(([k]) =>
      header.includes(k) || k.includes(header)
    );
    if (!hit) return exp;
    return { ...exp, _tailoredDescription: stripTags(hit[1].new) };
  });
  for (const line of added || []) {
    merged.push({ _added: true, title: stripTags(line) });
  }
  return merged;
}

function mergeSkills(base = {}, newSkills = []) {
  // base is { [category]: [{ name, level }] } or sometimes just a flat
  // object / array. We flatten for output, dedupe, and append newSkills
  // (which arrive as "+ graphql").
  const flat = new Set();
  const walk = (v) => {
    if (!v) return;
    if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (typeof v === 'object') {
      if (v.name) flat.add(String(v.name));
      else Object.values(v).forEach(walk);
    } else if (typeof v === 'string') {
      flat.add(v);
    }
  };
  walk(base);
  for (const s of newSkills || []) {
    flat.add(String(s).replace(/^\+\s*/, '').trim());
  }
  return [...flat].filter(Boolean);
}

async function loadCandidate(userId) {
  const [user, profile] = await Promise.all([
    User.findByPk(userId, { attributes: ['id', 'firstName', 'lastName', 'email'] }),
    Profile.findOne({ where: { userId } }),
  ]);
  return { user, profile };
}

function safeName(user) {
  const raw = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return raw || user?.email?.split('@')[0] || 'Candidate';
}

// ---------- the actual pdfkit layout ----------
function renderPdfBuffer({ fullName, headline, contacts, summary, experience, skills, education }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 48, left: 56, right: 56, bottom: 48 },
      info: { Title: `${fullName} — Resume` },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ---- Header ----
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#111').text(fullName);
    if (headline) {
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(11).fillColor('#444').text(headline);
    }
    if (contacts?.length) {
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(9).fillColor('#666').text(contacts.join('  ·  '));
    }

    // thin rule
    doc.moveDown(0.6);
    const y = doc.y;
    doc.strokeColor('#DDD').lineWidth(0.8).moveTo(56, y).lineTo(556, y).stroke();
    doc.moveDown(0.6);

    const section = (title) => {
      doc.moveDown(0.6);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111').text(title.toUpperCase(), { characterSpacing: 1 });
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(10).fillColor('#222');
    };

    // ---- Summary ----
    if (summary) {
      section('Summary');
      doc.text(summary, { align: 'left' });
    }

    // ---- Experience ----
    if (experience?.length) {
      section('Experience');
      for (const exp of experience) {
        doc.moveDown(0.3);
        if (exp._added) {
          doc.font('Helvetica-Oblique').fontSize(10).fillColor('#5A3BD6').text(`NEW · ${exp.title}`);
          continue;
        }
        const line = [exp.title || exp.position, exp.company].filter(Boolean).join(' · ');
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text(line || 'Role');
        const dates = [exp.startDate, exp.endDate || (exp.current ? 'Present' : '')]
          .filter(Boolean).join(' — ');
        if (dates) {
          doc.font('Helvetica-Oblique').fontSize(9).fillColor('#666').text(dates);
        }
        const body = exp._tailoredDescription || stripTags(exp.description || '');
        if (body) {
          doc.font('Helvetica').fontSize(10).fillColor('#222').text(body, {
            align: 'left',
          });
        }
      }
    }

    // ---- Skills ----
    if (skills?.length) {
      section('Skills');
      doc.text(skills.join(', '), { align: 'left' });
    }

    // ---- Education ----
    if (education?.length) {
      section('Education');
      for (const ed of education) {
        doc.moveDown(0.2);
        const line = [ed.degree, ed.school || ed.institution].filter(Boolean).join(', ');
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#111').text(line || 'Education');
        const dates = [ed.startDate, ed.endDate].filter(Boolean).join(' — ');
        if (dates) doc.font('Helvetica-Oblique').fontSize(9).fillColor('#666').text(dates);
        if (ed.description) {
          doc.font('Helvetica').fontSize(10).fillColor('#222').text(stripTags(ed.description));
        }
      }
    }

    doc.end();
  });
}

/**
 * Build the PDF buffer for an ApplyPilotApplication row. Does NOT save
 * anything — returns { buffer, fileName } so the caller can decide
 * what to do (upload to Cloudinary, attach to multipart body, etc.).
 */
async function renderResumePdf(app) {
  const { user, profile } = await loadCandidate(app.userId);
  if (!profile) {
    throw new Error(`resumePdf: no Profile row for user ${app.userId}`);
  }

  const tailored = app.tailoredResume || {};
  const rich = tailored.rich || null;   // new path: shared tailor pipeline output

  const fullName = safeName(user);

  // Prefer the rich shape when present — it's the full rewritten resume,
  // not just a diff. Fall back to the legacy diff shape for applications
  // prepared before the refactor.
  const headline = rich?.title
    || stripTags(tailored.summaryNew?.split('.')?.[0])
    || profile.headline
    || profile.title
    || '';
  const summary = rich?.summary
    || stripTags(tailored.summaryNew)
    || stripTags(profile.summary)
    || '';
  const experience = rich?.experience?.length
    ? rich.experience.map((e) => ({ ...e, _tailoredDescription: stripTags(e.description) }))
    : mergeExperience(profile.experience, tailored.experienceDiff, tailored.added);
  const skills = rich?.skills?.length
    ? rich.skills
    : mergeSkills(profile.skills, tailored.newSkills);
  const education = rich?.education?.length ? rich.education : (profile.education || []);

  const contacts = [
    user?.email,
    profile.phone,
    profile.location,
    profile.linkedinUrl,
    profile.portfolioUrl,
  ].filter(Boolean);

  const buffer = await renderPdfBuffer({
    fullName, headline, contacts, summary, experience, skills, education,
  });

  const safeSlug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const fileName = `${safeSlug || 'resume'}-${(app.company || 'role').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;

  return { buffer, fileName };
}

/**
 * Upload a PDF buffer to Cloudinary as a raw resource. Returns the
 * secure_url. Stored under profileai/applypilot-resumes/{userId}/.
 */
async function uploadResumePdf(buffer, { userId, fileName }) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    // No Cloudinary credentials → skip upload, caller will still have
    // the raw buffer to send to the ATS.
    return null;
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `profileai/applypilot-resumes/${userId}`,
        public_id: fileName.replace(/\.pdf$/, ''),
        resource_type: 'raw',
        format: 'pdf',
        overwrite: true,
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result?.secure_url || null);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

/**
 * Convenience: render + upload in one call. Worker uses this.
 */
async function buildAndUpload(app) {
  const { buffer, fileName } = await renderResumePdf(app);
  let url = null;
  try {
    url = await uploadResumePdf(buffer, { userId: app.userId, fileName });
  } catch (err) {
    console.warn('[resumePdf] Cloudinary upload failed, continuing with buffer only:', err?.message);
  }
  return { buffer, fileName, url };
}

module.exports = { renderResumePdf, uploadResumePdf, buildAndUpload };
