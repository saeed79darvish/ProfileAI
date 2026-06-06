// Seed a mock "John Doe" candidate on production so the extension panel can be
// screenshotted for the Chrome Web Store listing without exposing real PII.
//
// Usage:
//   node scripts/seed-demo-profile.mjs
//
// It registers (or logs in to) john.doe.demo@profilleai.com and writes a
// frontend-engineer profile that matches the store screenshots. Then log in to
// www.profilleai.com with the printed credentials and re-capture the panel.

const API_BASE = process.env.API_BASE || 'https://api.profilleai.com/api';

const CRED = {
  email: 'john.doe.demo@profilleai.com',
  password: 'JohnDoe@2026',
  firstName: 'John',
  lastName: 'Doe',
  role: 'candidate',
};

const PROFILE = {
  title: 'Senior Frontend Engineer',
  location: 'San Francisco, CA',
  phone: '+1 (415) 555-0142',
  linkedinUrl: 'https://www.linkedin.com/in/john-doe-demo',
  githubUrl: 'https://github.com/john-doe-demo',
  summary:
    'Senior Frontend Engineer with 8+ years building scalable, production-grade web applications using React, TypeScript, and modern frameworks. Strong focus on cross-team collaboration, design systems, and AI-powered product features. Proven track record delivering high-quality interfaces that serve millions of users.',
  skills: {
    frontend: ['React', 'TypeScript', 'JavaScript', 'Angular', 'Vue.js', 'Next.js', 'HTML', 'CSS', 'Tailwind CSS'],
    backend: ['Node.js', 'Express', 'GraphQL', 'REST APIs'],
    database: ['MongoDB', 'PostgreSQL', 'Redis'],
    tools: ['Git', 'Webpack', 'Vite', 'Jest', 'Cypress'],
  },
  experience: [
    {
      company: 'Equinix',
      position: 'Senior UI Software Architect Engineer',
      startDate: '2025-04',
      endDate: null,
      current: true,
      description:
        'Led development of scalable, production-grade full-stack applications using React and TypeScript. Architected reusable component libraries and design system integrations, improving user engagement by 25%. Mentored junior engineers and established frontend best practices.',
    },
    {
      company: 'Amazon AWS',
      position: 'Lead UI Software Development Engineer',
      startDate: '2024-05',
      endDate: '2025-04',
      current: false,
      description:
        'Led development of a video streaming platform supporting 1M+ users per month using React, TypeScript, and AWS. Created reusable UI components and developer tools aligned with UX specifications, improving data retrieval efficiency by 30%.',
    },
    {
      company: 'Shopify',
      position: 'Frontend Engineer',
      startDate: '2018-06',
      endDate: '2024-05',
      current: false,
      description:
        'Built core merchant-facing features with React and TypeScript. Implemented performance optimizations that reduced page load times by 40% and improved Lighthouse scores across the storefront.',
    },
  ],
  education: [
    {
      institution: 'University of California, Berkeley',
      degree: 'BS Computer Science',
      field: 'Computer Science',
      startDate: '2012-09',
      endDate: '2016-05',
    },
  ],
  projects: [
    {
      name: 'Design System Library',
      description:
        'Built an internal React + TypeScript component library adopted across 12 product teams, with full accessibility and theming support.',
      technologies: ['React', 'TypeScript', 'Storybook', 'Tailwind CSS'],
      url: 'https://github.com/john-doe-demo/design-system',
    },
    {
      name: 'Realtime Analytics Dashboard',
      description:
        'Developed a realtime analytics dashboard processing 1M+ events/day with React, WebSockets, and D3.js.',
      technologies: ['React', 'WebSocket', 'D3.js', 'Node.js'],
      url: 'https://github.com/john-doe-demo/analytics',
    },
  ],
  isPublic: true,
};

async function main() {
  let token;

  // Try register first; if the account already exists, fall back to login.
  const reg = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CRED),
  });

  if (reg.ok) {
    const data = await reg.json();
    token = data.token;
    console.log('✅ Registered new demo account:', CRED.email);
  } else {
    console.log('ℹ️  Register failed (likely already exists). Logging in...');
    const login = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: CRED.email, password: CRED.password }),
    });
    if (!login.ok) {
      const err = await login.text();
      throw new Error(`Login failed: ${login.status} ${err}`);
    }
    const data = await login.json();
    token = data.token;
    console.log('✅ Logged in to existing demo account:', CRED.email);
  }

  // Create / update the profile.
  const prof = await fetch(`${API_BASE}/profiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(PROFILE),
  });

  if (!prof.ok) {
    const err = await prof.text();
    throw new Error(`Profile save failed: ${prof.status} ${err}`);
  }
  console.log('✅ Demo profile saved.');
  console.log('\n──────────────────────────────────────────────');
  console.log('  Demo login for store screenshots:');
  console.log(`  URL:      https://www.profilleai.com/login`);
  console.log(`  Email:    ${CRED.email}`);
  console.log(`  Password: ${CRED.password}`);
  console.log('──────────────────────────────────────────────\n');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
