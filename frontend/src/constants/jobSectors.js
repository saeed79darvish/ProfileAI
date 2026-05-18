/* ═══════════════════════════════════════════════════════
   JOB SECTORS – Industry categories, titles, and skills
   Used by JobPreferencesWizard and other onboarding flows
   ═══════════════════════════════════════════════════════ */

export const JOB_SECTORS = [
  { id: 'technology', label: 'Technology & Engineering', icon: '💻' },
  { id: 'marketing', label: 'Marketing & Communications', icon: '📣' },
  { id: 'design', label: 'Design & Creative', icon: '🎨' },
  { id: 'education', label: 'Education & Training', icon: '📚' },
  { id: 'sales', label: 'Sales & Business Development', icon: '🤝' },
  { id: 'healthcare', label: 'Healthcare & Medical', icon: '🏥' },
  { id: 'finance', label: 'Finance & Accounting', icon: '💰' },
  { id: 'legal', label: 'Legal & Compliance', icon: '⚖️' },
  { id: 'operations', label: 'Operations & Logistics', icon: '📦' },
  { id: 'hr', label: 'Human Resources', icon: '👥' },
  { id: 'hospitality', label: 'Hospitality & Service', icon: '🏨' },
  { id: 'therapy', label: 'Therapy & Counseling', icon: '🧠' },
  { id: 'realestate', label: 'Real Estate', icon: '🏠' },
  { id: 'science', label: 'Science & Research', icon: '🔬' },
  { id: 'construction', label: 'Construction & Trades', icon: '🔧' },
  { id: 'government', label: 'Government & Public Service', icon: '🏛️' },
  { id: 'media', label: 'Media & Journalism', icon: '📰' },
  { id: 'agriculture', label: 'Agriculture & Environment', icon: '🌱' },
  { id: 'nonprofit', label: 'Nonprofit & Social Work', icon: '❤️' },
  { id: 'other', label: 'Other', icon: '🌐' },
];

