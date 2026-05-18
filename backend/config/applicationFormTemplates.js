/**
 * Standard Application Form Templates
 * Common questions and fields used by companies for job applications
 */

// Standard field types
const FIELD_TYPES = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  EMAIL: 'email',
  PHONE: 'phone',
  URL: 'url',
  FILE: 'file',
  SELECT: 'select',
  RADIO: 'radio',
  CHECKBOX: 'checkbox',
  DATE: 'date',
  NUMBER: 'number'
};

// Standard application form questions
const STANDARD_QUESTIONS = {
  // Personal Information
  FULL_NAME: {
    id: 'full_name',
    question: 'Full Name',
    type: FIELD_TYPES.TEXT,
    required: true,
    category: 'personal',
    placeholder: 'John Doe'
  },
  EMAIL: {
    id: 'email',
    question: 'Email Address',
    type: FIELD_TYPES.EMAIL,
    required: true,
    category: 'personal',
    placeholder: 'john.doe@example.com'
  },
  PHONE: {
    id: 'phone',
    question: 'Phone Number',
    type: FIELD_TYPES.PHONE,
    required: true,
    category: 'personal',
    placeholder: '+1 (555) 123-4567'
  },
  LOCATION: {
    id: 'location',
    question: 'Current Location',
    type: FIELD_TYPES.TEXT,
    required: false,
    category: 'personal',
    placeholder: 'City, State/Country'
  },
  
  // Professional Documents
  RESUME: {
    id: 'resume',
    question: 'Resume/CV',
    type: FIELD_TYPES.FILE,
    required: true,
    category: 'documents',
    accept: '.pdf,.doc,.docx',
    maxSize: 5242880, // 5MB
    helpText: 'Upload your resume (PDF, DOC, or DOCX - Max 5MB)'
  },
  COVER_LETTER: {
    id: 'cover_letter',
    question: 'Cover Letter',
    type: FIELD_TYPES.TEXTAREA,
    required: false,
    category: 'documents',
    placeholder: 'Tell us why you\'re interested in this position...',
    maxLength: 2000
  },
  PORTFOLIO: {
    id: 'portfolio',
    question: 'Portfolio/Website URL',
    type: FIELD_TYPES.URL,
    required: false,
    category: 'documents',
    placeholder: 'https://yourportfolio.com'
  },
  LINKEDIN: {
    id: 'linkedin',
    question: 'LinkedIn Profile',
    type: FIELD_TYPES.URL,
    required: false,
    category: 'documents',
    placeholder: 'https://linkedin.com/in/yourprofile'
  },
  GITHUB: {
    id: 'github',
    question: 'GitHub Profile',
    type: FIELD_TYPES.URL,
    required: false,
    category: 'documents',
    placeholder: 'https://github.com/yourusername'
  },
  
  // Work Authorization & Availability
  WORK_AUTHORIZATION: {
    id: 'work_authorization',
    question: 'Are you legally authorized to work in [Country]?',
    type: FIELD_TYPES.RADIO,
    required: true,
    category: 'eligibility',
    options: ['Yes', 'No', 'Will require sponsorship']
  },
  REQUIRE_SPONSORSHIP: {
    id: 'require_sponsorship',
    question: 'Will you now or in the future require visa sponsorship?',
    type: FIELD_TYPES.RADIO,
    required: true,
    category: 'eligibility',
    options: ['Yes', 'No']
  },
  NOTICE_PERIOD: {
    id: 'notice_period',
    question: 'Notice Period / Availability to Start',
    type: FIELD_TYPES.SELECT,
    required: true,
    category: 'availability',
    options: [
      'Immediate',
      '2 weeks',
      '1 month',
      '2 months',
      '3+ months'
    ]
  },
  WILLING_TO_RELOCATE: {
    id: 'willing_to_relocate',
    question: 'Are you willing to relocate?',
    type: FIELD_TYPES.RADIO,
    required: false,
    category: 'availability',
    options: ['Yes', 'No', 'Depends on the opportunity']
  },
  
  // Experience & Qualifications
  YEARS_EXPERIENCE: {
    id: 'years_experience',
    question: 'Years of Relevant Experience',
    type: FIELD_TYPES.SELECT,
    required: true,
    category: 'experience',
    options: [
      'Less than 1 year',
      '1-2 years',
      '3-5 years',
      '6-10 years',
      '10+ years'
    ]
  },
  HIGHEST_EDUCATION: {
    id: 'highest_education',
    question: 'Highest Level of Education',
    type: FIELD_TYPES.SELECT,
    required: false,
    category: 'experience',
    options: [
      'High School',
      'Associate Degree',
      'Bachelor\'s Degree',
      'Master\'s Degree',
      'Doctorate/PhD',
      'Other'
    ]
  },
  
  // Work Experience Section
  WORK_EXPERIENCE: {
    id: 'work_experience',
    question: 'Work Experience',
    type: 'experience_list',
    required: false,
    category: 'experience',
    helpText: 'Add your relevant work experience (most recent first)',
    fields: [
      { name: 'company', label: 'Company Name', type: 'text', required: true },
      { name: 'title', label: 'Job Title', type: 'text', required: true },
      { name: 'startDate', label: 'Start Date', type: 'date', required: true },
      { name: 'endDate', label: 'End Date', type: 'date', required: false },
      { name: 'current', label: 'Currently Working Here', type: 'checkbox', required: false },
      { name: 'description', label: 'Description', type: 'textarea', required: false }
    ],
    maxItems: 10
  },
  
  // Education History Section
  EDUCATION_HISTORY: {
    id: 'education_history',
    question: 'Education History',
    type: 'education_list',
    required: false,
    category: 'experience',
    helpText: 'Add your educational background (most recent first)',
    fields: [
      { name: 'institution', label: 'Institution Name', type: 'text', required: true },
      { name: 'degree', label: 'Degree', type: 'text', required: true },
      { name: 'field', label: 'Field of Study', type: 'text', required: false },
      { name: 'startDate', label: 'Start Date', type: 'date', required: false },
      { name: 'endDate', label: 'End Date (or Expected)', type: 'date', required: false },
      { name: 'gpa', label: 'GPA (optional)', type: 'text', required: false }
    ],
    maxItems: 5
  },
  
  // Salary & Compensation
  SALARY_EXPECTATION: {
    id: 'salary_expectation',
    question: 'Salary Expectation (Annual)',
    type: FIELD_TYPES.NUMBER,
    required: false,
    category: 'compensation',
    placeholder: '80000',
    helpText: 'Enter your expected annual salary in USD'
  },
  SALARY_RANGE: {
    id: 'salary_range',
    question: 'Expected Salary Range',
    type: FIELD_TYPES.SELECT,
    required: false,
    category: 'compensation',
    options: [
      'Under $50k',
      '$50k - $75k',
      '$75k - $100k',
      '$100k - $150k',
      '$150k - $200k',
      '$200k+'
    ]
  },
  
  // Additional Questions
  HOW_DID_YOU_HEAR: {
    id: 'how_did_you_hear',
    question: 'How did you hear about this position?',
    type: FIELD_TYPES.SELECT,
    required: false,
    category: 'additional',
    options: [
      'Job Board',
      'LinkedIn',
      'Company Website',
      'Referral',
      'Recruiter',
      'Social Media',
      'Other'
    ]
  },
  REFERRAL_NAME: {
    id: 'referral_name',
    question: 'If referred, who referred you?',
    type: FIELD_TYPES.TEXT,
    required: false,
    category: 'additional',
    placeholder: 'Referrer\'s name',
    conditional: {
      field: 'how_did_you_hear',
      value: 'Referral'
    }
  },
  
  // Diversity & Equal Opportunity (Optional)
  GENDER: {
    id: 'gender',
    question: 'Gender (Optional - for diversity statistics)',
    type: FIELD_TYPES.SELECT,
    required: false,
    category: 'diversity',
    options: [
      'Male',
      'Female',
      'Non-binary',
      'Prefer not to say'
    ],
    helpText: 'This information is collected for diversity purposes only'
  },
  ETHNICITY: {
    id: 'ethnicity',
    question: 'Ethnicity (Optional - for diversity statistics)',
    type: FIELD_TYPES.SELECT,
    required: false,
    category: 'diversity',
    options: [
      'Asian',
      'Black or African American',
      'Hispanic or Latino',
      'White',
      'Native American',
      'Pacific Islander',
      'Two or more races',
      'Prefer not to say'
    ],
    helpText: 'This information is collected for diversity purposes only'
  },
  VETERAN_STATUS: {
    id: 'veteran_status',
    question: 'Are you a veteran? (Optional)',
    type: FIELD_TYPES.RADIO,
    required: false,
    category: 'diversity',
    options: ['Yes', 'No', 'Prefer not to say']
  },
  DISABILITY_STATUS: {
    id: 'disability_status',
    question: 'Do you have a disability? (Optional)',
    type: FIELD_TYPES.RADIO,
    required: false,
    category: 'diversity',
    options: ['Yes', 'No', 'Prefer not to say'],
    helpText: 'We are committed to providing reasonable accommodations'
  }
};

