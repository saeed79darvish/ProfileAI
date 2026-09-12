/**
 * Job taxonomy — sectors, the job titles under each, and the skills people
 * in them actually list.
 *
 * Lifted out of JobPreferencesWizard/constants.ts when ProfileCoach became
 * the second consumer: two pages sharing a vocabulary is exactly what makes
 * a draft round-trip cleanly between them, and a copy would have drifted.
 *
 * Plain JS rather than TS so `node --test` can import it without a build
 * step — same reason JobPreferencesWizard/handoff.js is plain JS.
 */

/* The sector list is the first question the coach asks, and it is read as a
   statement about who the product is for. Twelve tech-company desk jobs told
   a nurse, an electrician, a warehouse lead and a line cook that this was not
   built for them, so it covers the rest of the labour market now.

   `primary` marks what shows before "More fields" is tapped — a first screen
   that spans white and blue collar rather than one that reads as a software
   company's org chart. `aliases` are what people actually type: nobody
   describes themselves as being in "Skilled Trades & Construction", they say
   they are an electrician. Every alias here saves an AI call (see needsAI).

   Ids are permanent: they are stored on profiles, and JobPreferencesWizard/
   sectorProfiles.ts keys its per-sector copy off them (unknown ids fall back
   to neutral defaults, so a new sector is safe to add without touching it). */