export const SECTOR_TITLES = {
  technology: [
    'Software Engineer', 'Frontend Developer', 'Backend Developer',
    'Full Stack Developer', 'Data Scientist', 'DevOps Engineer',
    'Mobile Developer', 'Machine Learning Engineer', 'QA Engineer',
    'Cloud Architect', 'Security Engineer', 'Data Engineer',
    'Technical Writer', 'Systems Administrator', 'Site Reliability Engineer'
  ],
  marketing: [
    'Marketing Manager', 'Digital Marketing Specialist', 'Content Strategist',
    'SEO Specialist', 'Social Media Manager', 'Brand Manager',
    'Marketing Analyst', 'Email Marketing Manager', 'Growth Marketer',
    'Public Relations Manager', 'Communications Director', 'Copywriter',
    'Marketing Coordinator', 'Demand Generation Manager', 'Product Marketing Manager'
  ],
  design: [
    'UX Designer', 'UI Designer', 'Graphic Designer', 'Product Designer',
    'Visual Designer', 'Motion Designer', 'Brand Designer', 'Creative Director',
    'Design Lead', 'Interaction Designer', 'UX Researcher',
    'Art Director', 'Illustrator', 'Web Designer', '3D Designer'
  ],
  education: [
    'Teacher', 'Professor', 'Instructional Designer', 'Curriculum Developer',
    'School Administrator', 'Academic Advisor', 'Tutor', 'E-Learning Developer',
    'Training Specialist', 'Education Coordinator', 'School Counselor',
    'Librarian', 'Dean', 'Special Education Teacher', 'Teaching Assistant'
  ],
  sales: [
    'Sales Representative', 'Account Executive', 'Sales Manager',
    'Business Development Representative', 'Account Manager', 'Sales Director',
    'Inside Sales Representative', 'Sales Engineer', 'Regional Sales Manager',
    'Channel Sales Manager', 'Enterprise Sales Executive', 'Client Success Manager',
    'Sales Operations Analyst', 'Key Account Manager', 'Territory Manager'
  ],
  healthcare: [
    'Registered Nurse', 'Physician', 'Medical Assistant', 'Pharmacist',
    'Physical Therapist', 'Healthcare Administrator', 'Lab Technician',
    'Nurse Practitioner', 'Clinical Research Coordinator', 'Dental Hygienist',
    'Occupational Therapist', 'Radiologic Technologist', 'EMT / Paramedic',
    'Health Information Technician', 'Speech-Language Pathologist'
  ],
  finance: [
    'Financial Analyst', 'Accountant', 'Auditor', 'Investment Banker',
    'Financial Advisor', 'Controller', 'Tax Specialist', 'Risk Analyst',
    'Portfolio Manager', 'Budget Analyst', 'CFO', 'Bookkeeper',
    'Compliance Officer', 'Credit Analyst', 'Treasury Analyst'
  ],
  legal: [
    'Attorney', 'Paralegal', 'Legal Analyst', 'Compliance Manager',
    'Contract Manager', 'General Counsel', 'Legal Secretary',
    'Litigation Associate', 'Corporate Lawyer', 'IP Attorney',
    'Legal Operations Manager', 'Regulatory Affairs Specialist',
    'Legal Consultant', 'Law Clerk', 'Mediator'
  ],
  operations: [
    'Operations Manager', 'Supply Chain Manager', 'Logistics Coordinator',
    'Warehouse Manager', 'Production Manager', 'Quality Assurance Manager',
    'Procurement Specialist', 'Inventory Manager', 'Facilities Manager',
    'Distribution Manager', 'Process Improvement Specialist', 'Plant Manager',
    'Fleet Manager', 'Import / Export Specialist', 'Supply Chain Analyst'
  ],
  hr: [
    'HR Manager', 'Recruiter', 'HR Business Partner', 'Talent Acquisition Specialist',
    'Compensation & Benefits Analyst', 'HR Coordinator', 'People Operations Manager',
    'Employee Relations Specialist', 'Training & Development Manager',
    'HR Director', 'Payroll Specialist', 'Diversity & Inclusion Manager',
    'HRIS Analyst', 'Organizational Development Specialist', 'HR Generalist'
  ],
  hospitality: [
    'Hotel Manager', 'Restaurant Manager', 'Event Coordinator',
    'Executive Chef', 'Front Desk Manager', 'Catering Manager',
    'Travel Agent', 'Concierge', 'Food & Beverage Director',
    'Housekeeping Manager', 'Guest Relations Manager', 'Sous Chef',
    'Banquet Manager', 'Tourism Director', 'Resort Manager'
  ],
  therapy: [
    'Licensed Professional Counselor', 'Marriage & Family Therapist',
    'Clinical Psychologist', 'School Counselor', 'Substance Abuse Counselor',
    'Art Therapist', 'Music Therapist', 'Occupational Therapist',
    'Behavioral Therapist', 'Licensed Clinical Social Worker',
    'Psychiatrist', 'Rehabilitation Counselor', 'Grief Counselor',
    'Play Therapist', 'Speech Therapist'
  ],
  realestate: [
    'Real Estate Agent', 'Real Estate Broker', 'Property Manager',
    'Leasing Consultant', 'Real Estate Appraiser', 'Commercial Real Estate Agent',
    'Real Estate Analyst', 'Mortgage Loan Officer', 'Real Estate Developer',
    'Escrow Officer', 'Home Inspector', 'Real Estate Marketing Specialist',
    'Real Estate Investment Analyst', 'Relocation Specialist', 'Title Officer'
  ],
  science: [
    'Research Scientist', 'Lab Technician', 'Biomedical Researcher',
    'Environmental Scientist', 'Chemist', 'Physicist', 'Microbiologist',
    'Epidemiologist', 'Data Scientist', 'Geologist',
    'Marine Biologist', 'Research Assistant', 'Clinical Researcher',
    'Materials Scientist', 'Ecologist'
  ],
  construction: [
    'Construction Manager', 'Electrician', 'Plumber', 'Carpenter',
    'HVAC Technician', 'Civil Engineer', 'Architect', 'Surveyor',
    'Safety Manager', 'Project Superintendent', 'Estimator',
    'Welder', 'Heavy Equipment Operator', 'Building Inspector',
    'Interior Designer'
  ],
  government: [
    'Policy Analyst', 'City Planner', 'Public Administrator',
    'Legislative Aide', 'Government Affairs Specialist', 'Intelligence Analyst',
    'Foreign Service Officer', 'Grants Manager', 'Program Manager',
    'Public Information Officer', 'Budget Analyst', 'Social Services Director',
    'Emergency Management Director', 'Immigration Officer', 'Tax Examiner'
  ],
  media: [
    'Journalist', 'Reporter', 'News Anchor', 'Editor',
    'Producer', 'Videographer', 'Podcast Host', 'Social Media Manager',
    'Photojournalist', 'Content Creator', 'Broadcast Technician',
    'Communications Specialist', 'Public Relations Specialist',
    'Media Buyer', 'Scriptwriter'
  ],
  agriculture: [
    'Farm Manager', 'Agricultural Engineer', 'Agronomist',
    'Environmental Consultant', 'Forestry Technician', 'Wildlife Biologist',
    'Sustainability Coordinator', 'Conservation Scientist', 'Horticulturist',
    'Food Scientist', 'Soil Scientist', 'Ranch Manager',
    'Irrigation Specialist', 'Agricultural Inspector', 'Landscape Architect'
  ],
  nonprofit: [
    'Program Director', 'Development Manager', 'Grant Writer',
    'Community Organizer', 'Volunteer Coordinator', 'Social Worker',
    'Case Manager', 'Advocacy Director', 'Fundraiser',
    'Outreach Coordinator', 'Executive Director', 'Donor Relations Manager',
    'Impact Analyst', 'Youth Services Coordinator', 'Homeless Services Specialist'
  ],
  other: [
    'Product Manager', 'Project Manager', 'Business Analyst',
    'Scrum Master', 'Consultant', 'Entrepreneur',
    'Researcher', 'Writer', 'Photographer',
    'Translator', 'Customer Support Specialist', 'Administrative Assistant',
    'Executive Assistant', 'Data Analyst', 'Sustainability Specialist'
  ]
};

