import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import {
  Person as PersonIcon,
  Work as WorkIcon,
  Star as StarIcon,
  School as SchoolIcon,
  Code as CodeIcon,
  CardMembership as CertIcon,
  AlternateEmail as EmailIcon,
  Phone as PhoneIcon,
  LinkedIn as LinkedInIcon,
  GitHub as GitHubIcon,
  X as XIcon,
  Language as WebsiteIcon,
  Folder as FolderIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { formatDateRange } from '@/utils/dateRange';
import { publicResumeUrl } from '@/services/api';
import {
  ROLE_COLORS, initialsOf, cleanRoleTitle, splitBullets, strongestFirst, isCurrent, projectLink, projectTechs,
} from './profileView';

/**
 * The public profile on a laptop or desktop: the same page as the phone one
 * (PublicProfileMobile), laid out wide.
 *   - a recruiter or other visitor: Resume PDF and Contact in the hero, a
 *     contact card that stays in view, one "get a profile like this" card for
 *     people without an account, and the recruiter waitlist row.
 *   - the owner: Copy link and Share, a bar saying this is what recruiters
 *     see, Back to editor, and one thing that would improve the page.
 * Once the hero scrolls away a name bar with section tabs takes the top.
 */

const BULLETS_SHOWN = 3;
const SKILLS_PER_GROUP = 6;
const GROUP_TONES = [
  ['#eef0ff', '#4b4fc4'], ['#fff1e6', '#b45309'], ['#eaf7ef', '#2f7a45'],
  ['#f5edff', '#8b3fd6'], ['#e8f3ff', '#2563eb'],
];
const BAR_HEIGHT = 72;

const Page = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f6fa;
  color: #13152a;
`;

const Wrap = styled.div`
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 24px;
  box-sizing: border-box;
`;

const Button = styled.button`
  height: 48px;
  padding: 0 22px;
  border-radius: 12px;
  font: inherit;
  font-size: 17px;
  font-weight: 600;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  cursor: pointer;
  border: 1.5px solid #e2e4ec;
  background: #fff;
  color: #13152a;
  transition: background 0.15s, border-color 0.15s;
  &:hover { border-color: #c9ccdb; }

  &.primary { border-color: #5b5fd6; background: #5b5fd6; color: #fff; }
  &.primary:hover { background: #4b4fc4; border-color: #4b4fc4; }
  &.small { height: 42px; padding: 0 18px; font-size: 15.5px; border-radius: 10px; }
`;

const TopBar = styled.header`
  background: #fff;
  border-bottom: 1px solid #eceef4;

  ${Wrap} {
    height: ${BAR_HEIGHT}px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
    border: none;
    background: none;
    padding: 0;
    font: inherit;
    font-size: 22px;
    font-weight: 800;
    color: #13152a;
    cursor: pointer;
    .ai { color: #6366f1; }
  }

  .mark {
    position: relative;
    width: 28px;
    height: 28px;
    &::before, &::after {
      content: '';
      position: absolute;
      width: 17px;
      height: 17px;
      border-radius: 4px;
    }
    &::before { top: 0; left: 0; background: #9ca3af; }
    &::after { bottom: 0; right: 0; background: #6366f1; }
  }

  .pill {
    height: 42px;
    padding: 0 18px;
    border-radius: 999px;
    border: 1.5px solid #d9dafa;
    background: #f4f4ff;
    color: #4b4fc4;
    font: inherit;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    &:hover { background: #ebebff; }
  }
`;

const OwnerStrip = styled.div`
  padding: 11px 0;
  background: #eef0ff;
  color: #4b4fc4;
  font-size: 14.5px;
  font-weight: 500;
`;

const Hero = styled.section`
  padding: 48px 0;
  background: linear-gradient(160deg, #f6f3ff 0%, #f1f3ff 55%, #fbf3fb 100%);

  ${Wrap} { display: flex; align-items: center; gap: 32px; }
  .text { flex: 1; min-width: 0; }

  .ring {
    position: relative;
    flex-shrink: 0;
    width: 136px;
    height: 136px;
    padding: 4px;
    border-radius: 50%;
    background: conic-gradient(from 200deg, #6366f1, #a855f7, #ec4899, #f59e0b, #6366f1);
  }

  .avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 4px solid #fff;
    box-sizing: border-box;
    background: #eef0fb;
    color: #4b55b5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 42px;
    font-weight: 800;
    overflow: hidden;
    img { width: 100%; height: 100%; object-fit: cover; }
  }

  .online {
    position: absolute;
    right: 6px;
    bottom: 6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #22c55e;
    border: 4px solid #fff;
  }

  h1 { margin: 0; font-size: 44px; font-weight: 800; line-height: 1.1; letter-spacing: -0.02em; }
  .title { margin-top: 8px; font-size: 21px; line-height: 1.35; color: #3d3f56; }
  .meta { margin-top: 6px; font-size: 16px; color: #6b7280; }
  .meta .sep { margin: 0 10px; color: #c4c7d4; }
  .meta .open { color: #16a34a; font-weight: 600; }

  .stats { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
  .stat {
    padding: 7px 14px;
    border-radius: 999px;
    background: #fff;
    border: 1px solid #e7e7f6;
    font-size: 15px;
    font-weight: 600;
    color: #4b4fc4;
  }
  .stat.now { color: #c2410c; }

  .actions { display: flex; gap: 12px; flex-shrink: 0; }

  @media (max-width: 1000px) {
    ${Wrap} { flex-wrap: wrap; }
    .actions { width: 100%; }
  }
`;

const NameBar = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1100;
  background: #fff;
  box-shadow: 0 1px 0 #e8e9f0, 0 6px 18px rgba(19, 21, 42, 0.05);
  transform: translateY(${(p) => (p.$shown ? '0' : '-110%')});
  transition: transform 0.2s ease;

  ${Wrap} {
    height: ${BAR_HEIGHT}px;
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .mini {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #eef0fb;
    color: #4b55b5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 800;
    overflow: hidden;
    flex-shrink: 0;
    img { width: 100%; height: 100%; object-fit: cover; }
  }
  .who { min-width: 0; flex: 1; }
  .name { font-size: 17px; font-weight: 700; line-height: 1.2; }
  .sub { font-size: 13.5px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  nav { display: flex; gap: 4px; margin-right: 8px; }
  nav button {
    height: 40px;
    padding: 0 14px;
    border: none;
    border-radius: 10px;
    background: none;
    font: inherit;
    font-size: 16px;
    font-weight: 500;
    color: #3d3f56;
    cursor: pointer;
    &:hover { background: #f4f5fa; }
  }
  nav button[aria-current='true'] { background: #eef0ff; color: #4b4fc4; font-weight: 600; }
`;

const Layout = styled(Wrap)`
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 28px;
  align-items: start;
  padding-top: 32px;
  padding-bottom: 56px;

  .main { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
  .side {
    position: sticky;
    top: ${BAR_HEIGHT + 24}px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* The date and skill-group column narrows on small laptops. */
  --when-col: 170px;
  @media (max-width: 1100px) { --when-col: 120px; }
  @media (max-width: 1000px) { grid-template-columns: minmax(0, 1fr) 300px; gap: 20px; }
`;

const Card = styled.section`
  padding: 28px;
  border-radius: 20px;
  background: #fff;
  border: 1px solid #e8e9f0;
  scroll-margin-top: ${BAR_HEIGHT + 20}px;

  .head { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
  .icon {
    width: 40px;
    height: 40px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${(p) => p.$tint || '#eef0ff'};
    color: ${(p) => p.$color || '#5b5fd6'};
    svg { font-size: 21px; }
  }
  h2 { margin: 0; font-size: 24px; font-weight: 700; }

  .body { font-size: 17px; line-height: 1.75; color: #3d3f56; white-space: pre-line; }

  .more {
    margin-top: 8px;
    padding: 4px 0;
    border: none;
    background: none;
    font: inherit;
    font-size: 15.5px;
    font-weight: 500;
    color: #5b5fd6;
    cursor: pointer;
    &:hover { text-decoration: underline; }
  }
`;

/** Date column on the left, the role on a timeline to its right. */
const Roles = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;

  > li { display: grid; grid-template-columns: var(--when-col) minmax(0, 1fr); gap: 20px; }
  .when { padding-top: 3px; font-size: 15.5px; color: #6b7280; }
  .entry { position: relative; padding: 0 0 28px 32px; border-left: 2px solid #eceef4; margin-left: 6px; }
  > li:last-child .entry { padding-bottom: 4px; }
  .dot {
    position: absolute;
    left: -8px;
    top: 5px;
    width: 14px;
    height: 14px;
    box-sizing: border-box;
    border-radius: 50%;
    border: 2px solid #fff;
  }
  .role { font-size: 20px; font-weight: 700; line-height: 1.3; }
  .co { margin-top: 3px; font-size: 16px; font-weight: 500; }
  ul { margin: 12px 0 0; padding-left: 20px; list-style: disc; }
  ul li { font-size: 16.5px; line-height: 1.6; color: #3d3f56; margin-bottom: 8px; }
`;

const SkillGroups = styled.div`
  .group { display: grid; grid-template-columns: var(--when-col) minmax(0, 1fr); gap: 20px; align-items: start; }
  .group + .group { margin-top: 14px; }
  .label {
    padding-top: 9px;
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #3d3f56;
  }
  .chips { display: flex; flex-wrap: wrap; gap: 10px; }
  .chips span { padding: 7px 14px; border-radius: 999px; font-size: 15.5px; font-weight: 500; }
  .foot { margin: 12px 0 0 calc(var(--when-col) + 20px); }
  &.flat .group { display: block; }
  &.flat .label { display: none; }
  &.flat .foot { margin-left: 0; }
`;

const Rows = styled.div`
  .row { display: grid; grid-template-columns: var(--when-col) minmax(0, 1fr); gap: 20px; }
  .row + .row { margin-top: 22px; }
  .when { padding-top: 2px; font-size: 15.5px; color: #6b7280; }
  .what { font-size: 18.5px; font-weight: 700; line-height: 1.35; }
  .sub { margin-top: 3px; font-size: 16px; color: #2563eb; }
  .desc { margin-top: 6px; font-size: 16px; line-height: 1.6; color: #3d3f56; }
  .tech { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .tech span { padding: 4px 10px; border-radius: 999px; background: #f5edff; color: #8b3fd6; font-size: 13.5px; font-weight: 500; }
  a { color: #5b5fd6; font-weight: 500; text-decoration: none; }
  a:hover { text-decoration: underline; }
`;

const SideCard = styled.section`
  padding: 22px;
  border-radius: 20px;
  background: #fff;
  border: 1px solid #e8e9f0;
  transition: box-shadow 0.3s;
  &.flash { box-shadow: 0 0 0 3px #c7c9f7; }

  h3 { margin: 0 0 16px; font-size: 19px; font-weight: 700; }
  p { margin: 0 0 16px; font-size: 15px; line-height: 1.5; color: #6b7280; }
`;

const ContactRow = styled.a`
  display: flex;
  align-items: center;
  gap: 14px;
  color: inherit;
  text-decoration: none;
  & + & { margin-top: 16px; }

  .badge {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    svg { font-size: 18px; }
  }
  .text { min-width: 0; }
  .k { font-size: 13.5px; color: #6b7280; }
  .v { font-size: 16px; font-weight: 600; color: #13152a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &:hover .v { color: #4b4fc4; }
`;

const GrowCard = styled.section`
  padding: 24px 22px 20px;
  border-radius: 20px;
  background: linear-gradient(135deg, #5b5fd6 0%, #7c4ddb 60%, #9b4fd1 100%);
  color: #fff;

  h3 { margin: 0 0 10px; font-size: 21px; font-weight: 800; }
  p { margin: 0 0 18px; font-size: 15.5px; line-height: 1.5; color: rgba(255, 255, 255, 0.85); }
  button {
    width: 100%;
    height: 50px;
    border: none;
    border-radius: 12px;
    background: #fff;
    color: #4b4fc4;
    font: inherit;
    font-size: 16.5px;
    font-weight: 700;
    cursor: pointer;
  }
  small { display: block; margin-top: 14px; font-size: 13.5px; color: rgba(255, 255, 255, 0.75); }
`;

const HireRow = styled.section`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 20px;
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

const ImproveButton = styled.button`
  width: 100%;
  height: 46px;
  border-radius: 12px;
  border: 1.5px solid #d9dafa;
  background: #f4f4ff;
  color: #4b4fc4;
  font: inherit;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: #ebebff; }
`;

const Footer = styled.footer`
  background: #1f2433;
  color: rgba(255, 255, 255, 0.7);
  font-size: 15px;

  ${Wrap} { padding-top: 28px; padding-bottom: 28px; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  nav { display: flex; gap: 24px; }
  a { color: inherit; text-decoration: none; }
  a:hover { color: #fff; }
`;

/** The one change that would help this page most, for its owner. */
const improvementFor = ({ projects, profileImage, socialLinks }) => {
  if (!projects.length) {
    return { text: 'Add a project with a link, so recruiters can see work you have shipped.', cta: '+ Add project', section: 'projects' };
  }
  if (!profileImage) return { text: 'Add a photo, so recruiters can put a face to the name.', cta: 'Add a photo', section: 'basic' };
  if (!socialLinks.linkedin && !socialLinks.github && !socialLinks.website) {
    return { text: 'Add your LinkedIn or GitHub, so recruiters can check your work.', cta: 'Add links', section: 'basic' };
  }
  return null;
};

export default function PublicProfileDesktop({
  profileId, fullName, headline, location, availability, profileImage, bio,
  experience, education, projects, certifications, skills, skillGroups, yearsOfExperience, yearsLabel,
  email, phone, socialLinks, portfolioUrl, profileUrl, isOwner, isSignedIn, isRecruiter,
  onCopyLink, onShare, navigate,
}) {
  const [barShown, setBarShown] = useState(false);
  const [active, setActive] = useState('about');
  const [openRoles, setOpenRoles] = useState({});
  const [allSkills, setAllSkills] = useState(false);
  const [flash, setFlash] = useState(false);
  const heroRef = useRef(null);
  const sectionRefs = useRef({});
  const lockRef = useRef(0);

  const firstName = String(fullName || '').split(' ')[0] || 'them';
  const initials = initialsOf(fullName);
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
    const observer = new IntersectionObserver(([entry]) => setBarShown(!entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The tab follows the section under the name bar.
  useEffect(() => {
    const onScroll = () => {
      if (Date.now() < lockRef.current) return;
      const line = BAR_HEIGHT + 40;
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

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(false), 1200);
    return () => clearTimeout(t);
  }, [flash]);

  const jumpTo = (id) => {
    const el = sectionRefs.current[id];
    if (!el) return;
    setActive(id);
    lockRef.current = Date.now() + 700;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - BAR_HEIGHT - 20, behavior: 'smooth' });
  };

  // The contact card is always in view; Contact opens mail when there is an
  // address, and points at the card either way.
  const contact = () => {
    setFlash(true);
    if (email) window.location.href = `mailto:${email}`;
  };

  const sectionProps = (id) => ({ id: `section-${id}`, ref: (el) => { sectionRefs.current[id] = el; } });

  const shortProfileUrl = String(profileUrl || '').replace(/^https?:\/\/(www\.)?/, '');
  const contacts = [
    email && { href: `mailto:${email}`, icon: <EmailIcon />, tone: ['#eef0ff', '#4b4fc4'], k: 'Email', v: email },
    phone && { href: `tel:${phone}`, icon: <PhoneIcon />, tone: ['#eaf7ef', '#2f7a45'], k: 'Phone', v: phone },
    socialLinks.linkedin && { href: socialLinks.linkedin, icon: <LinkedInIcon />, tone: ['#e8f3ff', '#0a66c2'], k: 'LinkedIn', v: socialLinks.linkedin.replace(/^https?:\/\/(www\.)?/, ''), external: true },
    socialLinks.github && { href: socialLinks.github, icon: <GitHubIcon />, tone: ['#f1f2f6', '#13152a'], k: 'GitHub', v: socialLinks.github.replace(/^https?:\/\/(www\.)?/, ''), external: true },
    socialLinks.twitter && { href: socialLinks.twitter, icon: <XIcon />, tone: ['#f1f2f6', '#13152a'], k: 'X', v: socialLinks.twitter.replace(/^https?:\/\/(www\.)?/, ''), external: true },
    socialLinks.website && { href: socialLinks.website, icon: <WebsiteIcon />, tone: ['#f5edff', '#8b3fd6'], k: 'Website', v: socialLinks.website.replace(/^https?:\/\/(www\.)?/, ''), external: true },
    portfolioUrl && { href: portfolioUrl, icon: <FolderIcon />, tone: ['#f5edff', '#8b3fd6'], k: 'Portfolio', v: portfolioUrl.replace(/^https?:\/\/(www\.)?/, ''), external: true },
    profileUrl && { href: profileUrl, icon: <LinkIcon />, tone: ['#fff1e6', '#c2410c'], k: 'Profile link', v: shortProfileUrl },
  ].filter(Boolean);

  // Six per group until "Show all"; an ungrouped list shows three rows' worth.
  const groups = skillGroups.length ? skillGroups : [{ label: '', skills }];
  const perGroup = skillGroups.length ? SKILLS_PER_GROUP : SKILLS_PER_GROUP * 3;
  const shownGroups = allSkills ? groups : groups.map((g) => ({ ...g, skills: g.skills.slice(0, perGroup) }));
  const hiddenSkills = skills.length - shownGroups.reduce((n, g) => n + g.skills.length, 0);
  const improvement = isOwner ? improvementFor({ projects, profileImage, socialLinks }) : null;

  const avatar = profileImage ? <img src={profileImage} alt="" /> : initials;
  const primaryAction = isOwner
    ? <Button type="button" className="primary" onClick={onShare}>Share profile</Button>
    : <Button type="button" className="primary" onClick={contact} disabled={!contacts.length}>Contact {firstName}</Button>;

  return (
    <Page>
      <TopBar>
        <Wrap>
          <button type="button" className="logo" onClick={() => navigate('/')} aria-label="ProfilleAI home">
            <span className="mark" aria-hidden="true" />
            <span>profille<span className="ai">ai</span></span>
          </button>
          {isOwner ? (
            <button type="button" className="pill" onClick={() => navigate('/profile')}>Back to editor</button>
          ) : !isSignedIn ? (
            <button type="button" className="pill" onClick={() => navigate('/register')}>Create yours free</button>
          ) : null}
        </Wrap>
      </TopBar>
      {isOwner && <OwnerStrip><Wrap>This is what recruiters see. Only you can see this bar.</Wrap></OwnerStrip>}

      <Hero ref={heroRef}>
        <Wrap>
          <div className="ring">
            <div className="avatar">{avatar}</div>
            {isOpen && <span className="online" aria-hidden="true" />}
          </div>
          <div className="text">
            <h1>{fullName}</h1>
            {headline && <div className="title">{headline}</div>}
            {(location || isOpen) && (
              <div className="meta">
                {location}
                {location && isOpen && <span className="sep" aria-hidden="true">•</span>}
                {isOpen && <span className="open">Open to work</span>}
              </div>
            )}
            {/* Only numbers that help: no "0 projects". */}
            <div className="stats">
              {yearsOfExperience > 0 && <span className="stat">{yearsLabel} years</span>}
              {skills.length > 0 && <span className="stat">{skills.length} skills</span>}
              {currentRole?.company && <span className="stat now">Now at {currentRole.company}</span>}
            </div>
          </div>
          <div className="actions">
            {isOwner
              ? <Button type="button" onClick={onCopyLink}>Copy link</Button>
              : <Button as="a" href={publicResumeUrl(profileId)} target="_blank" rel="noopener noreferrer">Resume PDF</Button>}
            {primaryAction}
          </div>
        </Wrap>
      </Hero>

      <NameBar $shown={barShown} aria-hidden={!barShown}>
        <Wrap>
          <span className="mini">{avatar}</span>
          <span className="who">
            <div className="name">{fullName}</div>
            {headline && <div className="sub">{headline}</div>}
          </span>
          {sections.length > 1 && (
            <nav aria-label="Profile sections">
              {sections.map((s) => (
                <button key={s.id} type="button" tabIndex={barShown ? 0 : -1} aria-current={active === s.id} onClick={() => jumpTo(s.id)}>{s.label}</button>
              ))}
            </nav>
          )}
          {React.cloneElement(primaryAction, { className: 'primary small', tabIndex: barShown ? 0 : -1 })}
        </Wrap>
      </NameBar>

      <Layout>
        <main className="main">
          {bio && (
            <Card {...sectionProps('about')}>
              <div className="head"><span className="icon"><PersonIcon /></span><h2>About</h2></div>
              <div className="body">{bio}</div>
            </Card>
          )}

          {experience.length > 0 && (
            <Card {...sectionProps('experience')} $tint="#fff1e6" $color="#ea7a1f">
              <div className="head"><span className="icon"><WorkIcon /></span><h2>Experience</h2></div>
              <Roles>
                {experience.map((e, i) => {
                  const color = ROLE_COLORS[i % ROLE_COLORS.length];
                  const bullets = strongestFirst(splitBullets(e.description));
                  const open = !!openRoles[i];
                  const shown = open ? bullets : bullets.slice(0, BULLETS_SHOWN);
                  const dates = formatDateRange(e.startDate, e.endDate) || e.period || '';
                  return (
                    <li key={`${e.company}-${i}`}>
                      <div className="when">{dates}</div>
                      <div className="entry">
                        <span className="dot" style={{ background: color, boxShadow: `0 0 0 3px ${color}26` }} />
                        <div className="role">{cleanRoleTitle(e.title || e.position)}</div>
                        {e.company && <div className="co" style={{ color }}>{e.company}</div>}
                        {shown.length > 0 && <ul>{shown.map((b) => <li key={b}>{b}</li>)}</ul>}
                        {bullets.length > BULLETS_SHOWN && (
                          <button type="button" className="more" onClick={() => setOpenRoles((p) => ({ ...p, [i]: !open }))}>
                            {open ? 'Show less' : `Show all ${bullets.length}`}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </Roles>
            </Card>
          )}

          {skills.length > 0 && (
            <Card {...sectionProps('skills')} $tint="#eaf7ef" $color="#2f7a45">
              <div className="head"><span className="icon"><StarIcon /></span><h2>Skills</h2></div>
              <SkillGroups className={skillGroups.length ? '' : 'flat'}>
                {shownGroups.map((g, gi) => {
                  const [bg, fg] = GROUP_TONES[gi % GROUP_TONES.length];
                  return (
                    <div className="group" key={g.label || gi}>
                      <div className="label">{g.label}</div>
                      <div className="chips">
                        {g.skills.map((s, i) => <span key={`${s}-${i}`} style={{ background: bg, color: fg }}>{s}</span>)}
                      </div>
                    </div>
                  );
                })}
                {(hiddenSkills > 0 || allSkills) && (
                  <div className="foot">
                    <button type="button" className="more" onClick={() => setAllSkills((v) => !v)}>
                      {allSkills ? 'Show fewer' : `Show all ${skills.length} skills`}
                    </button>
                  </div>
                )}
              </SkillGroups>
            </Card>
          )}

          {projects.length > 0 && (
            <Card {...sectionProps('projects')} $tint="#f5edff" $color="#8b3fd6">
              <div className="head"><span className="icon"><CodeIcon /></span><h2>Projects</h2></div>
              <Rows>
                {projects.map((p, i) => {
                  const link = projectLink(p);
                  const techs = projectTechs(p);
                  const when = formatDateRange(p.startDate, p.endDate) || '';
                  return (
                    <div className="row" key={`${p.title || p.name}-${i}`}>
                      <div className="when">{when}</div>
                      <div>
                        <div className="what">{p.title || p.name}</div>
                        {(p.role || p.company) && <div className="sub">{[p.role, p.company].filter(Boolean).join(', ')}</div>}
                        {p.description && <div className="desc">{p.description}</div>}
                        {techs.length > 0 && <div className="tech">{techs.map((t) => <span key={t}>{t}</span>)}</div>}
                        {link && (
                          <div className="desc">
                            <a href={link} target="_blank" rel="noopener noreferrer">{link.replace(/^https?:\/\/(www\.)?/, '')}</a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </Rows>
            </Card>
          )}

          {education.length > 0 && (
            <Card {...sectionProps('education')} $tint="#e8f3ff" $color="#2563eb">
              <div className="head"><span className="icon"><SchoolIcon /></span><h2>Education</h2></div>
              <Rows>
                {education.map((e, i) => {
                  const degree = [e.degree, e.fieldOfStudy || e.field].filter(Boolean).join(', ');
                  const school = e.institution || e.school;
                  const when = formatDateRange(e.startDate, e.endDate) || e.year || e.graduationYear || '';
                  return (
                    <div className="row" key={`${school}-${i}`}>
                      <div className="when">{when}</div>
                      <div>
                        <div className="what">{degree || school}</div>
                        {degree && school && <div className="sub">{school}</div>}
                        {e.location && !(degree && school) && <div className="sub">{e.location}</div>}
                      </div>
                    </div>
                  );
                })}
              </Rows>
            </Card>
          )}

          {certifications.length > 0 && (
            <Card $tint="#fff7e0" $color="#b45309">
              <div className="head"><span className="icon"><CertIcon /></span><h2>Certifications</h2></div>
              <Rows>
                {certifications.map((c, i) => {
                  const name = typeof c === 'string' ? c : c.name;
                  return (
                    <div className="row" key={`${name}-${i}`}>
                      <div className="when">{typeof c === 'object' ? c.year || c.date || '' : ''}</div>
                      <div>
                        <div className="what">{name}</div>
                        {typeof c === 'object' && c.issuer && <div className="sub">{c.issuer}</div>}
                      </div>
                    </div>
                  );
                })}
              </Rows>
            </Card>
          )}
        </main>

        <aside className="side">
          {contacts.length > 0 && (
            <SideCard className={flash ? 'flash' : ''}>
              <h3>Contact</h3>
              {contacts.map((c) => (
                <ContactRow key={c.href} href={c.href} {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                  <span className="badge" style={{ background: c.tone[0], color: c.tone[1] }}>{c.icon}</span>
                  <span className="text">
                    <div className="k">{c.k}</div>
                    <div className="v">{c.v}</div>
                  </span>
                </ContactRow>
              ))}
            </SideCard>
          )}

          {improvement && (
            <SideCard>
              <h3>Improve this page</h3>
              <p>{improvement.text}</p>
              <ImproveButton type="button" onClick={() => navigate('/profile/edit', { state: { section: improvement.section } })}>
                {improvement.cta}
              </ImproveButton>
            </SideCard>
          )}

          {/* The growth loop: only for visitors without an account. */}
          {!isOwner && !isSignedIn && (
            <GrowCard>
              <h3>Get a profile like this, free</h3>
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
        </aside>
      </Layout>

      <Footer>
        <Wrap>
          <span>© {new Date().getFullYear()} {fullName} · Powered by ProfilleAI</span>
          <nav>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
          </nav>
        </Wrap>
      </Footer>
    </Page>
  );
}