export const JOB_SECTORS = [
  { id: 'tech',           icon: '💻', label: 'Software & IT', primary: true,
    aliases: ['software', 'developer', 'programmer', 'coding', 'it support', 'sysadmin', 'devops', 'cybersecurity', 'help desk'] },
  { id: 'data',           icon: '📈', label: 'Data & Analytics', primary: true,
    aliases: ['data', 'analytics', 'analyst', 'machine learning', 'statistics'] },
  { id: 'design',         icon: '🎨', label: 'Design & Creative', primary: true,
    aliases: ['design', 'designer', 'ux', 'ui', 'creative', 'animation'] },
  { id: 'product',        icon: '🧭', label: 'Product & Strategy', primary: true,
    aliases: ['product', 'strategy', 'product management'] },
  { id: 'marketing',      icon: '📣', label: 'Marketing & Growth', primary: true,
    aliases: ['marketing', 'growth', 'seo', 'advertising', 'social media', 'brand'] },
  { id: 'sales',          icon: '🤝', label: 'Sales & Business Development', primary: true,
    aliases: ['sales', 'selling', 'account executive', 'business development', 'realtor'] },
  { id: 'support',        icon: '🎧', label: 'Customer Support & Success', primary: true,
    aliases: ['customer service', 'customer support', 'customer success', 'call center', 'help desk', 'call centre'] },
  { id: 'finance',        icon: '📊', label: 'Finance & Accounting', primary: true,
    aliases: ['finance', 'accounting', 'accountant', 'bookkeep', 'banking', 'bank teller', 'insurance', 'payroll', 'tax prep'] },
  { id: 'hr',             icon: '🧑‍🤝‍🧑', label: 'People & HR', primary: true,
    aliases: ['hr', 'human resources', 'recruiting', 'recruiter', 'talent', 'people ops'] },
  { id: 'admin',          icon: '🗂️', label: 'Admin & Office Support', primary: true,
    aliases: ['admin', 'administrative', 'assistant', 'secretary', 'receptionist', 'office manager', 'data entry', 'clerk'] },
  { id: 'operations',     icon: '⚙️', label: 'Operations & Project Management', primary: true,
    aliases: ['operations', 'project management', 'program management', 'business operations'] },
  { id: 'healthcare',     icon: '🩺', label: 'Healthcare & Medical', primary: true,
    aliases: ['healthcare', 'medical', 'nurse', 'nursing', 'cna', 'caregiver', 'care worker', 'doctor', 'physician', 'dental', 'dentist', 'pharmacy', 'veterinary', 'vet tech', 'paramedic', 'emt'] },
  { id: 'education',      icon: '🎓', label: 'Education & Training', primary: true,
    aliases: ['education', 'teaching', 'teacher', 'tutor', 'school', 'training', 'childcare', 'daycare'] },
  { id: 'hospitality',    icon: '🍽️', label: 'Hospitality, Food & Retail', primary: true,
    aliases: ['hospitality', 'restaurant', 'food', 'server', 'waiter', 'waitress', 'barista', 'bartender', 'chef', 'cook', 'hotel', 'retail', 'cashier', 'store', 'shop'] },
  { id: 'trades',         icon: '🔧', label: 'Skilled Trades & Construction', primary: true,
    aliases: ['trades', 'construction', 'electrician', 'plumber', 'plumbing', 'hvac', 'carpenter', 'welder', 'welding', 'mechanic', 'maintenance technician', 'handyman', 'landscaping', 'painter', 'roofing'] },

  /* Behind "More fields". Every bit as real — just less often the first
     answer, and 26 chips at once is a wall rather than a question. */
  { id: 'media',          icon: '✍️', label: 'Media, Writing & PR',
    aliases: ['media', 'writing', 'writer', 'journalism', 'journalist', 'editor', 'copywriting', 'public relations', 'pr', 'video', 'photography', 'podcast'] },
  { id: 'legal',          icon: '⚖️', label: 'Legal & Compliance',
    aliases: ['legal', 'law', 'lawyer', 'attorney', 'paralegal', 'compliance'] },
  { id: 'logistics',      icon: '🚚', label: 'Supply Chain & Logistics',
    aliases: ['logistics', 'supply chain', 'warehouse', 'driver', 'driving', 'truck', 'trucking', 'delivery', 'courier', 'shipping', 'forklift', 'dispatch', 'inventory'] },
  { id: 'manufacturing',  icon: '🏭', label: 'Manufacturing & Production',
    aliases: ['manufacturing', 'production', 'factory', 'assembly', 'machinist', 'quality control', 'plant'] },
  { id: 'engineering',    icon: '📐', label: 'Engineering & Architecture',
    aliases: ['mechanical engineer', 'civil engineer', 'electrical engineer', 'architecture', 'architect', 'drafting', 'cad', 'surveying'] },
  { id: 'science',        icon: '🔬', label: 'Science & Research',
    aliases: ['science', 'scientist', 'research', 'laboratory', 'lab tech', 'lab', 'chemistry', 'biology', 'clinical research'] },
  { id: 'socialcare',     icon: '🫂', label: 'Social Work & Counselling',
    aliases: ['social work', 'social worker', 'counselling', 'counseling', 'counselor', 'therapy', 'therapist', 'case manager', 'mental health'] },
  { id: 'publicservice',  icon: '🏛️', label: 'Government & Nonprofit',
    aliases: ['government', 'public sector', 'nonprofit', 'non-profit', 'ngo', 'policy', 'civil service', 'military', 'police', 'firefighter', 'security guard'] },
  { id: 'realestate',     icon: '🏠', label: 'Real Estate & Property',
    aliases: ['real estate', 'property', 'leasing', 'property management', 'appraisal', 'mortgage'] },
  { id: 'agriculture',    icon: '🌱', label: 'Agriculture & Environment',
    aliases: ['agriculture', 'farming', 'farm', 'environmental', 'sustainability', 'forestry', 'horticulture'] },
  { id: 'personal',       icon: '💪', label: 'Beauty, Fitness & Wellness',
    aliases: ['fitness', 'personal trainer', 'gym', 'beauty', 'hair', 'hairdresser', 'barber', 'stylist', 'salon', 'massage', 'esthetician', 'yoga'] },
];

// What the coach offers before "More fields" is tapped.
export const PRIMARY_SECTORS = JOB_SECTORS.filter((s) => s.primary);

