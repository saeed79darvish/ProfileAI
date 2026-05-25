const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, ShadingType } = require('docx');

// Template configurations
const templates = {
  professional: {
    name: 'Classic',
    description: 'Traditional, ATS-friendly',
    colors: { primary: '#2C3E50', secondary: '#2563eb', text: '#000000', light: '#ECF0F1' },
    font: 'Helvetica'
  },
  modern: {
    name: 'Modern',
    description: 'Two-column with sidebar',
    colors: { primary: '#1A1A2E', secondary: '#10b981', text: '#000000', light: '#F5F5F5' },
    font: 'Helvetica'
  },
  creative: {
    name: 'Creative',
    description: 'Vibrant and unique for creative industries',
    colors: { primary: '#6C5CE7', secondary: '#00CEC9', text: '#2D3436', light: '#DFE6E9' },
    font: 'Helvetica'
  },
  minimal: {
    name: 'Minimal',
    description: 'Clean editorial style',
    colors: { primary: '#000000', secondary: '#555555', text: '#000000', light: '#FAFAFA' },
    font: 'Helvetica'
  },
  centered: {
    name: 'Centered',
    description: 'Centered header with categorized skills',
    colors: { primary: '#000000', secondary: '#000000', text: '#000000', light: '#F5F5F5' },
    font: 'Helvetica'
  },
  executive: {
    name: 'Executive',
    description: 'Sophisticated design for senior positions',
    colors: { primary: '#1B4332', secondary: '#40916C', text: '#333333', light: '#D8F3DC' },
    font: 'Helvetica'
  },
  tech: {
    name: 'Tech',
    description: 'Modern tech-focused design for IT professionals',
    colors: { primary: '#0F0F0F', secondary: '#00D4FF', text: '#333333', light: '#1A1A2E' },
    font: 'Courier'
  }
};

// Helper to convert hex to RGB
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

// Helper: parse description into bullet lines
const parseBulletLines = (text) => {
  if (!text) return [];
  let lines = text.split(/\n/).map(l => l.replace(/^[\s•\-\*]+/, '').trim()).filter(Boolean);
  if (lines.length === 1 && lines[0].length > 150) {
    const sentences = lines[0].split(/\.\s+/).filter(Boolean);
    if (sentences.length > 1) lines = sentences.map(s => s.endsWith('.') ? s : s + '.');
  }
  return lines;
};

// Helper: get flat skills array
const getFlatSkills = (skills) => {
  if (!skills) return [];
  if (Array.isArray(skills)) {
    return skills.filter(s => typeof s === 'string' ? s : s?.name).map(s => typeof s === 'string' ? s : s.name);
  }
  if (typeof skills === 'object') {
    return Object.values(skills).flat().map(s => typeof s === 'string' ? s : s?.name || '').filter(Boolean);
  }
  return [];
};

// Helper: get categorized skills (if available)
const getCategorizedSkills = (skills) => {
  if (!skills || Array.isArray(skills)) return null;
  if (typeof skills === 'object') return skills;
  return null;
};

