import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Drawer } from '@mui/material';
import {
  Person as PersonIcon,
  Work as WorkIcon,
  Star as StarIcon,
  School as SchoolIcon,
  Code as CodeIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LinkedIn as LinkedInIcon,
  GitHub as GitHubIcon,
  Language as WebsiteIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { formatDateRange } from '@/utils/dateRange';
import { publicResumeUrl } from '@/services/api';
import { hideWhileTyping } from '@/styles/keyboard';

/**
 * The public profile on a phone, for the two people who open it:
 *   - a recruiter or other visitor: Resume PDF and Contact at the bottom, and
 *     one "get a profile like this" card for people without an account.
 *   - the owner: Copy link and Share at the bottom, a bar saying this is what
 *     recruiters see, and Back to editor.
 * Content comes first: a short hero, stats that help (empty ones are left
 * out), and section tabs that follow the scroll.
 */

const ROLE_COLORS = ['#6366f1', '#ea7a1f', '#3b82f6', '#10b981', '#a855f7'];
const SKILL_TONES = [
  ['#eef0ff', '#4b4fc4'], ['#f5edff', '#8b3fd6'], ['#eaf7ef', '#2f7a45'], ['#fff1e6', '#b45309'],
  ['#e8f3ff', '#2563eb'], ['#f0efff', '#4b4fc4'], ['#f8ecff', '#9333ea'],
];
const TOP_SKILLS = 10;
const BULLETS_SHOWN = 2;

const Page = styled.div`
  min-height: 100vh;
  background: #f3f4f8;
  color: #13152a;
  padding-bottom: calc(84px + env(safe-area-inset-bottom, 0px));
`;

const TopBar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;

  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    border: none;
    background: none;
    padding: 0;
    font: inherit;
    font-size: 20px;
    font-weight: 800;
    color: #13152a;
    cursor: pointer;
    .ai { color: #6366f1; }
  }

  .mark {
    position: relative;
    width: 24px;
    height: 24px;
    &::before, &::after {
      content: '';
      position: absolute;
      width: 15px;
      height: 15px;
      border-radius: 4px;
    }
    &::before { top: 0; left: 0; background: #9ca3af; }
    &::after { bottom: 0; right: 0; background: #6366f1; }
  }

  .pill {
    height: 40px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1.5px solid #d9dafa;
    background: #f4f4ff;
    color: #4b4fc4;
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }
`;

const OwnerStrip = styled.div`
  padding: 10px 16px;
  background: #eef0ff;
  color: #4b4fc4;
  font-size: 13.5px;
  font-weight: 500;
`;

const Hero = styled.section`
  padding: 22px 16px 18px;
  background: linear-gradient(160deg, #f6f3ff 0%, #f1f3ff 55%, #fbf3fb 100%);

  .who { display: flex; align-items: center; gap: 16px; }

  .ring {
    position: relative;
    flex-shrink: 0;
    width: 88px;
    height: 88px;
    padding: 3px;
    border-radius: 50%;
    background: conic-gradient(from 200deg, #6366f1, #a855f7, #ec4899, #f59e0b, #6366f1);
  }

  .avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 3px solid #fff;
    box-sizing: border-box;
    background: #eef0fb;
    color: #4b55b5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: 800;
    overflow: hidden;
    img { width: 100%; height: 100%; object-fit: cover; }
  }

  .online {
    position: absolute;
    right: 4px;
    bottom: 4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #22c55e;
    border: 3px solid #fff;
  }

  h1 { margin: 0; font-size: 26px; font-weight: 800; line-height: 1.15; }
  .title { margin-top: 4px; font-size: 16px; line-height: 1.35; color: #3d3f56; }
  .meta { margin-top: 6px; font-size: 14px; color: #6b7280; }
  .meta .open { color: #16a34a; font-weight: 600; }

  .stats { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  .stat {
    padding: 6px 12px;
    border-radius: 999px;
    background: #fff;
    border: 1px solid #e7e7f6;
    font-size: 14px;
    font-weight: 600;
    color: #4b4fc4;
  }
  .stat.now { color: #c2410c; }
`;

const Sticky = styled.div`
  position: sticky;
  top: 0;
  z-index: 20;
  background: #fff;
  box-shadow: 0 1px 0 #e8e9f0;

  .compact {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
  }
  .compact .mini {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #eef0fb;
    color: #4b55b5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 800;
    overflow: hidden;
    flex-shrink: 0;
    img { width: 100%; height: 100%; object-fit: cover; }
  }
  .compact .name { font-size: 16px; font-weight: 700; line-height: 1.2; }
  .compact .sub { font-size: 12.5px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;

const Tabs = styled.nav`
  display: flex;
  gap: 4px;
  padding: 0 8px;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  button {
    flex-shrink: 0;
    padding: 14px 10px 12px;
    border: none;
    border-bottom: 3px solid transparent;
    background: none;
    font: inherit;
    font-size: 16px;
    font-weight: 500;
    color: #7b7f9e;
    cursor: pointer;
  }
  button[aria-current='true'] { color: #13152a; font-weight: 600; border-bottom-color: #5b5fd6; }
`;

const Content = styled.main`
  padding: 14px 12px 4px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Card = styled.section`
  padding: 18px 16px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid #e8e9f0;
  scroll-margin-top: ${p => p.$offset || 120}px;

  .head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${p => p.$tint || '#eef0ff'};
    color: ${p => p.$color || '#5b5fd6'};
    svg { font-size: 20px; }
  }
  h2 { margin: 0; font-size: 19px; font-weight: 700; }

  .body { font-size: 15.5px; line-height: 1.6; color: #3d3f56; white-space: pre-line; }
  .clamp { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }

  .more {
    margin-top: 10px;
    padding: 6px 0;
    border: none;
    background: none;
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    color: #5b5fd6;
    cursor: pointer;
  }
`;

const Timeline = styled.ol`
  margin: 0;
  padding: 0 0 0 22px;
  list-style: none;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 5px;
    top: 8px;
    bottom: 8px;
    width: 2px;
    background: #eceef4;
  }

  > li { position: relative; padding-bottom: 20px; }
  > li:last-child { padding-bottom: 0; }
  .dot {
    position: absolute;
    left: -22px;
    top: 6px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-sizing: content-box;
  }
  .role { font-size: 17px; font-weight: 700; line-height: 1.3; }
  .where { margin-top: 2px; font-size: 14.5px; color: #6b7280; }
  .where .co { font-weight: 600; }
  ul { margin: 10px 0 0; padding-left: 18px; list-style: disc; }
  ul li { font-size: 15px; line-height: 1.5; color: #3d3f56; margin-bottom: 6px; }
`;

const SkillChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  span, button {
    padding: 6px 12px;
    border-radius: 999px;
    border: none;
    font: inherit;
    font-size: 14.5px;
    font-weight: 600;
  }
  button { background: none; color: #5b5fd6; cursor: pointer; }
`;

const EduItem = styled.div`
  & + & { margin-top: 14px; }
  .deg { font-size: 16px; font-weight: 700; line-height: 1.3; }
  .sub { margin-top: 2px; font-size: 14.5px; color: #6b7280; }
  .sub .school { color: #5b5fd6; font-weight: 600; }
`;

const GrowCard = styled.section`
  padding: 22px 18px 18px;
  border-radius: 18px;
  background: linear-gradient(135deg, #5b5fd6 0%, #7c4ddb 60%, #9b4fd1 100%);
  color: #fff;

  h2 { margin: 0 0 6px; font-size: 20px; font-weight: 800; }
  p { margin: 0 0 16px; font-size: 14.5px; line-height: 1.5; color: rgba(255, 255, 255, 0.85); }
  button {
    width: 100%;
    height: 50px;
    border: none;
    border-radius: 12px;
    background: #fff;
    color: #4b4fc4;
    font: inherit;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
  }
  small { display: block; margin-top: 12px; font-size: 13px; color: rgba(255, 255, 255, 0.75); }
`;

const HireRow = styled.section`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 18px;
  background: #fff;
  border: 1px solid #e8e9f0;
  font-size: 14.5px;
  line-height: 1.45;
  color: #3d3f56;

  p { flex: 1; margin: 0; }
  strong { color: #13152a; }
  button {
    flex-shrink: 0;
    height: 40px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1.5px solid #e2e4ec;
    background: #fff;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    color: #13152a;
    cursor: pointer;
  }
`;

const BottomBar = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1100;
  display: flex;
  gap: 10px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  background: #fff;
  border-top: 1px solid #e8e9f0;

  button, a {
    height: 52px;
    border-radius: 14px;
    font: inherit;
    font-size: 16.5px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    cursor: pointer;
  }
  .secondary { flex: 0 0 38%; border: 1.5px solid #e2e4ec; background: #fff; color: #13152a; }
  .primary { flex: 1; border: none; background: #5b5fd6; color: #fff; }

  ${hideWhileTyping}
`;

const ContactList = styled.div`
  padding: 18px 16px calc(20px + env(safe-area-inset-bottom, 0px));

  h3 { margin: 0 0 12px; font-size: 18px; font-weight: 700; }
  a {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 4px;
    border-top: 1px solid #f0f1f6;
    color: #13152a;
    text-decoration: none;
    font-size: 16px;
    word-break: break-word;
  }
  a svg { color: #5b5fd6; flex-shrink: 0; }
`;

const initialsOf = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
/** "Senior UI Engineer (React, Node)" reads as "Senior UI Engineer". */
const cleanRoleTitle = (t) => String(t || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
const splitBullets = (text) => String(text || '').split('\n').map((l) => l.replace(/^\s*[•\-*–]\s*/, '').trim()).filter(Boolean);
/** Bullets with a figure in them lead; the rest keep their order. */
const strongestFirst = (bullets) => [...bullets.filter((b) => /\d/.test(b)), ...bullets.filter((b) => !/\d/.test(b))];
const isCurrent = (e) => e.current === true || !e.endDate || /present|current/i.test(String(e.endDate));

export default function PublicProfileMobile({
  profileId, fullName, headline, location, availability, profileImage, bio,
  experience, education, projects, skills, yearsOfExperience, yearsLabel,
  email, phone, socialLinks, portfolioUrl, isOwner, isSignedIn, isRecruiter,
  onCopyLink, onShare, navigate,
}) {
  const [compact, setCompact] = useState(false);
  const [active, setActive] = useState('about');
  const [bioOpen, setBioOpen] = useState(false);
  const [openRoles, setOpenRoles] = useState({});
  const [allSkills, setAllSkills] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const heroRef = useRef(null);
  const stickyRef = useRef(null);
  const sectionRefs = useRef({});
  const lockRef = useRef(0);

  const firstName = String(fullName || '').split(' ')[0] || 'them';
  const initials = initialsOf(fullName);
  const shortTitle = String(headline || '').split(',')[0].trim();
  const currentRole = experience.find(isCurrent);
  const isOpen = /open/i.test(String(availability || ''));

  const sections = useMemo(() => [
    bio && { id: 'about', label: 'About' },
    experience.length && { id: 'experience', label: 'Experience' },
    skills.length && { id: 'skills', label: 'Skills' },
    projects.length && { id: 'projects', label: 'Projects' },
    education.length && { id: 'education', label: 'Education' },
  ].filter(Boolean), [bio, experience.length, skills.length, projects.length, education.length]);

  // The name bar takes over once the hero has scrolled away.
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The tab follows the section under the sticky bar.
  useEffect(() => {
    const onScroll = () => {
      if (Date.now() < lockRef.current) return;
      const line = (stickyRef.current?.getBoundingClientRect().bottom || 0) + 12;
      let current = sections[0]?.id;
      for (const s of sections) {
        const el = sectionRefs.current[s.id];
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4 && sections.length) {
        current = sections[sections.length - 1].id;
      }
      setActive(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sections]);

  const jumpTo = (id) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    setActive(id);
    lockRef.current = Date.now() + 700;
    const offset = (stickyRef.current?.offsetHeight || 0) + (compact ? 0 : 60) + 8;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
  };

  const stickyHeight = (stickyRef.current?.offsetHeight || 110) + 8;
  const sectionProps = (id) => ({ id: `section-${id}`, ref: (el) => { sectionRefs.current[id] = el; }, $offset: stickyHeight });

  const contacts = [
    email && { href: `mailto:${email}`, icon: <EmailIcon />, label: email },
    phone && { href: `tel:${phone}`, icon: <PhoneIcon />, label: phone },
    socialLinks.linkedin && { href: socialLinks.linkedin, icon: <LinkedInIcon />, label: 'LinkedIn', external: true },
    socialLinks.github && { href: socialLinks.github, icon: <GitHubIcon />, label: 'GitHub', external: true },
    socialLinks.website && { href: socialLinks.website, icon: <WebsiteIcon />, label: 'Website', external: true },
    portfolioUrl && { href: portfolioUrl, icon: <FolderIcon />, label: 'Portfolio', external: true },
  ].filter(Boolean);

  const shownSkills = allSkills ? skills : skills.slice(0, TOP_SKILLS);

  return (
    <Page>
      <TopBar>
        <button type="button" className="logo" onClick={() => navigate('/')} aria-label="ProfilleAI home">
          <span className="mark" aria-hidden="true" />
          <span>profille<span className="ai">ai</span></span>
        </button>
        {isOwner ? (
          <button type="button" className="pill" onClick={() => navigate('/profile')}>Back to editor</button>
        ) : !isSignedIn ? (
          <button type="button" className="pill" onClick={() => navigate('/register')}>Create yours free</button>
        ) : null}
      </TopBar>
      {isOwner && !compact && <OwnerStrip>This is what recruiters see. Only you can see this bar.</OwnerStrip>}

      <Hero ref={heroRef}>
        <div className="who">
          <div className="ring">
            <div className="avatar">{profileImage ? <img src={profileImage} alt="" /> : initials}</div>
            {isOpen && <span className="online" aria-hidden="true" />}
          </div>
          <div>
            <h1>{fullName}</h1>
            {headline && <div className="title">{headline}</div>}
            {(location || isOpen) && (
              <div className="meta">
                {location}{location && isOpen && ' · '}{isOpen && <span className="open">Open to work</span>}
              </div>
            )}
          </div>
        </div>
        {/* Only numbers that help: no "0 projects". */}
        <div className="stats">
          {yearsOfExperience > 0 && <span className="stat">{yearsLabel} years</span>}
          {skills.length > 0 && <span className="stat">{skills.length} skills</span>}
          {currentRole?.company && <span className="stat now">Now at {currentRole.company}</span>}
        </div>
      </Hero>

      <Sticky ref={stickyRef}>
        {compact && (
          <div className="compact">
            <span className="mini">{profileImage ? <img src={profileImage} alt="" /> : initials}</span>
            <span style={{ minWidth: 0 }}>
              <div className="name">{fullName}</div>
              {shortTitle && <div className="sub">{shortTitle}</div>}
            </span>
          </div>
        )}
        {isOwner && compact && <OwnerStrip>This is what recruiters see. Only you can see this bar.</OwnerStrip>}
        {sections.length > 1 && (
          <Tabs aria-label="Profile sections">
            {sections.map((s) => (
              <button key={s.id} type="button" aria-current={active === s.id} onClick={() => jumpTo(s.id)}>{s.label}</button>
            ))}
          </Tabs>
        )}
      </Sticky>

      <Content>
        {bio && (
          <Card {...sectionProps('about')}>
            <div className="head"><span className="icon"><PersonIcon /></span><h2>About</h2></div>
            <div className={`body${bioOpen ? '' : ' clamp'}`}>{bio}</div>
            {bio.length > 220 && (
              <button type="button" className="more" onClick={() => setBioOpen((v) => !v)}>{bioOpen ? 'Show less' : 'Read more'}</button>
            )}
          </Card>
        )}

        {experience.length > 0 && (
          <Card {...sectionProps('experience')} $tint="#fff1e6" $color="#ea7a1f">
            <div className="head"><span className="icon"><WorkIcon /></span><h2>Experience</h2></div>
            <Timeline>
              {experience.map((e, i) => {
                const color = ROLE_COLORS[i % ROLE_COLORS.length];
                const bullets = strongestFirst(splitBullets(e.description));
                const open = !!openRoles[i];
                const shown = open ? bullets : bullets.slice(0, BULLETS_SHOWN);
                const dates = formatDateRange(e.startDate, e.endDate) || e.period || '';
                return (
                  <li key={`${e.company}-${i}`}>
                    <span className="dot" style={{ background: color, boxShadow: `0 0 0 2px ${color}33` }} />
                    <div className="role">{cleanRoleTitle(e.title || e.position)}</div>
                    <div className="where">
                      {e.company && <span className="co" style={{ color }}>{e.company}</span>}
                      {e.company && dates && ' · '}{dates}
                    </div>
                    {shown.length > 0 && <ul>{shown.map((b) => <li key={b}>{b}</li>)}</ul>}
                    {bullets.length > BULLETS_SHOWN && (
                      <button type="button" className="more" onClick={() => setOpenRoles((p) => ({ ...p, [i]: !open }))}>
                        {open ? 'Show less' : `Show all ${bullets.length}`}
                      </button>
                    )}
                  </li>
                );
              })}
            </Timeline>
          </Card>
        )}

        {skills.length > 0 && (
          <Card {...sectionProps('skills')} $tint="#eaf7ef" $color="#2f7a45">
            <div className="head"><span className="icon"><StarIcon /></span><h2>Top skills</h2></div>
            <SkillChips>
              {shownSkills.map((s, i) => {
                const [bg, fg] = SKILL_TONES[i % SKILL_TONES.length];
                return <span key={`${s}-${i}`} style={{ background: bg, color: fg }}>{s}</span>;
              })}
              {skills.length > TOP_SKILLS && (
                <button type="button" onClick={() => setAllSkills((v) => !v)}>
                  {allSkills ? 'Show fewer' : `+${skills.length - TOP_SKILLS} more`}
                </button>
              )}
            </SkillChips>
          </Card>
        )}

        {projects.length > 0 && (
          <Card {...sectionProps('projects')} $tint="#f5edff" $color="#8b3fd6">
            <div className="head"><span className="icon"><CodeIcon /></span><h2>Projects</h2></div>
            {projects.map((p, i) => (
              <EduItem key={`${p.title || p.name}-${i}`}>
                <div className="deg">{p.title || p.name}</div>
                {p.description && <div className="sub">{p.description}</div>}
              </EduItem>
            ))}
          </Card>
        )}

        {education.length > 0 && (
          <Card {...sectionProps('education')} $tint="#e8f3ff" $color="#2563eb">
            <div className="head"><span className="icon"><SchoolIcon /></span><h2>Education</h2></div>
            {education.map((e, i) => {
              const degree = [e.degree, e.fieldOfStudy || e.field].filter(Boolean).join(', ');
              const school = e.institution || e.school;
              const when = formatDateRange(e.startDate, e.endDate) || e.year || e.graduationYear || '';
              return (
                <EduItem key={`${school}-${i}`}>
                  <div className="deg">{degree || school}</div>
                  <div className="sub">
                    {degree && school && <span className="school">{school}</span>}
                    {degree && school && (when || e.location) && ' · '}
                    {when || e.location}
                  </div>
                </EduItem>
              );
            })}
          </Card>
        )}

        {/* The growth loop: only for visitors without an account. */}
        {!isOwner && !isSignedIn && (
          <GrowCard>
            <h2>Get a profile like this, free</h2>
            <p>A shareable portfolio, an ATS-ready resume and AI tailoring for every job. Takes about 2 minutes.</p>
            <button type="button" onClick={() => navigate('/register')}>Create your free profile</button>
            <small>No credit card needed</small>
          </GrowCard>
        )}
        {!isOwner && !isRecruiter && (
          <HireRow>
            <p><strong>Hiring?</strong> AI screening and scheduling for recruiters is coming soon.</p>
            <button type="button" onClick={() => navigate('/register?role=recruiter')}>Join waitlist</button>
          </HireRow>
        )}
      </Content>

      <BottomBar>
        {isOwner ? (
          <>
            <button type="button" className="secondary" onClick={onCopyLink}>Copy link</button>
            <button type="button" className="primary" onClick={onShare}>Share profile</button>
          </>
        ) : (
          <>
            <a className="secondary" href={publicResumeUrl(profileId)} target="_blank" rel="noopener noreferrer">Resume PDF</a>
            <button type="button" className="primary" onClick={() => setContactOpen(true)} disabled={!contacts.length}>
              Contact {firstName}
            </button>
          </>
        )}
      </BottomBar>

      <Drawer
        anchor="bottom"
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        PaperProps={{ sx: { borderTopLeftRadius: 20, borderTopRightRadius: 20 } }}
      >
        <ContactList>
          <h3>Contact {firstName}</h3>
          {contacts.map((c) => (
            <a
              key={c.href}
              href={c.href}
              {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              onClick={() => setContactOpen(false)}
            >
              {c.icon}{c.label}
            </a>
          ))}
        </ContactList>
      </Drawer>
    </Page>
  );
}