export const SECTOR_TITLES = {
  tech: [
    'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
    'Senior Frontend Engineer', 'Senior Backend Engineer', 'Software Engineer',
    'Mobile Developer (iOS)', 'Mobile Developer (Android)', 'DevOps Engineer',
    'Site Reliability Engineer', 'Cloud Engineer', 'Security Engineer',
    'QA Engineer', 'Engineering Manager', 'Tech Lead', 'Staff Engineer',
    'Machine Learning Engineer', 'AI Engineer',
    'IT Support Specialist', 'Help Desk Technician', 'Systems Administrator',
    'Network Engineer', 'IT Manager',
  ],
  design: [
    'UX Designer', 'UI Designer', 'Product Designer',
    'Senior Product Designer', 'Visual Designer', 'Brand Designer',
    'Motion Designer', 'Illustrator', 'Design Lead',
    'Design Manager', 'UX Researcher', 'Content Designer',
  ],
  marketing: [
    'Marketing Manager', 'Digital Marketing Manager', 'Content Marketer',
    'SEO Specialist', 'Growth Marketer', 'Performance Marketing Manager',
    'Email Marketing Manager', 'Social Media Manager', 'Brand Manager',
    'Product Marketing Manager', 'Head of Marketing', 'CMO',
  ],
  sales: [
    'Sales Development Rep', 'Account Executive', 'Senior Account Executive',
    'Account Manager', 'Customer Success Manager', 'Business Development Rep',
    'Enterprise AE', 'Sales Manager', 'VP of Sales',
  ],
  finance: [
    'Financial Analyst', 'Senior Financial Analyst', 'Accountant',
    'Senior Accountant', 'Controller', 'FP&A Manager',
    'Finance Manager', 'CFO', 'Auditor', 'Tax Specialist',
  ],
  product: [
    'Associate Product Manager', 'Product Manager', 'Senior Product Manager',
    'Group Product Manager', 'Director of Product', 'VP of Product',
    'Product Operations Manager', 'Technical Product Manager',
  ],
  data: [
    'Data Analyst', 'Senior Data Analyst', 'Data Scientist',
    'Senior Data Scientist', 'Data Engineer', 'Analytics Engineer',
    'BI Developer', 'ML Engineer', 'AI Scientist',
  ],
  operations: [
    'Operations Manager', 'Project Manager', 'Program Manager',
    'Technical Program Manager', 'Chief of Staff', 'Business Operations',
    'Strategy & Operations', 'Director of Operations',
  ],
  healthcare: [
    'Registered Nurse', 'Nurse Practitioner', 'Physician',
    'Medical Assistant', 'Pharmacist', 'Physical Therapist',
    'Healthcare Administrator', 'Clinical Research Coordinator',
    'Certified Nursing Assistant', 'Home Health Aide', 'Caregiver',
    'Medical Receptionist', 'Dental Assistant', 'Dental Hygienist',
    'Pharmacy Technician', 'Paramedic / EMT', 'Veterinary Technician',
    'Medical Billing Specialist',
  ],
  education: [
    'Teacher', 'Curriculum Developer', 'Instructional Designer',
    'Education Coordinator', 'School Counselor', 'Principal',
    'Professor', 'Academic Advisor', 'Teaching Assistant',
    'Substitute Teacher', 'Early Childhood Educator', 'Childcare Worker',
    'Special Education Teacher', 'Corporate Trainer', 'Tutor',
  ],
  legal: [
    'Paralegal', 'Associate Attorney', 'Senior Attorney',
    'Corporate Counsel', 'General Counsel', 'Legal Operations Manager',
    'Compliance Officer', 'Contract Manager',
  ],
  hr: [
    'HR Generalist', 'HR Business Partner', 'Recruiter',
    'Senior Recruiter', 'Talent Acquisition Manager', 'People Operations',
    'HR Manager', 'Head of People', 'Compensation Analyst',
  ],
  support: [
    'Customer Support Specialist', 'Customer Service Representative',
    'Technical Support Engineer', 'Support Team Lead', 'Customer Success Manager',
    'Client Services Manager', 'Call Center Agent', 'Help Desk Technician',
    'Head of Customer Experience',
  ],
  admin: [
    'Administrative Assistant', 'Executive Assistant', 'Office Manager',
    'Receptionist', 'Data Entry Clerk', 'Office Administrator',
    'Scheduling Coordinator', 'Virtual Assistant', 'Facilities Coordinator',
  ],
  media: [
    'Content Writer', 'Copywriter', 'Journalist', 'Editor',
    'Technical Writer', 'Public Relations Manager', 'Communications Manager',
    'Video Producer', 'Photographer', 'Podcast Producer', 'Social Media Editor',
  ],
  logistics: [
    'Warehouse Associate', 'Warehouse Supervisor', 'Truck Driver',
    'Delivery Driver', 'Forklift Operator', 'Logistics Coordinator',
    'Supply Chain Analyst', 'Dispatcher', 'Inventory Manager',
    'Procurement Specialist', 'Fleet Manager',
  ],
  manufacturing: [
    'Production Associate', 'Machine Operator', 'Assembly Technician',
    'Production Supervisor', 'Quality Control Inspector', 'Manufacturing Engineer',
    'Plant Manager', 'Maintenance Technician', 'CNC Machinist',
  ],
  trades: [
    'Electrician', 'Plumber', 'HVAC Technician', 'Carpenter', 'Welder',
    'Automotive Technician', 'Construction Worker', 'Site Supervisor',
    'Construction Project Manager', 'Heavy Equipment Operator',
    'Facilities Maintenance Technician', 'Landscaper',
  ],
  engineering: [
    'Mechanical Engineer', 'Civil Engineer', 'Electrical Engineer',
    'Industrial Engineer', 'Structural Engineer', 'Process Engineer',
    'Architect', 'CAD Drafter', 'Project Engineer', 'Field Engineer',
  ],
  science: [
    'Laboratory Technician', 'Research Assistant', 'Research Scientist',
    'Chemist', 'Biologist', 'Clinical Research Associate',
    'Quality Assurance Scientist', 'Environmental Scientist', 'Lab Manager',
  ],
  socialcare: [
    'Social Worker', 'Case Manager', 'Mental Health Counselor',
    'Therapist', 'Substance Abuse Counselor', 'Youth Worker',
    'Community Outreach Coordinator', 'Support Worker', 'Program Director',
  ],
  publicservice: [
    'Program Coordinator', 'Policy Analyst', 'Program Manager (Nonprofit)',
    'Grant Writer', 'Development Manager', 'Public Health Officer',
    'Administrative Officer', 'Police Officer', 'Firefighter', 'Security Officer',
  ],
  hospitality: [
    'Server', 'Bartender', 'Barista', 'Line Cook', 'Chef', 'Sous Chef',
    'Restaurant Manager', 'Host', 'Hotel Front Desk Agent', 'Housekeeper',
    'Retail Sales Associate', 'Cashier', 'Store Manager', 'Assistant Store Manager',
    'Event Coordinator',
  ],
  realestate: [
    'Real Estate Agent', 'Realtor', 'Property Manager', 'Leasing Consultant',
    'Real Estate Analyst', 'Mortgage Loan Officer', 'Appraiser',
    'Facilities Manager', 'Real Estate Broker',
  ],
  agriculture: [
    'Farm Worker', 'Farm Manager', 'Agronomist', 'Greenhouse Technician',
    'Environmental Technician', 'Sustainability Coordinator', 'Forestry Technician',
    'Landscape Designer',
  ],
  personal: [
    'Personal Trainer', 'Fitness Instructor', 'Yoga Instructor',
    'Hair Stylist', 'Barber', 'Esthetician', 'Massage Therapist',
    'Nail Technician', 'Salon Manager', 'Wellness Coach',
  ],
};