// ─────────────────────────────────────────────────────────────────
// CLASSIC TEMPLATE — Traditional single-column, ATS-friendly
// ─────────────────────────────────────────────────────────────────
const generateClassicPDF = (profile, user, bulletStyle) => {
  const pageMargin = 50;
  const contentWidth = 595.28 - (pageMargin * 2);
  const bulletIndent = 12;
  const bulletContentWidth = contentWidth - bulletIndent;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: pageMargin, size: 'A4', autoFirstPage: true });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let currentY = pageMargin;
      doc.on('pageAdded', () => { currentY = pageMargin; });
      const pageBottom = 841.89 - pageMargin - 10;

      const ensureSpace = (needed) => {
        if (currentY > pageMargin + 5 && currentY + needed > pageBottom) doc.addPage();
      };

      const sectionHeader = (title) => {
        ensureSpace(30);
        doc.fontSize(11.5).fillColor('#000000').font('Helvetica-Bold')
           .text(title, pageMargin, currentY);
        currentY = doc.y + 2;
        doc.moveTo(pageMargin, currentY).lineTo(pageMargin + contentWidth, currentY)
           .strokeColor('#2563eb').lineWidth(1.2).stroke();
        currentY += 8;
      };

      const renderBullets = (text) => {
        const lines = parseBulletLines(text);
        if (bulletStyle === 'none') {
          const paragraph = lines.join(' ');
          if (paragraph) {
            doc.fontSize(9.5).font('Helvetica');
            const h = doc.heightOfString(paragraph, { width: contentWidth, lineGap: 1.5 });
            ensureSpace(h + 4);
            doc.fontSize(9.5).font('Helvetica').fillColor('#000000')
               .text(paragraph, pageMargin, currentY, { width: contentWidth, lineGap: 1.5 });
            currentY = doc.y + 2;
          }
        } else {
          lines.forEach(line => {
            doc.fontSize(9.5).font('Helvetica');
            const h = doc.heightOfString(line, { width: bulletContentWidth, lineGap: 1 });
            ensureSpace(h + 4);
            doc.fontSize(9.5).font('Helvetica').fillColor('#000000').text('•', pageMargin, currentY);
            doc.fontSize(9.5).font('Helvetica').fillColor('#000000')
               .text(line, pageMargin + bulletIndent, currentY, { width: bulletContentWidth, lineGap: 1 });
            currentY = doc.y + 2;
          });
        }
      };

      // NAME
      const fullName = profile.fullName || profile.name || `${user.firstName} ${user.lastName}`;
      doc.fontSize(24).fillColor('#000000').font('Helvetica-Bold')
         .text(fullName, pageMargin, currentY, { width: contentWidth });
      currentY = doc.y + 2;

      // CONTACT
      const email = profile.email || user.email;
      const contactParts = [];
      if (email) contactParts.push(email);
      if (profile.phone) contactParts.push(profile.phone);
      if (profile.location) contactParts.push(profile.location);
      if (profile.linkedinUrl) contactParts.push(profile.linkedinUrl);
      if (profile.githubUrl) contactParts.push(profile.githubUrl);
      if (profile.portfolioUrl) contactParts.push(profile.portfolioUrl);
      if (contactParts.length > 0) {
        doc.fontSize(9).fillColor('#444444').font('Helvetica')
           .text(contactParts.join('  |  '), pageMargin, currentY, { width: contentWidth });
        currentY = doc.y + 12;
      }

      // SUMMARY
      if (profile.summary) {
        sectionHeader('SUMMARY');
        doc.fontSize(9.5).fillColor('#000000').font('Helvetica');
        ensureSpace(doc.heightOfString(profile.summary, { width: contentWidth, lineGap: 1.5 }) + 10);
        doc.text(profile.summary, pageMargin, currentY, { width: contentWidth, lineGap: 1.5 });
        currentY = doc.y + 10;
      }

      // SKILLS
      const flatSkills = getFlatSkills(profile.skills);
      const catSkills = getCategorizedSkills(profile.skills);
      if (catSkills || flatSkills.length > 0) {
        sectionHeader('SKILLS');
        if (catSkills) {
          Object.entries(catSkills).forEach(([cat, items]) => {
            const list = (Array.isArray(items) ? items : []).map(s => typeof s === 'string' ? s : s?.name || '').filter(Boolean);
            if (!list.length) return;
            ensureSpace(16);
            doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#000000')
               .text(`${cat}: `, pageMargin, currentY, { continued: true }).font('Helvetica').text(list.join(', '), { width: contentWidth });
            currentY = doc.y + 2;
          });
        } else {
          const txt = flatSkills.join(', ');
          doc.fontSize(9.5).fillColor('#000000').font('Helvetica');
          ensureSpace(doc.heightOfString(txt, { width: contentWidth, lineGap: 1.5 }) + 8);
          doc.text(txt, pageMargin, currentY, { width: contentWidth, lineGap: 1.5 });
          currentY = doc.y + 4;
        }
        currentY += 6;
      }

      // EXPERIENCE
      (profile.experience || []).forEach((exp, i) => {
        if (i === 0) sectionHeader('EXPERIENCE');
        const company = exp.company || '';
        const title = exp.title || '';
        const period = exp.period || exp.startDate || '';
        let eh = 18;
        if (exp.description) { doc.fontSize(9.5).font('Helvetica'); eh += doc.heightOfString(exp.description, { width: bulletContentWidth, lineGap: 1 }) + 8; }
        ensureSpace(Math.min(eh, 80));
        const tc = company ? `${title}  •  ${company}` : title;
        if (period) {
          doc.fontSize(9).font('Helvetica');
          const pw = doc.widthOfString(period);
          doc.fontSize(10.5).fillColor('#000000').font('Helvetica-Bold').text(tc, pageMargin, currentY, { width: contentWidth - pw - 10 });
          const ty = doc.y;
          doc.fontSize(9).fillColor('#555555').font('Helvetica').text(period, pageMargin + contentWidth - pw, currentY, { width: pw, align: 'right' });
          currentY = Math.max(ty, doc.y) + 2;
        } else {
          doc.fontSize(10.5).fillColor('#000000').font('Helvetica-Bold').text(tc, pageMargin, currentY, { width: contentWidth });
          currentY = doc.y + 2;
        }
        renderBullets(exp.description);
        currentY += 4;
      });
      if ((profile.experience || []).length > 0) currentY += 2;

      // PROJECTS
      (profile.projects || []).forEach((project, i) => {
        if (i === 0) sectionHeader('PROJECTS');
        const name = project.title || project.name || 'Project';
        const techs = project.technologies || [];
        let ph = 18;
        if (project.description) { doc.fontSize(9.5).font('Helvetica'); ph += doc.heightOfString(project.description, { width: bulletContentWidth, lineGap: 1 }) + 6; }
        ensureSpace(Math.min(ph, 60));
        if (techs.length > 0) {
          doc.fontSize(10.5).fillColor('#000000').font('Helvetica-Bold').text(`${name}  `, pageMargin, currentY, { continued: true })
             .font('Helvetica').fillColor('#666666').fontSize(9.5).text(`—  ${techs.join(', ')}`, { width: contentWidth });
        } else {
          doc.fontSize(10.5).fillColor('#000000').font('Helvetica-Bold').text(name, pageMargin, currentY, { width: contentWidth });
        }
        currentY = doc.y + 1;
        renderBullets(project.description);
        currentY += 4;
      });

      // EDUCATION
      (profile.education || []).forEach((edu, i) => {
        if (i === 0) sectionHeader('EDUCATION');
        ensureSpace(30);
        const school = edu.school || edu.institution || '';
        const degree = edu.degree || '';
        const field = edu.field || '';
        const year = edu.year || edu.graduationYear || '';
        if (year) {
          doc.fontSize(9).font('Helvetica');
          const yw = doc.widthOfString(String(year));
          doc.fontSize(10.5).fillColor('#000000').font('Helvetica-Bold').text(school, pageMargin, currentY, { width: contentWidth - yw - 10 });
          const sy = doc.y;
          doc.fontSize(9).fillColor('#555555').font('Helvetica').text(String(year), pageMargin + contentWidth - yw, currentY, { width: yw, align: 'right' });
          currentY = Math.max(sy, doc.y);
        } else {
          doc.fontSize(10.5).fillColor('#000000').font('Helvetica-Bold').text(school, pageMargin, currentY, { width: contentWidth });
          currentY = doc.y;
        }
        const dl = field ? `${degree} — ${field}` : degree;
        if (dl) {
          doc.fontSize(9.5).font('Helvetica').fillColor('#666666').text(dl, pageMargin, currentY, { width: contentWidth });
          currentY = doc.y + 6;
        }
      });

      doc.end();
    } catch (error) { reject(error); }
  });
};

