const bcrypt = require('bcryptjs');
const { User, Profile } = require('../models');

// Diverse data pools for generating realistic profiles
const firstNames = {
  male: ['James', 'John', 'Robert', 'Michael', 'David', 'William', 'Richard', 'Joseph', 'Thomas', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Andrew', 'Kenneth', 'Joshua', 'Kevin', 'Brian', 'George', 'Timothy', 'Ronald', 'Jason'],
  female: ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle', 'Carol', 'Amanda', 'Melissa', 'Deborah', 'Stephanie']
};

const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'];

const cities = [
  'San Francisco, CA', 'New York, NY', 'Austin, TX', 'Seattle, WA', 'Boston, MA',
  'Denver, CO', 'Portland, OR', 'Chicago, IL', 'Los Angeles, CA', 'Miami, FL',
  'Atlanta, GA', 'Dallas, TX', 'Phoenix, AZ', 'San Diego, CA', 'Philadelphia, PA',
  'Washington, DC', 'Minneapolis, MN', 'Detroit, MI', 'Nashville, TN', 'Charlotte, NC'
];

const jobTitles = [
  'Full Stack Developer', 'Frontend Engineer', 'Backend Engineer', 'DevOps Engineer',
  'Data Scientist', 'Machine Learning Engineer', 'Product Manager', 'UX Designer',
  'UI/UX Designer', 'Mobile Developer', 'Cloud Architect', 'Security Engineer',
  'QA Engineer', 'Software Engineer', 'Senior Software Engineer', 'Lead Developer',
  'Technical Lead', 'Engineering Manager', 'Solutions Architect', 'Site Reliability Engineer',
  'Data Engineer', 'AI/ML Researcher', 'Blockchain Developer', 'Game Developer',
  'Systems Administrator', 'Database Administrator', 'Network Engineer', 'Business Analyst',
  'Scrum Master', 'Agile Coach'
];

const companies = [
  'Google', 'Amazon', 'Microsoft', 'Apple', 'Meta', 'Netflix', 'Tesla', 'Uber',
  'Airbnb', 'Spotify', 'Stripe', 'Square', 'Shopify', 'Salesforce', 'Oracle',
  'IBM', 'Intel', 'Adobe', 'Cisco', 'Twitter', 'LinkedIn', 'Dropbox', 'Slack',
  'Zoom', 'PayPal', 'eBay', 'Reddit', 'Pinterest', 'Snapchat', 'TikTok',
  'TechCorp', 'StartupXYZ', 'InnovateLabs', 'DataFlow Inc', 'CloudFirst',
  'Digital Dynamics', 'CodeCraft', 'AppWorks', 'DevHub', 'BuildRight'
];

const universities = [
  'MIT', 'Stanford University', 'UC Berkeley', 'Harvard University', 'Carnegie Mellon University',
  'Georgia Tech', 'University of Washington', 'UT Austin', 'University of Michigan',
  'Cornell University', 'Columbia University', 'Princeton University', 'UCLA', 'USC',
  'Boston University', 'NYU', 'Duke University', 'Northwestern University',
  'University of Illinois', 'Purdue University', 'Penn State', 'University of Florida',
  'Ohio State University', 'University of Texas', 'Arizona State University'
];

const skillsByCategory = {
  frontend: ['React', 'Vue.js', 'Angular', 'Next.js', 'TypeScript', 'JavaScript', 'HTML5', 'CSS3', 'Tailwind CSS', 'Material-UI', 'Redux', 'Svelte', 'Webpack', 'Vite', 'SASS', 'Bootstrap'],
  backend: ['Node.js', 'Python', 'Java', 'Go', 'Ruby', 'PHP', 'C#', '.NET', 'Django', 'Flask', 'Express', 'FastAPI', 'Spring Boot', 'Ruby on Rails', 'Laravel'],
  mobile: ['React Native', 'Flutter', 'Swift', 'Kotlin', 'iOS Development', 'Android Development', 'Xamarin', 'Ionic'],
  database: ['PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'DynamoDB', 'Cassandra', 'Firebase', 'SQLite', 'Oracle', 'SQL Server', 'Neo4j', 'Elasticsearch'],
  cloud: ['AWS', 'Azure', 'GCP', 'Heroku', 'DigitalOcean', 'Cloudflare', 'Vercel', 'Netlify'],
  devops: ['Docker', 'Kubernetes', 'Jenkins', 'GitLab CI', 'GitHub Actions', 'Terraform', 'Ansible', 'CircleCI', 'Travis CI'],
  ai: ['TensorFlow', 'PyTorch', 'Scikit-learn', 'Keras', 'OpenCV', 'NLP', 'Computer Vision', 'Deep Learning', 'Machine Learning'],
  other: ['Git', 'Agile', 'Scrum', 'REST API', 'GraphQL', 'Microservices', 'TDD', 'Unit Testing', 'Linux', 'System Design']
};

const projectTypes = [
  { name: 'E-commerce Platform', tech: ['React', 'Node.js', 'PostgreSQL', 'Stripe'], desc: 'Built a scalable e-commerce platform with payment integration and real-time inventory management' },
  { name: 'Social Media Dashboard', tech: ['Vue.js', 'Python', 'MongoDB', 'Redis'], desc: 'Developed analytics dashboard processing 1M+ social media posts daily' },
  { name: 'Mobile Fitness App', tech: ['React Native', 'Firebase', 'TensorFlow'], desc: 'Created fitness tracking app with AI-powered workout recommendations' },
  { name: 'Cloud Infrastructure', tech: ['AWS', 'Terraform', 'Kubernetes', 'Python'], desc: 'Architected scalable cloud infrastructure serving 500K+ users' },
  { name: 'AI Chatbot', tech: ['Python', 'TensorFlow', 'Flask', 'NLP'], desc: 'Built intelligent chatbot with natural language processing capabilities' },
  { name: 'Real-time Collaboration Tool', tech: ['React', 'WebSocket', 'Node.js', 'Redis'], desc: 'Developed real-time collaborative editing platform' },
  { name: 'Data Visualization Platform', tech: ['D3.js', 'React', 'Python', 'PostgreSQL'], desc: 'Created interactive data visualization dashboard for business analytics' },
  { name: 'Blockchain Wallet', tech: ['React', 'Solidity', 'Web3.js', 'Ethereum'], desc: 'Developed secure cryptocurrency wallet with multi-chain support' },
  { name: 'IoT Monitoring System', tech: ['Python', 'MQTT', 'InfluxDB', 'Grafana'], desc: 'Built IoT device monitoring system processing sensor data in real-time' },
  { name: 'Video Streaming Platform', tech: ['React', 'Node.js', 'AWS S3', 'CloudFront'], desc: 'Developed video streaming service handling 100K+ concurrent users' }
];

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomChoices(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function generateEmail(firstName, lastName, index) {
  const domain = randomChoice(['example.com', 'email.com', 'test.com', 'demo.com']);
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@${domain}`;
}

function generatePhone() {
  const area = Math.floor(Math.random() * 900) + 100;
  const prefix = Math.floor(Math.random() * 900) + 100;
  const line = Math.floor(Math.random() * 9000) + 1000;
  return `+1 (${area}) ${prefix}-${line}`;
}

function generateYearsAgo(years) {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date.toISOString().slice(0, 7);
}

function generateSummary(title, yearsExp) {
  const summaries = [
    `Experienced ${title.toLowerCase()} with ${yearsExp}+ years building innovative solutions. Passionate about clean code, scalability, and delivering exceptional user experiences.`,
    `${yearsExp}+ years of expertise in software development with a focus on modern technologies and best practices. Strong problem-solver with excellent communication skills.`,
    `Dedicated ${title.toLowerCase()} specializing in cutting-edge technologies. ${yearsExp} years of experience leading projects from conception to deployment.`,
    `Results-driven professional with ${yearsExp} years of experience in tech. Expert in building scalable applications and mentoring junior developers.`,
    `Innovative ${title.toLowerCase()} with ${yearsExp}+ years creating impactful solutions. Committed to continuous learning and staying current with industry trends.`
  ];
  return randomChoice(summaries);
}

function generateExperience(jobTitle, yearsExp) {
  const experiences = [];
  let currentYear = new Date().getFullYear();
  let remainingYears = yearsExp;
  
  while (remainingYears > 0 && experiences.length < 4) {
    const yearsInRole = Math.min(Math.floor(Math.random() * 3) + 2, remainingYears);
    const isCurrent = experiences.length === 0;
    const company = randomChoice(companies);
    const position = experiences.length === 0 ? jobTitle : randomChoice(jobTitles);
    
    const startDate = generateYearsAgo(currentYear - (new Date().getFullYear() - yearsInRole));
    const endDate = isCurrent ? null : generateYearsAgo(currentYear - new Date().getFullYear());
    
    experiences.push({
      company,
      position,
      startDate,
      endDate,
      current: isCurrent,
      description: `${isCurrent ? 'Leading' : 'Led'} development of key features and initiatives. ${isCurrent ? 'Building' : 'Built'} scalable solutions serving thousands of users. Collaborated with cross-functional teams to deliver high-quality products.`
    });
    
    remainingYears -= yearsInRole;
    currentYear -= yearsInRole;
  }
  
  return experiences;
}

function generateEducation() {
  const degrees = ['BS', 'MS', 'BA', 'PhD'];
  const fields = ['Computer Science', 'Software Engineering', 'Information Technology', 'Computer Engineering', 'Data Science', 'Electrical Engineering'];
  
  const education = [{
    institution: randomChoice(universities),
    degree: `${randomChoice(degrees)} ${randomChoice(fields)}`,
    field: randomChoice(fields),
    startDate: generateYearsAgo(Math.floor(Math.random() * 10) + 8),
    endDate: generateYearsAgo(Math.floor(Math.random() * 10) + 4)
  }];
  
  // 30% chance of having graduate degree
  if (Math.random() < 0.3) {
    education.push({
      institution: randomChoice(universities),
      degree: `MS ${randomChoice(fields)}`,
      field: randomChoice(fields),
      startDate: generateYearsAgo(Math.floor(Math.random() * 5) + 3),
      endDate: generateYearsAgo(Math.floor(Math.random() * 3) + 1)
    });
  }
  
  return education;
}

function generateProjects() {
  const numProjects = Math.floor(Math.random() * 3) + 2; // 2-4 projects
  return randomChoices(projectTypes, numProjects).map((project, i) => ({
    name: `${project.name} ${i > 0 ? 'v' + (i + 1) : ''}`,
    description: project.desc,
    technologies: project.tech,
    url: Math.random() < 0.7 ? `https://github.com/user/project-${i + 1}` : null
  }));
}