export const ALL_TITLES = Array.from(
  new Set(Object.values(SECTOR_TITLES).flat())
);

export const SECTOR_SKILLS = {
  tech: {
    Languages: ['JavaScript', 'TypeScript', 'Python', 'Go', 'Java', 'Ruby', 'C#', 'C++', 'Rust', 'PHP', 'Swift', 'Kotlin'],
    Frontend: ['React', 'Vue.js', 'Angular', 'Next.js', 'Svelte', 'Tailwind CSS', 'Redux', 'GraphQL'],
    Backend: ['Node.js', 'Express', 'Django', 'Flask', 'Spring Boot', 'Rails', 'FastAPI', '.NET'],
    'Cloud & DevOps': ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Linux'],
    Databases: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'DynamoDB'],
  },
  design: {
    Tools: ['Figma', 'Sketch', 'Adobe XD', 'Photoshop', 'Illustrator', 'After Effects', 'Framer', 'Webflow'],
    Disciplines: ['UI Design', 'UX Design', 'Interaction Design', 'Prototyping', 'Wireframing', 'Design Systems', 'Branding', 'Typography'],
    Research: ['User Research', 'Usability Testing', 'A/B Testing', 'Personas', 'Journey Mapping'],
  },
  marketing: {
    Channels: ['SEO', 'SEM', 'Email Marketing', 'Social Media', 'Content Marketing', 'Influencer Marketing', 'Affiliate'],
    Tools: ['Google Analytics', 'HubSpot', 'Marketo', 'Mailchimp', 'Hootsuite', 'SEMrush', 'Ahrefs'],
    Skills: ['Copywriting', 'Brand Strategy', 'Campaign Management', 'A/B Testing', 'CRM', 'Lead Generation'],
  },
  sales: {
    Tools: ['Salesforce', 'HubSpot CRM', 'Outreach', 'Salesloft', 'Gong', 'LinkedIn Sales Navigator'],
    Skills: ['Cold Outreach', 'Discovery Calls', 'Negotiation', 'Pipeline Management', 'Forecasting', 'Account Management', 'Closing'],
  },
  finance: {
    Software: ['Excel', 'QuickBooks', 'NetSuite', 'SAP', 'Oracle Financials', 'Tableau', 'Power BI'],
    Disciplines: ['Financial Modeling', 'Forecasting', 'Budgeting', 'GAAP', 'IFRS', 'Audit', 'Tax', 'M&A'],
  },
  product: {
    Skills: ['Roadmapping', 'User Research', 'A/B Testing', 'OKRs', 'Agile/Scrum', 'Stakeholder Management', 'Go-to-Market'],
    Tools: ['Jira', 'Linear', 'Notion', 'Productboard', 'Amplitude', 'Mixpanel', 'Figma'],
  },
  data: {
    Languages: ['SQL', 'Python', 'R', 'Scala'],
    Tools: ['Tableau', 'Power BI', 'Looker', 'dbt', 'Snowflake', 'Airflow', 'Spark', 'Databricks'],
    'ML & Stats': ['Statistics', 'Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision', 'PyTorch', 'TensorFlow', 'scikit-learn'],
  },
  operations: {
    Skills: ['Process Improvement', 'Project Management', 'Vendor Management', 'Supply Chain', 'Lean', 'Six Sigma'],
    Tools: ['Asana', 'Jira', 'Monday', 'Smartsheet', 'Excel', 'SQL'],
  },
  healthcare: {
    Clinical: ['Patient Care', 'EMR/EHR', 'Triage', 'Phlebotomy', 'Vital Signs', 'HIPAA Compliance'],
    Specialties: ['Pediatrics', 'Geriatrics', 'Emergency', 'ICU', 'Oncology', 'Cardiology'],
  },
  education: {
    Skills: ['Curriculum Design', 'Lesson Planning', 'Classroom Management', 'Assessment', 'Differentiated Instruction', 'IEP'],
    Tools: ['Google Classroom', 'Canvas', 'Blackboard', 'Schoology', 'Zoom'],
  },
  legal: {
    Areas: ['Contract Law', 'Corporate Law', 'IP', 'Employment Law', 'Compliance', 'Litigation', 'M&A'],
    Skills: ['Legal Research', 'Drafting', 'Negotiation', 'Due Diligence', 'Westlaw', 'LexisNexis'],
  },
  hr: {
    Skills: ['Recruiting', 'Talent Acquisition', 'Onboarding', 'Performance Management', 'Compensation', 'Employee Relations', 'HRIS'],
    Tools: ['Workday', 'BambooHR', 'Greenhouse', 'Lever', 'ADP', 'LinkedIn Recruiter'],
  },
  support: {
    Skills: ['Customer Service', 'Troubleshooting', 'De-escalation', 'Ticket Triage', 'Onboarding', 'Account Management', 'SLA Management', 'Churn Reduction'],
    Tools: ['Zendesk', 'Intercom', 'Freshdesk', 'Salesforce Service Cloud', 'Jira Service Management', 'Live Chat'],
  },
  admin: {
    Skills: ['Calendar Management', 'Travel Coordination', 'Data Entry', 'Minute Taking', 'Expense Reports', 'Office Management', 'Vendor Coordination', 'Bookkeeping'],
    Tools: ['Microsoft Office', 'Google Workspace', 'Outlook', 'Excel', 'Concur', 'DocuSign', 'Slack'],
  },
  media: {
    Skills: ['Copywriting', 'Editing', 'Interviewing', 'Research', 'Storytelling', 'SEO Writing', 'Press Releases', 'Media Relations', 'Video Editing'],
    Tools: ['WordPress', 'Adobe Premiere', 'Final Cut Pro', 'Canva', 'Contentful', 'Cision', 'Lightroom'],
  },
  logistics: {
    Skills: ['Inventory Management', 'Order Fulfillment', 'Route Planning', 'Shipping & Receiving', 'Forklift Operation', 'Freight Coordination', 'Procurement', 'Safety Compliance'],
    Tools: ['SAP', 'Oracle SCM', 'WMS', 'Excel', 'ERP Systems', 'Fleet Management Software'],
    Credentials: ['CDL', 'Forklift Certification', 'OSHA 10', 'Hazmat'],
  },
  manufacturing: {
    Skills: ['Assembly', 'Machine Operation', 'Quality Control', 'Lean Manufacturing', 'Six Sigma', 'Blueprint Reading', 'Preventive Maintenance', 'Safety Compliance'],
    Tools: ['CNC', 'SolidWorks', 'AutoCAD', 'ERP Systems', 'SPC', 'Kaizen'],
  },
  trades: {
    Skills: ['Blueprint Reading', 'Electrical Wiring', 'Plumbing', 'HVAC Installation', 'Welding', 'Carpentry', 'Troubleshooting', 'Preventive Maintenance', 'Site Safety'],
    Credentials: ['Journeyman License', 'Master Electrician', 'EPA 608', 'OSHA 30', 'Forklift Certification', 'First Aid'],
  },
  engineering: {
    Skills: ['CAD', 'Structural Analysis', 'Project Engineering', 'Technical Drawings', 'Failure Analysis', 'Cost Estimation', 'Site Inspection', 'Building Codes'],
    Tools: ['AutoCAD', 'SolidWorks', 'Revit', 'MATLAB', 'ANSYS', 'Civil 3D', 'Bluebeam'],
    Credentials: ['PE License', 'EIT', 'LEED', 'PMP'],
  },
  science: {
    Skills: ['Laboratory Techniques', 'Experimental Design', 'Data Analysis', 'Scientific Writing', 'GLP', 'Sample Preparation', 'Chromatography', 'Microscopy'],
    Tools: ['Python', 'R', 'MATLAB', 'LIMS', 'SPSS', 'GraphPad Prism'],
  },
  socialcare: {
    Skills: ['Case Management', 'Crisis Intervention', 'Counselling', 'Motivational Interviewing', 'Care Planning', 'Advocacy', 'Group Facilitation', 'Safeguarding'],
    Credentials: ['LCSW', 'LPC', 'MSW', 'CPR/First Aid', 'Mental Health First Aid'],
  },
  publicservice: {
    Skills: ['Program Management', 'Grant Writing', 'Policy Analysis', 'Stakeholder Engagement', 'Community Outreach', 'Budget Management', 'Volunteer Coordination', 'Reporting'],
    Tools: ['Salesforce Nonprofit', 'Raiser\'s Edge', 'Excel', 'Tableau', 'GIS'],
  },
  hospitality: {
    Skills: ['Customer Service', 'Cash Handling', 'POS Systems', 'Food Safety', 'Upselling', 'Inventory Management', 'Merchandising', 'Team Supervision', 'Scheduling'],
    Credentials: ['Food Handler Card', 'ServSafe', 'Alcohol Service Permit', 'First Aid'],
  },
  realestate: {
    Skills: ['Property Management', 'Client Relations', 'Negotiation', 'Market Analysis', 'Leasing', 'Contract Review', 'Property Marketing', 'Tenant Relations'],
    Tools: ['MLS', 'Yardi', 'AppFolio', 'CoStar', 'DocuSign', 'Salesforce'],
    Credentials: ['Real Estate License', 'Broker License'],
  },
  agriculture: {
    Skills: ['Crop Management', 'Irrigation', 'Equipment Operation', 'Soil Testing', 'Pest Management', 'Harvesting', 'Environmental Monitoring', 'Sustainability Reporting'],
    Credentials: ['Pesticide Applicator License', 'CDL', 'OSHA 10'],
  },
  personal: {
    Skills: ['Client Consultation', 'Program Design', 'Nutrition Coaching', 'Group Instruction', 'Hair Cutting', 'Colouring', 'Skincare Treatments', 'Retail Sales', 'Booking Management'],
    Credentials: ['NASM', 'ACE', 'Cosmetology License', 'Massage Therapy License', 'CPR/First Aid'],
  },
};