// Pre-built form templates
const FORM_TEMPLATES = {
  BASIC: {
    name: 'Basic Application',
    description: 'Essential information only',
    questions: [
      STANDARD_QUESTIONS.FULL_NAME,
      STANDARD_QUESTIONS.EMAIL,
      STANDARD_QUESTIONS.PHONE,
      STANDARD_QUESTIONS.RESUME,
      STANDARD_QUESTIONS.COVER_LETTER
    ]
  },
  
  STANDARD: {
    name: 'Standard Application',
    description: 'Most common application form with experience & education',
    questions: [
      STANDARD_QUESTIONS.FULL_NAME,
      STANDARD_QUESTIONS.EMAIL,
      STANDARD_QUESTIONS.PHONE,
      STANDARD_QUESTIONS.LOCATION,
      STANDARD_QUESTIONS.RESUME,
      STANDARD_QUESTIONS.COVER_LETTER,
      STANDARD_QUESTIONS.LINKEDIN,
      STANDARD_QUESTIONS.WORK_EXPERIENCE,
      STANDARD_QUESTIONS.EDUCATION_HISTORY,
      STANDARD_QUESTIONS.WORK_AUTHORIZATION,
      STANDARD_QUESTIONS.NOTICE_PERIOD,
      STANDARD_QUESTIONS.YEARS_EXPERIENCE,
      STANDARD_QUESTIONS.HOW_DID_YOU_HEAR
    ]
  },
  
  TECH_ROLE: {
    name: 'Tech Role Application',
    description: 'For software engineering and technical positions',
    questions: [
      STANDARD_QUESTIONS.FULL_NAME,
      STANDARD_QUESTIONS.EMAIL,
      STANDARD_QUESTIONS.PHONE,
      STANDARD_QUESTIONS.LOCATION,
      STANDARD_QUESTIONS.RESUME,
      STANDARD_QUESTIONS.COVER_LETTER,
      STANDARD_QUESTIONS.LINKEDIN,
      STANDARD_QUESTIONS.GITHUB,
      STANDARD_QUESTIONS.PORTFOLIO,
      STANDARD_QUESTIONS.WORK_EXPERIENCE,
      STANDARD_QUESTIONS.EDUCATION_HISTORY,
      STANDARD_QUESTIONS.WORK_AUTHORIZATION,
      STANDARD_QUESTIONS.REQUIRE_SPONSORSHIP,
      STANDARD_QUESTIONS.NOTICE_PERIOD,
      STANDARD_QUESTIONS.YEARS_EXPERIENCE,
      STANDARD_QUESTIONS.SALARY_EXPECTATION,
      STANDARD_QUESTIONS.HOW_DID_YOU_HEAR
    ]
  },
  
  COMPREHENSIVE: {
    name: 'Comprehensive Application',
    description: 'Detailed application with all information',
    questions: [
      STANDARD_QUESTIONS.FULL_NAME,
      STANDARD_QUESTIONS.EMAIL,
      STANDARD_QUESTIONS.PHONE,
      STANDARD_QUESTIONS.LOCATION,
      STANDARD_QUESTIONS.RESUME,
      STANDARD_QUESTIONS.COVER_LETTER,
      STANDARD_QUESTIONS.LINKEDIN,
      STANDARD_QUESTIONS.PORTFOLIO,
      STANDARD_QUESTIONS.WORK_EXPERIENCE,
      STANDARD_QUESTIONS.EDUCATION_HISTORY,
      STANDARD_QUESTIONS.WORK_AUTHORIZATION,
      STANDARD_QUESTIONS.REQUIRE_SPONSORSHIP,
      STANDARD_QUESTIONS.NOTICE_PERIOD,
      STANDARD_QUESTIONS.WILLING_TO_RELOCATE,
      STANDARD_QUESTIONS.YEARS_EXPERIENCE,
      STANDARD_QUESTIONS.HIGHEST_EDUCATION,
      STANDARD_QUESTIONS.SALARY_RANGE,
      STANDARD_QUESTIONS.HOW_DID_YOU_HEAR,
      STANDARD_QUESTIONS.REFERRAL_NAME,
      STANDARD_QUESTIONS.GENDER,
      STANDARD_QUESTIONS.ETHNICITY,
      STANDARD_QUESTIONS.VETERAN_STATUS,
      STANDARD_QUESTIONS.DISABILITY_STATUS
    ]
  }
};

module.exports = {
  FIELD_TYPES,
  STANDARD_QUESTIONS,
  FORM_TEMPLATES
};