function generateSkills(jobTitle) {
  const skills = {};
  
  // Add skills based on job title
  if (jobTitle.includes('Frontend') || jobTitle.includes('Full Stack') || jobTitle.includes('UI')) {
    skills.frontend = randomChoices(skillsByCategory.frontend, Math.floor(Math.random() * 4) + 4);
  }
  
  if (jobTitle.includes('Backend') || jobTitle.includes('Full Stack')) {
    skills.backend = randomChoices(skillsByCategory.backend, Math.floor(Math.random() * 3) + 3);
  }
  
  if (jobTitle.includes('Mobile')) {
    skills.mobile = randomChoices(skillsByCategory.mobile, Math.floor(Math.random() * 3) + 2);
  }
  
  if (jobTitle.includes('Data') || jobTitle.includes('ML') || jobTitle.includes('AI')) {
    skills.ai = randomChoices(skillsByCategory.ai, Math.floor(Math.random() * 4) + 3);
  }
  
  if (jobTitle.includes('DevOps') || jobTitle.includes('Cloud') || jobTitle.includes('Infrastructure')) {
    skills.devops = randomChoices(skillsByCategory.devops, Math.floor(Math.random() * 4) + 3);
    skills.cloud = randomChoices(skillsByCategory.cloud, Math.floor(Math.random() * 2) + 2);
  }
  
  // Always add database and other skills
  skills.database = randomChoices(skillsByCategory.database, Math.floor(Math.random() * 3) + 2);
  skills.other = randomChoices(skillsByCategory.other, Math.floor(Math.random() * 4) + 3);
  
  return skills;
}