// Flat default skills shown when no sector is selected.
export const ALL_SKILLS = {
  Communication: ['Written Communication', 'Public Speaking', 'Presentation', 'Storytelling'],
  Leadership: ['Team Leadership', 'Mentoring', 'Coaching', 'Cross-functional Collaboration'],
  Technical: ['JavaScript', 'Python', 'SQL', 'Excel', 'Git'],
  Design: ['Figma', 'UI Design', 'UX Research'],
  Business: ['Strategy', 'Project Management', 'Stakeholder Management', 'Negotiation'],
  Data: ['Analytics', 'Data Visualization', 'A/B Testing'],
};

export const EMPLOYMENT_TYPES = [
  { id: 'full-time', label: 'Full-time', icon: '💼' },
  { id: 'part-time', label: 'Part-time', icon: '⏰' },
  { id: 'contract', label: 'Contract', icon: '📝' },
  { id: 'freelance', label: 'Freelance', icon: '🌍' },
  { id: 'internship', label: 'Internship', icon: '🎓' },
];

export const CAREER_STAGES = [
  { id: 'experienced', label: 'I have work experience', sub: 'Full-time, part-time or contract roles', icon: '💼' },
  { id: 'internship', label: 'Only internships so far', sub: "I've done internships or co-ops", icon: '🎓' },
  { id: 'new_grad', label: "I'm a new grad / student", sub: 'Just finished school, no full-time yet', icon: '🌱' },
  { id: 'career_change', label: 'Changing careers', sub: 'Pivoting from a different field', icon: '🔄' },
  { id: 'self_taught', label: 'Self-taught / bootcamp', sub: 'Learned outside traditional channels', icon: '🛠️' },
];