// ─────────────────────────────────────────────────────────────────
// MODERN TEMPLATE — Two-column with colored sidebar
// ─────────────────────────────────────────────────────────────────
const generateModernPDF = (profile, user, accentColor = '#10b981', bulletStyle) => {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const sidebarWidth = 185;
  const rightMargin = 40;
  const rightX = sidebarWidth + 28;
  const rightContentWidth = pageWidth - rightX - rightMargin;
  const sidebarPadding = 22;
  const sidebarContentWidth = sidebarWidth - sidebarPadding * 2;

  const accent = hexToRgb(accentColor);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: 'A4', autoFirstPage: true });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let sideY = 0;
      let mainY = 40;
      let pageNum = 1;

      const drawSidebarBg = () => {
        doc.rect(0, 0, sidebarWidth, pageHeight).fill(accentColor);
      };

      const ensureSpaceMain = (needed) => {
        if (mainY > 50 && mainY + needed > pageHeight - 40) {
          doc.addPage();
          pageNum++;
          drawSidebarBg();
          sideY = 40;
          mainY = 40;
        }
      };

      // ─── PAGE 1 SIDEBAR BACKGROUND ───
      drawSidebarBg();

      // ─── SIDEBAR: Initials Circle ───
      sideY = 50;
      const initials = `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase();
      const circleR = 32;
      doc.fillOpacity(0.2);
      doc.circle(sidebarWidth / 2, sideY + circleR, circleR)
         .fill('#ffffff');
      doc.fillOpacity(1);
      doc.fontSize(20).fillColor('#ffffff').font('Helvetica-Bold')
         .text(initials, sidebarPadding, sideY + circleR - 10, { width: sidebarContentWidth, align: 'center' });
      sideY += circleR * 2 + 24;

      // ─── SIDEBAR: Contact ───
      const sideSection = (title) => {
        doc.fillOpacity(0.6);
        doc.fontSize(8).fillColor('#ffffff').font('Helvetica-Bold')
           .text(title.toUpperCase(), sidebarPadding, sideY, { width: sidebarContentWidth });
        doc.fillOpacity(1);
        sideY = doc.y + 6;
      };

      sideSection('CONTACT');
      const email = profile.email || user.email;
      const contactItems = [];
      if (email) contactItems.push(email);
      if (profile.phone) contactItems.push(profile.phone);
      if (profile.location) contactItems.push(profile.location);
      if (profile.linkedinUrl) contactItems.push(profile.linkedinUrl);
      if (profile.githubUrl) contactItems.push(profile.githubUrl);
      contactItems.forEach(item => {
        doc.fontSize(8.5).fillColor('#ffffff').font('Helvetica')
           .text(item, sidebarPadding, sideY, { width: sidebarContentWidth });
        sideY = doc.y + 4;
      });
      sideY += 12;

      // ─── SIDEBAR: Skills ───
      const flatSkills = getFlatSkills(profile.skills);
      if (flatSkills.length > 0) {
        sideSection('SKILLS');
        // Estimate space needed for education below
        const eduCount = (profile.education || []).length;
        const eduSpace = eduCount > 0 ? 30 + eduCount * 50 : 0;
        const maxSkillY = pageHeight - 50 - eduSpace;
        // Render as small badge-like items
        flatSkills.forEach(skill => {
          if (sideY > maxSkillY) return;
          const tw = doc.fontSize(7.5).font('Helvetica').widthOfString(skill);
          const badgeW = Math.min(tw + 12, sidebarContentWidth);
          const badgeH = 16;
          // badge background
          doc.fillOpacity(0.15);
          doc.roundedRect(sidebarPadding, sideY, badgeW, badgeH, 4)
             .fill('#ffffff');
          doc.fillOpacity(1);
          doc.fontSize(7.5).fillColor('#ffffff').font('Helvetica')
             .text(skill, sidebarPadding + 6, sideY + 3, { width: badgeW - 12 });
          sideY += badgeH + 4;
        });
        sideY += 8;
      }

      // ─── SIDEBAR: Education ───
      const education = profile.education || [];
      if (education.length > 0) {
        sideSection('EDUCATION');
        education.forEach(edu => {
          if (sideY > pageHeight - 60) return;
          const school = edu.school || edu.institution || '';
          const degree = edu.degree || '';
          const field = edu.field || '';
          const year = edu.year || edu.graduationYear || '';
          if (school) {
            doc.fontSize(8.5).fillColor('#ffffff').font('Helvetica-Bold')
               .text(school, sidebarPadding, sideY, { width: sidebarContentWidth });
            sideY = doc.y + 1;
          }
          const dl = field ? `${degree}, ${field}` : degree;
          if (dl) {
            doc.fillOpacity(0.8);
            doc.fontSize(7.5).fillColor('#ffffff').font('Helvetica')
               .text(dl, sidebarPadding, sideY, { width: sidebarContentWidth });
            doc.fillOpacity(1);
            sideY = doc.y + 1;
          }
          if (year) {
            doc.fillOpacity(0.6);
            doc.fontSize(7.5).fillColor('#ffffff').font('Helvetica')
               .text(String(year), sidebarPadding, sideY, { width: sidebarContentWidth });
            doc.fillOpacity(1);
            sideY = doc.y + 1;
          }
          sideY += 8;
        });
      }

      // ─── MAIN CONTENT (right side) ───
      // Name
      const fullName = profile.fullName || profile.name || `${user.firstName} ${user.lastName}`;
      doc.fontSize(22).fillColor('#111111').font('Helvetica-Bold')
         .text(fullName, rightX, mainY, { width: rightContentWidth });
      mainY = doc.y + 1;

      // Title
      if (profile.title) {
        doc.fontSize(11).fillColor(accentColor).font('Helvetica')
           .text(profile.title, rightX, mainY, { width: rightContentWidth });
        mainY = doc.y + 12;
      } else {
        mainY += 10;
      }

      // Summary
      if (profile.summary) {
        // Summary box with subtle background
        doc.fontSize(9.5).font('Helvetica');
        const sH = doc.heightOfString(profile.summary, { width: rightContentWidth - 20, lineGap: 1.5 });
        ensureSpaceMain(sH + 20);
        doc.roundedRect(rightX, mainY, rightContentWidth, sH + 16, 6)
           .fill('#f8fafb');
        doc.fontSize(9.5).fillColor('#222222').font('Helvetica')
           .text(profile.summary, rightX + 10, mainY + 8, { width: rightContentWidth - 20, lineGap: 1.5 });
        mainY = doc.y + 16;
      }

      // Right-side section header
      const mainSection = (title) => {
        ensureSpaceMain(28);
        doc.fontSize(10).fillColor(accentColor).font('Helvetica-Bold')
           .text(title.toUpperCase(), rightX, mainY, { width: rightContentWidth });
        mainY = doc.y + 2;
        doc.moveTo(rightX, mainY).lineTo(rightX + rightContentWidth, mainY)
           .strokeColor(accentColor).lineWidth(0.8).stroke();
        mainY += 8;
      };

      // Experience
      const experiences = profile.experience || [];
      if (experiences.length > 0) {
        mainSection('EXPERIENCE');
        experiences.forEach(exp => {
          const title = exp.title || '';
          const company = exp.company || '';
          const period = exp.period || exp.startDate || '';
          const tc = company ? `${title}  •  ${company}` : title;

          doc.fontSize(9.5).font('Helvetica');
          let eh = 16 + (exp.description ? doc.heightOfString(exp.description, { width: rightContentWidth - 12, lineGap: 1 }) : 0);
          ensureSpaceMain(Math.min(eh, 80));

          if (period) {
            doc.fontSize(9).font('Helvetica');
            const pw = doc.widthOfString(period);
            doc.fontSize(10).fillColor('#111111').font('Helvetica-Bold')
               .text(tc, rightX, mainY, { width: rightContentWidth - pw - 10 });
            const ty = doc.y;
            doc.fontSize(8.5).fillColor('#888888').font('Helvetica')
               .text(period, rightX + rightContentWidth - pw, mainY, { width: pw, align: 'right' });
            mainY = Math.max(ty, doc.y) + 2;
          } else {
            doc.fontSize(10).fillColor('#111111').font('Helvetica-Bold')
               .text(tc, rightX, mainY, { width: rightContentWidth });
            mainY = doc.y + 2;
          }

          // Bullets
          if (bulletStyle === 'none') {
            const paragraph = parseBulletLines(exp.description).join(' ');
            if (paragraph) {
              doc.fontSize(9).font('Helvetica');
              const lh = doc.heightOfString(paragraph, { width: rightContentWidth, lineGap: 1.5 });
              ensureSpaceMain(lh + 4);
              doc.fontSize(9).font('Helvetica').fillColor('#333333')
                 .text(paragraph, rightX, mainY, { width: rightContentWidth, lineGap: 1.5 });
              mainY = doc.y + 2;
            }
          } else {
            parseBulletLines(exp.description).forEach(line => {
              doc.fontSize(9).font('Helvetica');
              const lh = doc.heightOfString(line, { width: rightContentWidth - 12, lineGap: 1 });
              ensureSpaceMain(lh + 4);
              doc.fontSize(9).font('Helvetica').fillColor('#333333').text('•', rightX, mainY);
              doc.fontSize(9).font('Helvetica').fillColor('#333333')
                .text(line, rightX + 10, mainY, { width: rightContentWidth - 12, lineGap: 1 });
              mainY = doc.y + 2;
            });
          }
          mainY += 6;
        });
      }

      // Projects
      const projects = profile.projects || [];
      if (projects.length > 0) {
        mainSection('PROJECTS');
        projects.forEach(project => {
          const name = project.title || project.name || 'Project';
          const techs = project.technologies || [];
          ensureSpaceMain(30);
          if (techs.length > 0) {
            doc.fontSize(10).fillColor('#111111').font('Helvetica-Bold')
               .text(`${name}  `, rightX, mainY, { continued: true })
               .font('Helvetica').fillColor('#888888').fontSize(8.5)
               .text(`—  ${techs.join(', ')}`, { width: rightContentWidth });
          } else {
            doc.fontSize(10).fillColor('#111111').font('Helvetica-Bold')
               .text(name, rightX, mainY, { width: rightContentWidth });
          }
          mainY = doc.y + 1;
          if (bulletStyle === 'none') {
            const paragraph = parseBulletLines(project.description).join(' ');
            if (paragraph) {
              doc.fontSize(9).font('Helvetica');
              const lh = doc.heightOfString(paragraph, { width: rightContentWidth, lineGap: 1.5 });
              ensureSpaceMain(lh + 4);
              doc.fontSize(9).font('Helvetica').fillColor('#333333')
                 .text(paragraph, rightX, mainY, { width: rightContentWidth, lineGap: 1.5 });
              mainY = doc.y + 2;
            }
          } else {
            parseBulletLines(project.description).forEach(line => {
              doc.fontSize(9).font('Helvetica');
              const lh = doc.heightOfString(line, { width: rightContentWidth - 12, lineGap: 1 });
              ensureSpaceMain(lh + 4);
              doc.fontSize(9).font('Helvetica').fillColor('#333333').text('•', rightX, mainY);
              doc.fontSize(9).font('Helvetica').fillColor('#333333')
                 .text(line, rightX + 10, mainY, { width: rightContentWidth - 12, lineGap: 1 });
              mainY = doc.y + 2;
            });
          }
          mainY += 6;
        });
      }

      doc.end();
    } catch (error) { reject(error); }
  });
};

// ─────────────────────────────────────────────────────────────────
// MINIMAL TEMPLATE — Clean editorial style, centered header
// ─────────────────────────────────────────────────────────────────
const generateMinimalPDF = (profile, user, bulletStyle) => {
  const pageMargin = 60;
  const contentWidth = 595.28 - (pageMargin * 2);
  const bulletIndent = 14;
  const bulletContentWidth = contentWidth - bulletIndent;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: pageMargin, size: 'A4', autoFirstPage: true });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let currentY = pageMargin;
      doc.on('pageAdded', () => { currentY = pageMargin; });
      const pageBottom = 841.89 - pageMargin - 10;

      const ensureSpace = (needed) => {
        if (currentY > pageMargin + 5 && currentY + needed > pageBottom) doc.addPage();
      };

      // ─── NAME (centered, ALL CAPS, letter-spaced) ───
      const fullName = profile.fullName || profile.name || `${user.firstName} ${user.lastName}`;
      const spacedName = fullName.toUpperCase().split('').join(' ');
      doc.fontSize(20).fillColor('#111111').font('Helvetica-Bold')
         .text(spacedName, pageMargin, currentY, { width: contentWidth, align: 'center', characterSpacing: 2 });
      currentY = doc.y + 6;

      // ─── CONTACT (centered, subtle) ───
      const email = profile.email || user.email;
      const contactParts = [];
      if (email) contactParts.push(email);
      if (profile.phone) contactParts.push(profile.phone);
      if (profile.location) contactParts.push(profile.location);
      if (contactParts.length > 0) {
        doc.fontSize(9).fillColor('#777777').font('Helvetica')
           .text(contactParts.join('   ·   '), pageMargin, currentY, { width: contentWidth, align: 'center' });
        currentY = doc.y + 4;
      }

      // Links line
      const links = [];
      if (profile.linkedinUrl) links.push(profile.linkedinUrl);
      if (profile.githubUrl) links.push(profile.githubUrl);
      if (profile.portfolioUrl) links.push(profile.portfolioUrl);
      if (links.length > 0) {
        doc.fontSize(8).fillColor('#999999').font('Helvetica')
           .text(links.join('   ·   '), pageMargin, currentY, { width: contentWidth, align: 'center' });
        currentY = doc.y + 6;
      }

      // Thin line divider
      currentY += 4;
      doc.moveTo(pageMargin + contentWidth * 0.15, currentY)
         .lineTo(pageMargin + contentWidth * 0.85, currentY)
         .strokeColor('#dddddd').lineWidth(0.5).stroke();
      currentY += 16;

      // Section header (minimal style — thin uppercase with spacing)
      const sectionHeader = (title) => {
        ensureSpace(28);
        currentY += 4;
        doc.fontSize(9).fillColor('#333333').font('Helvetica-Bold')
           .text(title.toUpperCase(), pageMargin, currentY, { width: contentWidth, characterSpacing: 1.5 });
        currentY = doc.y + 2;
        doc.moveTo(pageMargin, currentY).lineTo(pageMargin + contentWidth, currentY)
           .strokeColor('#cccccc').lineWidth(0.4).stroke();
        currentY += 10;
      };

      // ─── PROFILE / SUMMARY ───
      if (profile.summary) {
        sectionHeader('PROFILE');
        doc.fontSize(9.5).fillColor('#222222').font('Helvetica')
           .text(profile.summary, pageMargin, currentY, { width: contentWidth, lineGap: 2 });
        currentY = doc.y + 12;
      }

      // ─── SKILLS (as bordered tag chips) ───
      const flatSkills = getFlatSkills(profile.skills);
      if (flatSkills.length > 0) {
        sectionHeader('SKILLS');
        // Render as inline tag chips
        let chipX = pageMargin;
        const chipH = 18;
        const chipGap = 6;
        const chipPadX = 10;
        flatSkills.forEach(skill => {
          doc.fontSize(8).font('Helvetica');
          const tw = doc.widthOfString(skill);
          const chipW = tw + chipPadX * 2;
          // Wrap to next line
          if (chipX + chipW > pageMargin + contentWidth) {
            chipX = pageMargin;
            currentY += chipH + chipGap;
            ensureSpace(chipH + chipGap);
          }
          // Border chip
          doc.roundedRect(chipX, currentY, chipW, chipH, 4)
             .strokeColor('#cccccc').lineWidth(0.6).stroke();
          doc.fontSize(8).fillColor('#333333').font('Helvetica')
             .text(skill, chipX + chipPadX, currentY + 4);
          chipX += chipW + chipGap;
        });
        currentY += chipH + 14;
      }

      // ─── EXPERIENCE ───
      const experiences = profile.experience || [];
      if (experiences.length > 0) {
        sectionHeader('EXPERIENCE');
        experiences.forEach(exp => {
          const title = exp.title || '';
          const company = exp.company || '';
          const period = exp.period || exp.startDate || '';

          doc.fontSize(9.5).font('Helvetica');
          let eh = 18 + (exp.description ? doc.heightOfString(exp.description, { width: bulletContentWidth, lineGap: 1 }) : 0);
          ensureSpace(Math.min(eh, 80));

          // Title — Company
          const tc = company ? `${title}  —  ${company}` : title;
          if (period) {
            doc.fontSize(9).font('Helvetica');
            const pw = doc.widthOfString(period);
            doc.fontSize(10).fillColor('#111111').font('Helvetica-Bold')
               .text(tc, pageMargin, currentY, { width: contentWidth - pw - 10 });
            const ty = doc.y;
            doc.fontSize(8.5).fillColor('#999999').font('Helvetica')
               .text(period, pageMargin + contentWidth - pw, currentY, { width: pw, align: 'right' });
            currentY = Math.max(ty, doc.y) + 2;
          } else {
            doc.fontSize(10).fillColor('#111111').font('Helvetica-Bold')
               .text(tc, pageMargin, currentY, { width: contentWidth });
            currentY = doc.y + 2;
          }

          // Open circle bullets
          if (bulletStyle === 'none') {
            const paragraph = parseBulletLines(exp.description).join(' ');
            if (paragraph) {
              doc.fontSize(9).font('Helvetica');
              const lh = doc.heightOfString(paragraph, { width: contentWidth, lineGap: 1.5 });
              ensureSpace(lh + 4);
              doc.fontSize(9).fillColor('#222222').font('Helvetica')
                 .text(paragraph, pageMargin, currentY, { width: contentWidth, lineGap: 1.5 });
              currentY = doc.y + 2;
            }
          } else {
            parseBulletLines(exp.description).forEach(line => {
              doc.fontSize(9).font('Helvetica');
              const lh = doc.heightOfString(line, { width: bulletContentWidth, lineGap: 1 });
              ensureSpace(lh + 4);
              // Dash bullet for Minimal
              doc.fontSize(9).fillColor('#999999').font('Helvetica').text('-', pageMargin + 1, currentY);
              doc.fontSize(9).fillColor('#222222').font('Helvetica')
                 .text(line, pageMargin + bulletIndent, currentY, { width: bulletContentWidth, lineGap: 1 });
              currentY = doc.y + 2;
            });
          }
          currentY += 6;
        });
      }

      // ─── PROJECTS ───
      const projects = profile.projects || [];
      if (projects.length > 0) {
        sectionHeader('PROJECTS');
        projects.forEach(project => {
          const name = project.title || project.name || 'Project';
          const techs = project.technologies || [];
          ensureSpace(30);
          if (techs.length > 0) {
            doc.fontSize(10).fillColor('#111111').font('Helvetica-Bold')
               .text(`${name}  `, pageMargin, currentY, { continued: true })
               .font('Helvetica').fillColor('#999999').fontSize(8.5)
               .text(`—  ${techs.join(', ')}`, { width: contentWidth });
          } else {
            doc.fontSize(10).fillColor('#111111').font('Helvetica-Bold')
               .text(name, pageMargin, currentY, { width: contentWidth });
          }
          currentY = doc.y + 1;
          if (bulletStyle === 'none') {
            const paragraph = parseBulletLines(project.description).join(' ');
            if (paragraph) {
              doc.fontSize(9).font('Helvetica');
              const lh = doc.heightOfString(paragraph, { width: contentWidth, lineGap: 1.5 });
              ensureSpace(lh + 4);
              doc.fontSize(9).fillColor('#222222').font('Helvetica')
                 .text(paragraph, pageMargin, currentY, { width: contentWidth, lineGap: 1.5 });
              currentY = doc.y + 2;
            }
          } else {
            parseBulletLines(project.description).forEach(line => {
              doc.fontSize(9).font('Helvetica');
              const lh = doc.heightOfString(line, { width: bulletContentWidth, lineGap: 1 });
              ensureSpace(lh + 4);
              doc.fontSize(9).fillColor('#999999').font('Helvetica').text('-', pageMargin + 1, currentY);
              doc.fontSize(9).fillColor('#222222').font('Helvetica')
                 .text(line, pageMargin + bulletIndent, currentY, { width: bulletContentWidth, lineGap: 1 });
              currentY = doc.y + 2;
            });
          }
          currentY += 6;
        });
      }

      // ─── EDUCATION ───
      const educ = profile.education || [];
      if (educ.length > 0) {
        sectionHeader('EDUCATION');
        educ.forEach(edu => {
          ensureSpace(28);
          const school = edu.school || edu.institution || '';
          const degree = edu.degree || '';
          const field = edu.field || '';
          const year = edu.year || edu.graduationYear || '';
          if (year) {
            doc.fontSize(9).font('Helvetica');
            const yw = doc.widthOfString(String(year));
            doc.fontSize(10).fillColor('#111111').font('Helvetica-Bold')
               .text(school, pageMargin, currentY, { width: contentWidth - yw - 10 });
            const sy = doc.y;
            doc.fontSize(8.5).fillColor('#999999').font('Helvetica')
               .text(String(year), pageMargin + contentWidth - yw, currentY, { width: yw, align: 'right' });
            currentY = Math.max(sy, doc.y);
          } else {
            doc.fontSize(10).fillColor('#111111').font('Helvetica-Bold')
               .text(school, pageMargin, currentY, { width: contentWidth });
            currentY = doc.y;
          }
          const dl = field ? `${degree}, ${field}` : degree;
          if (dl) {
            doc.fontSize(9).font('Helvetica').fillColor('#666666')
               .text(dl, pageMargin, currentY, { width: contentWidth });
            currentY = doc.y + 8;
          }
        });
      }

      doc.end();
    } catch (error) { reject(error); }
  });
};

// ─────────────────────────────────────────────────────────────────
// CENTERED TEMPLATE — Centered header, ATS-friendly, categorized
// skills as bulleted lines, italicized job titles.
// ─────────────────────────────────────────────────────────────────
const generateCenteredPDF = (profile, user, bulletStyle) => {
  const pageMargin = 54;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const contentWidth = pageWidth - pageMargin * 2;
  const bulletIndent = 14;
  const bulletContentWidth = contentWidth - bulletIndent;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: pageMargin, size: 'A4', autoFirstPage: true });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let currentY = pageMargin;
      doc.on('pageAdded', () => { currentY = pageMargin; });
      const pageBottom = pageHeight - pageMargin - 10;

      const ensureSpace = (needed) => {
        if (currentY > pageMargin + 5 && currentY + needed > pageBottom) doc.addPage();
      };

      const sectionHeader = (title) => {
        ensureSpace(28);
        doc.fontSize(11).fillColor('#000000').font('Helvetica-Bold')
           .text(title.toUpperCase(), pageMargin, currentY, { width: contentWidth });
        currentY = doc.y + 2;
        doc.moveTo(pageMargin, currentY).lineTo(pageMargin + contentWidth, currentY)
           .strokeColor('#000000').lineWidth(0.6).stroke();
        currentY += 6;
      };

      const renderParagraphOrBullets = (text) => {
        const lines = parseBulletLines(text);
        if (!lines.length) return;
        if (bulletStyle === 'none') {
          const paragraph = lines.join(' ');
          doc.fontSize(9.5).font('Helvetica');
          const h = doc.heightOfString(paragraph, { width: contentWidth, lineGap: 1.5 });
          ensureSpace(h + 4);
          doc.fontSize(9.5).font('Helvetica').fillColor('#000000')
             .text(paragraph, pageMargin, currentY, { width: contentWidth, lineGap: 1.5 });
          currentY = doc.y + 2;
        } else {
          lines.forEach(line => {
            doc.fontSize(9.5).font('Helvetica');
            const h = doc.heightOfString(line, { width: bulletContentWidth, lineGap: 1 });
            ensureSpace(h + 4);
            doc.fontSize(9.5).font('Helvetica').fillColor('#000000').text('•', pageMargin, currentY);
            doc.fontSize(9.5).font('Helvetica').fillColor('#000000')
               .text(line, pageMargin + bulletIndent, currentY, { width: bulletContentWidth, lineGap: 1 });
            currentY = doc.y + 2;
          });
        }
      };

      // ─── NAME (centered) ───
      const fullName = profile.fullName || profile.name || `${user.firstName} ${user.lastName}`;
      doc.fontSize(24).fillColor('#000000').font('Helvetica-Bold')
         .text(fullName, pageMargin, currentY, { width: contentWidth, align: 'center' });
      currentY = doc.y + 4;

      // ─── CONTACT LINE (centered, single line) ───
      const email = profile.email || user.email;
      const contactParts = [];
      if (profile.location) contactParts.push(profile.location);
      if (profile.phone) contactParts.push(profile.phone);
      if (email) contactParts.push(email);
      if (profile.linkedinUrl) contactParts.push('LinkedIn');
      if (profile.githubUrl) contactParts.push('GitHub');
      if (profile.portfolioUrl) contactParts.push('Portfolio');
      if (contactParts.length > 0) {
        doc.fontSize(9.5).fillColor('#000000').font('Helvetica')
           .text(contactParts.join('  |  '), pageMargin, currentY, { width: contentWidth, align: 'center' });
        currentY = doc.y + 10;
      }

      // ─── SUMMARY ───
      if (profile.summary) {
        sectionHeader('SUMMARY');
        doc.fontSize(9.5).fillColor('#000000').font('Helvetica');
        ensureSpace(doc.heightOfString(profile.summary, { width: contentWidth, lineGap: 1.5 }) + 8);
        doc.text(profile.summary, pageMargin, currentY, { width: contentWidth, lineGap: 1.5 });
        currentY = doc.y + 8;
      }

      // ─── SKILLS (categorized bullets) ───
      const flatSkills = getFlatSkills(profile.skills);
      const catSkills = getCategorizedSkills(profile.skills);
      if (catSkills || flatSkills.length > 0) {
        sectionHeader('SKILLS');
        if (catSkills) {
          Object.entries(catSkills).forEach(([cat, items]) => {
            const list = (Array.isArray(items) ? items : [])
              .map(s => typeof s === 'string' ? s : s?.name || '')
              .filter(Boolean);
            if (!list.length) return;
            doc.fontSize(9.5).font('Helvetica');
            const fullLine = `${cat}: ${list.join(', ')}`;
            const h = doc.heightOfString(fullLine, { width: bulletContentWidth, lineGap: 1 });
            ensureSpace(h + 4);
            // Bullet
            doc.fontSize(9.5).font('Helvetica').fillColor('#000000').text('•', pageMargin, currentY);
            // Category (bold) + items (regular) on same line, wrapping
            doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#000000')
               .text(`${cat}: `, pageMargin + bulletIndent, currentY, {
                 width: bulletContentWidth,
                 continued: true,
                 lineGap: 1
               })
               .font('Helvetica')
               .text(list.join(', '), { width: bulletContentWidth, lineGap: 1 });
            currentY = doc.y + 2;
          });
        } else {
          // No categories: render skills as a single bullet line
          const txt = flatSkills.join(', ');
          doc.fontSize(9.5).font('Helvetica');
          const h = doc.heightOfString(txt, { width: bulletContentWidth, lineGap: 1 });
          ensureSpace(h + 4);
          doc.fontSize(9.5).font('Helvetica').fillColor('#000000').text('•', pageMargin, currentY);
          doc.fontSize(9.5).font('Helvetica').fillColor('#000000')
             .text(txt, pageMargin + bulletIndent, currentY, { width: bulletContentWidth, lineGap: 1 });
          currentY = doc.y + 2;
        }
        currentY += 6;
      }

      // ─── EXPERIENCE ───
      const experiences = profile.experience || [];
      experiences.forEach((exp, i) => {
        if (i === 0) sectionHeader('EXPERIENCE');
        const company = exp.company || '';
        const title = exp.title || '';
        const period = exp.period || exp.startDate || '';

        // Estimate height
        doc.fontSize(9.5).font('Helvetica');
        const descH = exp.description
          ? doc.heightOfString(exp.description, { width: contentWidth, lineGap: 1.5 })
          : 0;
        ensureSpace(Math.min(40 + descH, 90));

        // Row 1: Company (bold, left)   Period (bold, right)
        if (period) {
          doc.fontSize(10.5).font('Helvetica-Bold');
          const pw = doc.widthOfString(period);
          doc.fillColor('#000000')
             .text(company, pageMargin, currentY, { width: contentWidth - pw - 10 });
          const ty = doc.y;
          doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#000000')
             .text(period, pageMargin + contentWidth - pw, currentY, { width: pw, align: 'right' });
          currentY = Math.max(ty, doc.y);
        } else {
          doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#000000')
             .text(company, pageMargin, currentY, { width: contentWidth });
          currentY = doc.y;
        }

        // Row 2: Title (italic)
        if (title) {
          doc.fontSize(10).font('Helvetica-Oblique').fillColor('#000000')
             .text(title, pageMargin, currentY, { width: contentWidth });
          currentY = doc.y + 2;
        } else {
          currentY += 2;
        }

        // Description
        renderParagraphOrBullets(exp.description);
        currentY += 6;
      });

      // ─── PROJECTS ───
      const projects = profile.projects || [];
      projects.forEach((project, i) => {
        if (i === 0) sectionHeader('PROJECTS');
        const name = project.title || project.name || 'Project';
        const techs = project.technologies || [];
        ensureSpace(30);
        if (techs.length > 0) {
          doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#000000')
             .text(`${name}  `, pageMargin, currentY, { continued: true })
             .font('Helvetica').fillColor('#555555').fontSize(9.5)
             .text(`—  ${techs.join(', ')}`, { width: contentWidth });
        } else {
          doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#000000')
             .text(name, pageMargin, currentY, { width: contentWidth });
        }
        currentY = doc.y + 2;
        renderParagraphOrBullets(project.description);
        currentY += 6;
      });

      // ─── EDUCATION ───
      const educ = profile.education || [];
      educ.forEach((edu, i) => {
        if (i === 0) sectionHeader('EDUCATION');
        ensureSpace(28);
        const school = edu.school || edu.institution || '';
        const degree = edu.degree || '';
        const field = edu.field || '';
        const year = edu.year || edu.graduationYear || '';
        if (year) {
          doc.fontSize(10.5).font('Helvetica-Bold');
          const yw = doc.widthOfString(String(year));
          doc.fillColor('#000000')
             .text(school, pageMargin, currentY, { width: contentWidth - yw - 10 });
          const sy = doc.y;
          doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#000000')
             .text(String(year), pageMargin + contentWidth - yw, currentY, { width: yw, align: 'right' });
          currentY = Math.max(sy, doc.y);
        } else {
          doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#000000')
             .text(school, pageMargin, currentY, { width: contentWidth });
          currentY = doc.y;
        }
        const dl = field ? `${degree} — ${field}` : degree;
        if (dl) {
          doc.fontSize(10).font('Helvetica-Oblique').fillColor('#000000')
             .text(dl, pageMargin, currentY, { width: contentWidth });
          currentY = doc.y + 6;
        }
      });

      doc.end();
    } catch (error) { reject(error); }
  });
};

// ─── Main dispatcher ───
const generatePDF = async (profile, user, templateId = 'professional', accentColor, bulletStyle) => {
  console.log(`[Resume] Generating PDF with template: ${templateId}, accent: ${accentColor || 'default'}, bullets: ${bulletStyle || 'bullets'}`);
  switch (templateId) {
    case 'modern':
      return generateModernPDF(profile, user, accentColor || '#10b981', bulletStyle);
    case 'minimal':
      return generateMinimalPDF(profile, user, bulletStyle);
    case 'centered':
      return generateCenteredPDF(profile, user, bulletStyle);
    default:
      return generateClassicPDF(profile, user, bulletStyle);
  }
};

// Generate Word Document
const generateWord = async (profile, user, templateId = 'professional') => {
  const template = templates[templateId] || templates.professional;
  const colors = template.colors;
  
  const sections = [];
  const children = [];

  // Header - Name and Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${user.firstName} ${user.lastName}`,
          bold: true,
          size: 56,
          color: colors.primary.replace('#', ''),
          font: 'Calibri'
        })
      ],
      spacing: { after: 100 }
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: profile.title || 'Professional',
          size: 28,
          color: colors.secondary.replace('#', ''),
          font: 'Calibri'
        })
      ],
      spacing: { after: 200 }
    })
  );

  // Contact Information
  const contactParts = [];
  if (user.email) contactParts.push(user.email);
  if (profile.phone) contactParts.push(profile.phone);
  if (profile.location) contactParts.push(profile.location);
  
  if (contactParts.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: contactParts.join('  |  '),
            size: 20,
            color: '666666',
            font: 'Calibri'
          })
        ],
        spacing: { after: 100 }
      })
    );
  }

  // Links
  const links = [];
  if (profile.linkedinUrl) links.push(`LinkedIn: ${profile.linkedinUrl}`);
  if (profile.githubUrl) links.push(`GitHub: ${profile.githubUrl}`);
  
  if (links.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: links.join('  |  '),
            size: 18,
            color: colors.secondary.replace('#', ''),
            font: 'Calibri'
          })
        ],
        spacing: { after: 400 }
      })
    );
  }

  // Horizontal line
  children.push(
    new Paragraph({
      border: {
        bottom: {
          color: colors.primary.replace('#', ''),
          space: 1,
          style: BorderStyle.SINGLE,
          size: 12
        }
      },
      spacing: { after: 300 }
    })
  );

  // Summary Section
  if (profile.summary) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'PROFESSIONAL SUMMARY',
            bold: true,
            size: 24,
            color: colors.primary.replace('#', ''),
            font: 'Calibri'
          })
        ],
        spacing: { before: 200, after: 150 }
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: profile.summary,
            size: 22,
            font: 'Calibri'
          })
        ],
        spacing: { after: 300 }
      })
    );
  }

  // Skills Section
  if (profile.skills && profile.skills.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'SKILLS',
            bold: true,
            size: 24,
            color: colors.primary.replace('#', ''),
            font: 'Calibri'
          })
        ],
        spacing: { before: 200, after: 150 }
      })
    );

    const skillsList = Array.isArray(profile.skills) ? profile.skills : [];
    const skillsText = skillsList.map(s => typeof s === 'string' ? s : s.name || '').join('  •  ');
    
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: skillsText,
            size: 22,
            color: colors.secondary.replace('#', ''),
            font: 'Calibri'
          })
        ],
        spacing: { after: 300 }
      })
    );
  }

  // Experience Section
  if (profile.experience && profile.experience.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'PROFESSIONAL EXPERIENCE',
            bold: true,
            size: 24,
            color: colors.primary.replace('#', ''),
            font: 'Calibri'
          })
        ],
        spacing: { before: 200, after: 150 }
      })
    );

    profile.experience.forEach((exp) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: exp.title || 'Position',
              bold: true,
              size: 24,
              color: colors.primary.replace('#', ''),
              font: 'Calibri'
            }),
            new TextRun({
              text: `  |  ${exp.company || ''}`,
              size: 22,
              color: colors.secondary.replace('#', ''),
              font: 'Calibri'
            })
          ],
          spacing: { after: 50 }
        })
      );

      if (exp.period) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: exp.period,
                size: 20,
                italics: true,
                color: '666666',
                font: 'Calibri'
              })
            ],
            spacing: { after: 100 }
          })
        );
      }

      if (exp.description) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: exp.description,
                size: 22,
                font: 'Calibri'
              })
            ],
            spacing: { after: 200 }
          })
        );
      }
    });
  }

  // Education Section
  if (profile.education && profile.education.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'EDUCATION',
            bold: true,
            size: 24,
            color: colors.primary.replace('#', ''),
            font: 'Calibri'
          })
        ],
        spacing: { before: 200, after: 150 }
      })
    );

    profile.education.forEach((edu) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: edu.degree || 'Degree',
              bold: true,
              size: 22,
              color: colors.primary.replace('#', ''),
              font: 'Calibri'
            })
          ],
          spacing: { after: 50 }
        })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${edu.school || edu.institution || ''}`,
              size: 22,
              font: 'Calibri'
            }),
            new TextRun({
              text: edu.year || edu.graduationYear ? `  |  ${edu.year || edu.graduationYear}` : '',
              size: 20,
              color: '666666',
              font: 'Calibri'
            })
          ],
          spacing: { after: 200 }
        })
      );
    });
  }

  // Projects Section
  if (profile.projects && profile.projects.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'PROJECTS',
            bold: true,
            size: 24,
            color: colors.primary.replace('#', ''),
            font: 'Calibri'
          })
        ],
        spacing: { before: 200, after: 150 }
      })
    );

    profile.projects.forEach((project) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: project.title || project.name || 'Project',
              bold: true,
              size: 22,
              color: colors.primary.replace('#', ''),
              font: 'Calibri'
            })
          ],
          spacing: { after: 50 }
        })
      );

      if (project.description) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: project.description,
                size: 22,
                font: 'Calibri'
              })
            ],
            spacing: { after: 100 }
          })
        );
      }

      if (project.technologies && project.technologies.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Technologies: ${project.technologies.join(', ')}`,
                size: 20,
                italics: true,
                color: colors.secondary.replace('#', ''),
                font: 'Calibri'
              })
            ],
            spacing: { after: 200 }
          })
        );
      }
    });
  }

  // Footer
  children.push(
    new Paragraph({
      border: {
        top: {
          color: 'CCCCCC',
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6
        }
      },
      spacing: { before: 400 }
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated by ProfilleAI • ${new Date().toLocaleDateString()}`,
          size: 18,
          color: '999999',
          font: 'Calibri'
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 100 }
    })
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children: children
    }]
  });

  return await Packer.toBuffer(doc);
};

// Get available templates
const getTemplates = () => {
  return Object.entries(templates).map(([id, template]) => ({
    id,
    name: template.name,
    description: template.description,
    colors: template.colors
  }));
};

module.exports = {
  generatePDF,
  generateWord,
  getTemplates,
  templates
};