function generateProfile(index) {
  const gender = Math.random() < 0.5 ? 'male' : 'female';
  const firstName = randomChoice(firstNames[gender]);
  const lastName = randomChoice(lastNames);
  const jobTitle = randomChoice(jobTitles);
  const yearsExp = Math.floor(Math.random() * 12) + 2; // 2-14 years
  
  return {
    user: {
      email: generateEmail(firstName, lastName, index),
      password: 'password123',
      firstName,
      lastName,
      role: 'candidate'
    },
    profile: {
      title: jobTitle,
      location: randomChoice(cities),
      phone: generatePhone(),
      linkedinUrl: `https://linkedin.com/in/${firstName.toLowerCase()}${lastName.toLowerCase()}`,
      githubUrl: Math.random() < 0.8 ? `https://github.com/${firstName.toLowerCase()}${lastName.toLowerCase()}` : null,
      summary: generateSummary(jobTitle, yearsExp),
      skills: generateSkills(jobTitle),
      experience: generateExperience(jobTitle, yearsExp),
      education: generateEducation(),
      projects: generateProjects(),
      isPublic: true
    }
  };
}

async function addMockProfiles() {
  try {
    console.log('🚀 Starting to generate 50 mock candidate profiles...\n');
    
    const profiles = [];
    for (let i = 1; i <= 50; i++) {
      profiles.push(generateProfile(i));
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const mockProfile of profiles) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ where: { email: mockProfile.user.email } });
        if (existingUser) {
          console.log(`⚠️  User ${mockProfile.user.email} already exists, skipping...`);
          errorCount++;
          continue;
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(mockProfile.user.password, 10);
        
        // Create user
        const user = await User.create({
          ...mockProfile.user,
          password: hashedPassword
        });
        
        // Create profile
        await Profile.create({
          ...mockProfile.profile,
          userId: user.id
        });
        
        successCount++;
        console.log(`✅ Created profile ${successCount}/50: ${user.firstName} ${user.lastName} - ${mockProfile.profile.title}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Error creating profile ${mockProfile.user.email}:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`✨ Mock profile generation complete!`);
    console.log(`📊 Success: ${successCount} profiles`);
    if (errorCount > 0) {
      console.log(`⚠️  Errors: ${errorCount} profiles`);
    }
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  addMockProfiles()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { addMockProfiles };