export const SECTOR_SKILLS = {
  technology: {
    'Programming': [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go',
      'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala', 'R'
    ],
    'Frontend': [
      'React', 'Vue.js', 'Angular', 'Next.js', 'Svelte', 'HTML/CSS',
      'Tailwind CSS', 'Redux', 'GraphQL', 'Webpack'
    ],
    'Backend & Cloud': [
      'Node.js', 'Express.js', 'Django', 'Flask', 'Spring Boot',
      'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform'
    ],
    'Data & AI': [
      'SQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch',
      'TensorFlow', 'PyTorch', 'Pandas', 'Spark', 'Tableau'
    ],
    'General': [
      'Agile/Scrum', 'Git', 'CI/CD', 'System Design', 'Testing',
      'Technical Writing', 'Code Review', 'API Design'
    ]
  },
  marketing: {
    'Digital Marketing': [
      'SEO', 'SEM', 'PPC Advertising', 'Google Analytics', 'Google Ads',
      'Social Media Marketing', 'Email Marketing', 'Marketing Automation'
    ],
    'Content & Creative': [
      'Content Strategy', 'Copywriting', 'Blog Writing', 'Content Marketing',
      'Video Marketing', 'Podcasting', 'Brand Storytelling'
    ],
    'Analytics & Tools': [
      'HubSpot', 'Mailchimp', 'Hootsuite', 'Salesforce', 'Google Tag Manager',
      'A/B Testing', 'Conversion Optimization', 'Data Analysis'
    ],
    'Strategy': [
      'Market Research', 'Competitive Analysis', 'Brand Management',
      'Campaign Management', 'Growth Hacking', 'Customer Segmentation', 'Lead Generation'
    ]
  },
  design: {
    'Design Tools': [
      'Figma', 'Sketch', 'Adobe XD', 'Adobe Photoshop', 'Adobe Illustrator',
      'InDesign', 'After Effects', 'Blender'
    ],
    'UX / UI': [
      'User Research', 'Wireframing', 'Prototyping', 'Usability Testing',
      'Information Architecture', 'Interaction Design', 'Design Systems'
    ],
    'Visual & Brand': [
      'Typography', 'Color Theory', 'Brand Identity', 'Logo Design',
      'Layout Design', 'Print Design', 'Packaging Design'
    ],
    'Motion & 3D': [
      'Motion Graphics', 'Video Editing', '3D Modeling', 'Animation',
      'AR/VR Design', 'Game Design'
    ]
  },
  education: {
    'Teaching': [
      'Curriculum Development', 'Lesson Planning', 'Classroom Management',
      'Differentiated Instruction', 'Assessment Design', 'Student Engagement'
    ],
    'EdTech': [
      'LMS Administration', 'E-Learning Development', 'Educational Technology',
      'Virtual Classroom Tools', 'Moodle', 'Canvas', 'Google Classroom'
    ],
    'Administration': [
      'Accreditation', 'Academic Advising', 'Student Affairs',
      'Grant Writing', 'Program Development', 'Budget Management'
    ],
    'Specialized': [
      'Special Education', 'ESL / ELL', 'Early Childhood Education',
      'STEM Education', 'Research Methods', 'Academic Writing'
    ]
  },
  sales: {
    'Sales Skills': [
      'Prospecting', 'Cold Calling', 'Negotiation', 'Closing',
      'Pipeline Management', 'Account Management', 'Relationship Building'
    ],
    'Tools & CRM': [
      'Salesforce', 'HubSpot CRM', 'LinkedIn Sales Navigator', 'Outreach',
      'ZoomInfo', 'Gong', 'Salesloft'
    ],
    'Strategy': [
      'B2B Sales', 'B2C Sales', 'Enterprise Sales', 'Solution Selling',
      'Consultative Selling', 'Territory Planning', 'Sales Forecasting'
    ],
    'Client Success': [
      'Customer Retention', 'Upselling', 'Cross-selling',
      'Client Onboarding', 'Customer Success', 'Churn Reduction'
    ]
  },
  healthcare: {
    'Clinical': [
      'Patient Care', 'Clinical Assessment', 'Patient Education',
      'Vital Signs', 'Medication Administration', 'Wound Care', 'Triage'
    ],
    'Medical Knowledge': [
      'Anatomy & Physiology', 'Pharmacology', 'Medical Terminology',
      'Pathophysiology', 'Lab Values Interpretation'
    ],
    'Systems & Compliance': [
      'EHR/EMR Systems', 'HIPAA Compliance', 'ICD-10 Coding',
      'Medical Billing', 'Quality Improvement', 'Infection Control'
    ],
    'Specialized': [
      'BLS/ACLS Certified', 'Surgical Assistance', 'Radiology',
      'Physical Therapy', 'Mental Health', 'Nutrition Counseling'
    ]
  },
  finance: {
    'Analysis & Modeling': [
      'Financial Modeling', 'Financial Analysis', 'Valuation', 'Forecasting',
      'Budgeting', 'Cash Flow Analysis', 'Risk Assessment'
    ],
    'Accounting': [
      'GAAP', 'IFRS', 'Tax Preparation', 'Auditing',
      'Accounts Payable/Receivable', 'General Ledger', 'Reconciliation'
    ],
    'Tools': [
      'Excel', 'QuickBooks', 'SAP', 'Oracle Financials',
      'Bloomberg Terminal', 'Tableau', 'Power BI', 'SQL'
    ],
    'Specialized': [
      'Investment Analysis', 'Portfolio Management', 'Corporate Finance',
      'Mergers & Acquisitions', 'Compliance', 'Fintech'
    ]
  },
  legal: {
    'Practice Areas': [
      'Contract Law', 'Corporate Law', 'Litigation', 'Intellectual Property',
      'Employment Law', 'Real Estate Law', 'Criminal Law'
    ],
    'Legal Skills': [
      'Legal Research', 'Legal Writing', 'Contract Drafting', 'Negotiation',
      'Due Diligence', 'Regulatory Compliance', 'Case Management'
    ],
    'Tools': [
      'Westlaw', 'LexisNexis', 'Clio', 'eDiscovery Tools',
      'Document Management', 'Legal Analytics'
    ],
    'Soft Skills': [
      'Client Counseling', 'Oral Advocacy', 'Legal Analysis',
      'Conflict Resolution', 'Attention to Detail', 'Critical Thinking'
    ]
  },
  operations: {
    'Operations': [
      'Process Improvement', 'Lean Manufacturing', 'Six Sigma',
      'Supply Chain Management', 'Inventory Management', 'Quality Control'
    ],
    'Logistics': [
      'Warehouse Management', 'Distribution', 'Fleet Management',
      'Freight Management', 'Import/Export', 'Last Mile Delivery'
    ],
    'Tools & Systems': [
      'SAP', 'Oracle SCM', 'ERP Systems', 'WMS',
      'TMS', 'Excel', 'Power BI', 'Tableau'
    ],
    'Procurement': [
      'Vendor Management', 'Sourcing', 'Contract Negotiation',
      'Cost Reduction', 'Supplier Evaluation', 'Purchase Order Management'
    ]
  },
  hr: {
    'Talent Management': [
      'Recruiting', 'Interviewing', 'Onboarding', 'Performance Management',
      'Succession Planning', 'Employee Engagement'
    ],
    'HR Operations': [
      'Payroll', 'Benefits Administration', 'HRIS', 'Employee Relations',
      'Policy Development', 'HR Analytics'
    ],
    'Tools': [
      'Workday', 'BambooHR', 'ADP', 'Greenhouse',
      'Lever', 'LinkedIn Recruiter', 'SAP SuccessFactors'
    ],
    'Compliance & Development': [
      'Employment Law', 'DEI Programs', 'Training & Development',
      'Compensation Analysis', 'Organizational Development', 'Change Management'
    ]
  },
  hospitality: {
    'Operations': [
      'Hotel Operations', 'Restaurant Management', 'Event Planning',
      'Revenue Management', 'Guest Services', 'Housekeeping Management'
    ],
    'Food & Beverage': [
      'Menu Planning', 'Food Safety', 'Culinary Arts',
      'Beverage Management', 'Cost Control', 'Kitchen Management'
    ],
    'Customer Service': [
      'Guest Relations', 'Conflict Resolution', 'VIP Services',
      'Customer Satisfaction', 'Sales & Upselling', 'Multilingual Support'
    ],
    'Tools & Systems': [
      'Opera PMS', 'Micros POS', 'OpenTable', 'Hotel Booking Systems',
      'Event Management Software', 'Social Media Management'
    ]
  },
  therapy: {
    'Clinical Skills': [
      'Individual Therapy', 'Group Therapy', 'Family Therapy',
      'Cognitive Behavioral Therapy (CBT)', 'Dialectical Behavior Therapy (DBT)',
      'EMDR', 'Trauma-Informed Care', 'Crisis Intervention'
    ],
    'Assessment': [
      'Psychological Assessment', 'Diagnosis', 'Treatment Planning',
      'Risk Assessment', 'Intake Assessment', 'Mental Status Examination'
    ],
    'Specializations': [
      'Anxiety & Depression', 'Substance Abuse', 'Child & Adolescent',
      'Couples Therapy', 'Grief & Loss', 'Eating Disorders',
      'PTSD', 'Autism Spectrum', 'Play Therapy'
    ],
    'Tools & Compliance': [
      'EHR Systems', 'SimplePractice', 'TherapyNotes',
      'HIPAA Compliance', 'Insurance Billing', 'Telehealth Platforms',
      'Documentation', 'Outcome Measurement'
    ]
  },
  realestate: {
    'Sales & Transactions': [
      'Listing Presentation', 'Buyer Representation', 'Contract Negotiation',
      'Comparative Market Analysis', 'Closing Coordination', 'Open Houses'
    ],
    'Property Management': [
      'Tenant Screening', 'Lease Administration', 'Property Maintenance',
      'Rent Collection', 'Eviction Process', 'Vendor Management'
    ],
    'Market Knowledge': [
      'Market Analysis', 'Investment Analysis', 'Zoning Regulations',
      'Property Valuation', 'Commercial Real Estate', 'Land Development'
    ],
    'Tools': [
      'MLS Systems', 'Zillow Premier Agent', 'DocuSign', 'Salesforce',
      'CRM Software', 'Virtual Tour Software', 'Social Media Marketing'
    ]
  },
  science: {
    'Research Methods': [
      'Experimental Design', 'Statistical Analysis', 'Data Collection',
      'Literature Review', 'Peer Review', 'Grant Writing', 'Lab Management'
    ],
    'Technical Skills': [
      'PCR', 'Mass Spectrometry', 'Microscopy', 'Cell Culture',
      'Chromatography', 'Spectroscopy', 'Gene Sequencing'
    ],
    'Data & Software': [
      'R', 'Python', 'SPSS', 'MATLAB', 'SAS',
      'Excel', 'GraphPad Prism', 'Bioinformatics'
    ],
    'Communication': [
      'Scientific Writing', 'Journal Publication', 'Conference Presentation',
      'Grant Proposals', 'Technical Reports', 'Data Visualization'
    ]
  },
  construction: {
    'Technical Skills': [
      'Blueprint Reading', 'Building Codes', 'OSHA Compliance',
      'Structural Analysis', 'Welding', 'Electrical Wiring', 'Plumbing'
    ],
    'Management': [
      'Project Scheduling', 'Cost Estimation', 'Subcontractor Management',
      'Quality Control', 'Safety Management', 'Permit Acquisition'
    ],
    'Tools & Software': [
      'AutoCAD', 'Revit', 'Procore', 'Bluebeam', 'PlanGrid',
      'MS Project', 'SketchUp', 'Primavera P6'
    ],
    'Specialized': [
      'Green Building (LEED)', 'Concrete Work', 'Roofing',
      'Heavy Equipment Operation', 'Site Preparation', 'Demolition'
    ]
  },
  government: {
    'Policy & Analysis': [
      'Policy Analysis', 'Legislative Research', 'Regulatory Compliance',
      'Program Evaluation', 'Public Budgeting', 'Impact Assessment'
    ],
    'Administration': [
      'Government Procurement', 'Contract Management', 'Grant Administration',
      'Records Management', 'Public Administration', 'Interagency Coordination'
    ],
    'Communication': [
      'Public Speaking', 'Report Writing', 'Constituent Relations',
      'Media Relations', 'Community Engagement', 'Stakeholder Management'
    ],
    'Tools & Systems': [
      'SAP', 'GIS', 'FOIA Processing', 'Case Management Systems',
      'Data.gov', 'Federal Acquisition Regulation (FAR)', 'Security Clearance'
    ]
  },
  media: {
    'Content Creation': [
      'News Writing', 'Feature Writing', 'Investigative Journalism',
      'Video Production', 'Audio Production', 'Podcasting', 'Live Streaming'
    ],
    'Digital Skills': [
      'SEO', 'Social Media Management', 'Content Management Systems',
      'Email Newsletters', 'Analytics', 'Audience Development'
    ],
    'Tools': [
      'Adobe Premiere Pro', 'Final Cut Pro', 'Adobe Audition',
      'WordPress', 'Canva', 'OBS Studio', 'AP Style'
    ],
    'Business': [
      'Media Buying', 'Ad Sales', 'Audience Research',
      'Brand Partnerships', 'Public Relations', 'Crisis Communication'
    ]
  },
  agriculture: {
    'Farming & Production': [
      'Crop Management', 'Livestock Management', 'Irrigation Systems',
      'Soil Management', 'Pest Management', 'Harvest Planning', 'Organic Farming'
    ],
    'Environmental': [
      'Environmental Impact Assessment', 'Conservation Planning',
      'Sustainability Practices', 'Water Quality Management',
      'Wildlife Management', 'Reforestation'
    ],
    'Technical': [
      'GIS Mapping', 'Precision Agriculture', 'Drone Operation',
      'Lab Analysis', 'Agricultural Machinery', 'Food Safety (HACCP)'
    ],
    'Business': [
      'Farm Financial Planning', 'Supply Chain Management', 'Grant Writing',
      'Regulatory Compliance', 'Market Analysis', 'Cooperative Management'
    ]
  },
  nonprofit: {
    'Fundraising': [
      'Grant Writing', 'Donor Relations', 'Major Gifts',
      'Capital Campaigns', 'Annual Fund', 'Planned Giving', 'Crowdfunding'
    ],
    'Program Management': [
      'Program Design', 'Impact Measurement', 'Case Management',
      'Community Outreach', 'Volunteer Management', 'Needs Assessment'
    ],
    'Advocacy': [
      'Community Organizing', 'Policy Advocacy', 'Public Speaking',
      'Coalition Building', 'Legislative Advocacy', 'Social Justice'
    ],
    'Tools & Administration': [
      'Salesforce Nonprofit', 'Bloomerang', 'Raiser\'s Edge',
      'EveryAction', 'Grant Management Software', 'Budget Management',
      'Nonprofit Compliance', 'Board Management'
    ]
  },
  other: {
    'Business & Management': [
      'Project Management', 'Strategic Planning', 'Business Development',
      'Budgeting', 'Team Leadership', 'Stakeholder Management'
    ],
    'Communication': [
      'Public Speaking', 'Technical Writing', 'Presentation',
      'Translation', 'Editing', 'Research'
    ],
    'Tools & Software': [
      'Microsoft Office', 'Google Workspace', 'Slack', 'Asana',
      'Jira', 'Trello', 'Notion', 'Salesforce'
    ],
    'General Skills': [
      'Problem Solving', 'Critical Thinking', 'Adaptability',
      'Time Management', 'Teamwork', 'Customer Service', 'Data Analysis'
    ]
  }
};

/** Flat list of all titles across all sectors – used as a fallback */
export const ALL_TITLES = Object.values(SECTOR_TITLES).flat();

/** Merge all sector skills into one map – used when no sector is selected */
export const ALL_SKILLS = Object.values(SECTOR_SKILLS).reduce((acc, sectorSkills) => {
  Object.entries(sectorSkills).forEach(([cat, skills]) => {
    if (!acc[cat]) acc[cat] = [];
    skills.forEach(s => { if (!acc[cat].includes(s)) acc[cat].push(s); });
  });
  return acc;
}, {});
