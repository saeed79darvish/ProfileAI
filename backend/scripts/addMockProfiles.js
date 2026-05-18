const bcrypt = require('bcryptjs');
const { User, Profile } = require('../models');

const mockProfiles = [
  {
    user: {
      email: 'sarah.chen@example.com',
      password: 'password123',
      firstName: 'Sarah',
      lastName: 'Chen'
    },
    profile: {
      title: 'Senior Full Stack Engineer',
      location: 'San Francisco, CA',
      phone: '+1 (415) 555-0123',
      linkedinUrl: 'https://linkedin.com/in/sarahchen',
      githubUrl: 'https://github.com/sarahchen',
      summary: 'Passionate full-stack developer with 8+ years of experience building scalable web applications. Expert in React, Node.js, and cloud architecture. Led multiple teams to deliver high-impact products.',
      skills: {
        frontend: ['React', 'TypeScript', 'Next.js', 'Vue.js', 'Tailwind CSS'],
        backend: ['Node.js', 'Express', 'GraphQL', 'Python', 'Django'],
        devops: ['AWS', 'Docker', 'Kubernetes', 'CI/CD', 'Terraform'],
        database: ['PostgreSQL', 'MongoDB', 'Redis']
      },
      experience: [
        {
          company: 'TechCorp Inc',
          position: 'Senior Full Stack Engineer',
          startDate: '2020-01',
          endDate: null,
          current: true,
          description: 'Leading a team of 5 engineers building a SaaS platform serving 100k+ users. Architected microservices infrastructure on AWS, improving system reliability by 40%.'
        },
        {
          company: 'StartupXYZ',
          position: 'Full Stack Developer',
          startDate: '2017-06',
          endDate: '2019-12',
          current: false,
          description: 'Built core features for e-commerce platform using React and Node.js. Implemented real-time inventory management system handling 10k+ products.'
        },
        {
          company: 'Digital Agency Co',
          position: 'Frontend Developer',
          startDate: '2015-03',
          endDate: '2017-05',
          current: false,
          description: 'Developed responsive websites for Fortune 500 clients. Specialized in React and modern JavaScript frameworks.'
        }
      ],
      education: [
        {
          institution: 'Stanford University',
          degree: 'BS Computer Science',
          field: 'Computer Science',
          startDate: '2011-09',
          endDate: '2015-05'
        }
      ],
      projects: [
        {
          name: 'AI-Powered Analytics Dashboard',
          description: 'Built a real-time analytics platform using React, D3.js, and WebSockets. Processes 1M+ events per day.',
          technologies: ['React', 'D3.js', 'Node.js', 'WebSocket', 'PostgreSQL'],
          url: 'https://github.com/sarahchen/analytics-dashboard'
        },
        {
          name: 'Open Source Contribution - React Query',
          description: 'Core contributor to React Query library. Implemented caching optimization reducing API calls by 60%.',
          technologies: ['React', 'TypeScript', 'Testing Library'],
          url: 'https://github.com/tanstack/react-query'
        }
      ],
      isPublic: true
    }
  },
  {
    user: {
      email: 'michael.rodriguez@example.com',
      password: 'password123',
      firstName: 'Michael',
      lastName: 'Rodriguez'
    },
    profile: {
      title: 'DevOps Engineer & Cloud Architect',
      location: 'Austin, TX',
      phone: '+1 (512) 555-0456',
      linkedinUrl: 'https://linkedin.com/in/michaelrodriguez',
      githubUrl: 'https://github.com/mrodriguez',
      summary: 'DevOps specialist with 6 years of experience in cloud infrastructure and automation. Passionate about building resilient, scalable systems. AWS Certified Solutions Architect.',
      skills: {
        cloud: ['AWS', 'Azure', 'GCP'],
        devops: ['Kubernetes', 'Docker', 'Terraform', 'Ansible', 'Jenkins'],
        monitoring: ['Prometheus', 'Grafana', 'ELK Stack', 'Datadog'],
        scripting: ['Python', 'Bash', 'Go'],
        cicd: ['GitHub Actions', 'GitLab CI', 'CircleCI']
      },
      experience: [
        {
          company: 'CloudTech Solutions',
          position: 'Senior DevOps Engineer',
          startDate: '2021-03',
          endDate: null,
          current: true,
          description: 'Leading cloud migration projects for enterprise clients. Reduced infrastructure costs by 35% through optimization and automation.'
        },
        {
          company: 'FinTech Startup',
          position: 'DevOps Engineer',
          startDate: '2019-01',
          endDate: '2021-02',
          current: false,
          description: 'Built and maintained CI/CD pipelines. Implemented Kubernetes clusters serving 50+ microservices with 99.9% uptime.'
        },
        {
          company: 'Enterprise Corp',
          position: 'Systems Administrator',
          startDate: '2017-06',
          endDate: '2018-12',
          current: false,
          description: 'Managed on-premise infrastructure and started cloud adoption initiative.'
        }
      ],
      education: [
        {
          institution: 'University of Texas at Austin',
          degree: 'BS Information Systems',
          field: 'Information Systems',
          startDate: '2013-08',
          endDate: '2017-05'
        }
      ],
      projects: [
        {
          name: 'Infrastructure as Code Templates',
          description: 'Created reusable Terraform modules for AWS infrastructure. Used by 20+ teams across organization.',
          technologies: ['Terraform', 'AWS', 'Python', 'Ansible'],
          url: 'https://github.com/mrodriguez/terraform-aws-modules'
        },
        {
          name: 'Kubernetes Auto-Scaler',
          description: 'Developed custom Kubernetes operator for intelligent auto-scaling based on business metrics.',
          technologies: ['Go', 'Kubernetes', 'Prometheus'],
          url: 'https://github.com/mrodriguez/k8s-autoscaler'
        }
      ],
      isPublic: true
    }
  },
  {
    user: {
      email: 'emily.johnson@example.com',
      password: 'password123',
      firstName: 'Emily',
      lastName: 'Johnson'
    },
    profile: {
      title: 'Product Designer & UX Lead',
      location: 'New York, NY',
      phone: '+1 (212) 555-0789',
      linkedinUrl: 'https://linkedin.com/in/emilyjohnson',
      githubUrl: 'https://github.com/ejohnson',
      summary: 'Award-winning product designer with 7 years of experience creating delightful user experiences. Led design for products used by millions. Strong in user research, prototyping, and design systems.',
      skills: {
        design: ['Figma', 'Sketch', 'Adobe XD', 'Principle', 'Framer'],
        frontend: ['HTML', 'CSS', 'JavaScript', 'React', 'Tailwind'],
        research: ['User Testing', 'A/B Testing', 'Analytics', 'Surveys'],
        soft: ['Team Leadership', 'Stakeholder Management', 'Design Thinking']
      },
      experience: [
        {
          company: 'DesignFirst Agency',
          position: 'Lead Product Designer',
          startDate: '2020-06',
          endDate: null,
          current: true,
          description: 'Leading design team of 4 designers. Redesigned core product resulting in 45% increase in user engagement and 30% reduction in support tickets.'
        },
        {
          company: 'E-commerce Giant',
          position: 'Senior UX Designer',
          startDate: '2018-02',
          endDate: '2020-05',
          current: false,
          description: 'Designed checkout flow optimization that increased conversion rate by 25%. Led design system initiative used across 50+ teams.'
        },
        {
          company: 'Digital Studio',
          position: 'UX Designer',
          startDate: '2016-07',
          endDate: '2018-01',
          current: false,
          description: 'Created user interfaces for mobile apps and web applications. Conducted user research and usability testing.'
        }
      ],
      education: [
        {
          institution: 'Parsons School of Design',
          degree: 'BFA Design and Technology',
          field: 'Design and Technology',
          startDate: '2012-09',
          endDate: '2016-05'
        }
      ],
      projects: [
        {
          name: 'Open Source Design System',
          description: 'Created comprehensive design system with 100+ components. Used by 500+ designers and developers.',
          technologies: ['Figma', 'React', 'Storybook', 'TypeScript'],
          url: 'https://github.com/ejohnson/design-system'
        },
        {
          name: 'Accessibility Toolkit',
          description: 'Built tools and guidelines for accessible design. Won "Best Accessibility Tool" award at Design Conf 2023.',
          technologies: ['Figma', 'HTML', 'CSS', 'ARIA'],
          url: 'https://a11y-toolkit.design'
        }
      ],
      isPublic: true
    }
  },
  {
    user: {
      email: 'david.kim@example.com',
      password: 'password123',
      firstName: 'David',
      lastName: 'Kim'
    },
    profile: {
      title: 'Machine Learning Engineer',
      location: 'Seattle, WA',
      phone: '+1 (206) 555-0321',
      linkedinUrl: 'https://linkedin.com/in/davidkim',
      githubUrl: 'https://github.com/dkim',
      summary: 'ML Engineer specializing in NLP and computer vision. 5 years of experience building production ML systems. PhD in Machine Learning from MIT. Published researcher with 10+ papers.',
      skills: {
        ml: ['TensorFlow', 'PyTorch', 'Scikit-learn', 'Keras', 'Hugging Face'],
        languages: ['Python', 'R', 'Julia', 'SQL'],
        cloud: ['AWS SageMaker', 'Google Cloud AI', 'Azure ML'],
        tools: ['MLflow', 'Weights & Biases', 'DVC', 'Jupyter'],
        specialization: ['NLP', 'Computer Vision', 'Deep Learning', 'LLMs']
      },
      experience: [
        {
          company: 'AI Research Lab',
          position: 'Senior ML Engineer',
          startDate: '2021-08',
          endDate: null,
          current: true,
          description: 'Leading development of large language models for enterprise applications. Built recommendation system serving 10M+ users with 95% accuracy.'
        },
        {
          company: 'Tech Unicorn',
          position: 'Machine Learning Engineer',
          startDate: '2019-06',
          endDate: '2021-07',
          current: false,
          description: 'Developed computer vision models for autonomous systems. Improved object detection accuracy by 40%.'
        }
      ],
      education: [
        {
          institution: 'MIT',
          degree: 'PhD Machine Learning',
          field: 'Machine Learning',
          startDate: '2017-09',
          endDate: '2019-05'
        },
        {
          institution: 'Carnegie Mellon University',
          degree: 'MS Computer Science',
          field: 'Computer Science',
          startDate: '2015-09',
          endDate: '2017-05'
        }
      ],
      projects: [
        {
          name: 'Open Source LLM Framework',
          description: 'Created framework for fine-tuning large language models. 5k+ GitHub stars.',
          technologies: ['Python', 'PyTorch', 'Transformers', 'CUDA'],
          url: 'https://github.com/dkim/llm-framework'
        },
        {
          name: 'Research: Efficient Attention Mechanisms',
          description: 'Published paper on novel attention mechanism reducing training time by 60%.',
          technologies: ['Python', 'PyTorch', 'Research'],
          url: 'https://arxiv.org/abs/2024.12345'
        }
      ],
      isPublic: true
    }
  },
  {
    user: {
      email: 'jessica.martinez@example.com',
      password: 'password123',
      firstName: 'Jessica',
      lastName: 'Martinez'
    },
    profile: {
      title: 'Engineering Manager & Tech Lead',
      location: 'Boston, MA',
      phone: '+1 (617) 555-0654',
      linkedinUrl: 'https://linkedin.com/in/jessicamartinez',
      githubUrl: 'https://github.com/jmartinez',
      summary: 'Engineering leader with 10+ years of experience. Passionate about building high-performing teams and scalable systems. Successfully led teams of 15+ engineers at both startups and Fortune 500 companies.',
      skills: {
        leadership: ['Team Building', 'Mentoring', 'Agile', 'Scrum', 'OKRs'],
        technical: ['Java', 'Spring Boot', 'Microservices', 'System Design'],
        cloud: ['AWS', 'Kubernetes', 'Docker'],
        database: ['PostgreSQL', 'MySQL', 'DynamoDB', 'Redis'],
        soft: ['Communication', 'Stakeholder Management', 'Strategic Planning']
      },
      experience: [
        {
          company: 'Enterprise Tech Corp',
          position: 'Engineering Manager',
          startDate: '2020-01',
          endDate: null,
          current: true,
          description: 'Managing team of 15 engineers across 3 squads. Led migration to microservices architecture serving 5M+ users. Improved team velocity by 50% through process improvements.'
        },
        {
          company: 'Growth Stage Startup',
          position: 'Tech Lead',
          startDate: '2017-03',
          endDate: '2019-12',
          current: false,
          description: 'Led technical architecture decisions for payment processing platform. Scaled system from 1k to 100k transactions per day.'
        },
        {
          company: 'Software Consultancy',
          position: 'Senior Software Engineer',
          startDate: '2014-06',
          endDate: '2017-02',
          current: false,
          description: 'Built enterprise applications for financial services clients. Specialized in Java and Spring ecosystem.'
        }
      ],
      education: [
        {
          institution: 'Boston University',
          degree: 'BS Computer Engineering',
          field: 'Computer Engineering',
          startDate: '2010-09',
          endDate: '2014-05'
        },
        {
          institution: 'Harvard Business School',
          degree: 'Executive Education - Leadership',
          field: 'Leadership',
          startDate: '2022-01',
          endDate: '2022-06'
        }
      ],
      projects: [
        {
          name: 'Engineering Blog',
          description: 'Write about engineering leadership, system design, and team building. 50k+ monthly readers.',
          technologies: ['Writing', 'Leadership', 'Engineering'],
          url: 'https://jessicamartinez.blog'
        },
        {
          name: 'Mentorship Program',
          description: 'Founded company-wide mentorship program. Mentored 30+ engineers to senior/lead positions.',
          technologies: ['Leadership', 'Mentoring', 'Career Development'],
          url: null
        }
      ],
      isPublic: true
    }
  }
];

async function addMockProfiles() {
  try {
    console.log('🚀 Starting to create mock profiles...\n');

    for (const mockData of mockProfiles) {
      // Check if user already exists
      let user = await User.findOne({ where: { email: mockData.user.email } });
      
      if (user) {
        console.log(`⏭️  User ${mockData.user.email} already exists, skipping...`);
        continue;
      }

      // Create user
      const hashedPassword = await bcrypt.hash(mockData.user.password, 10);
      user = await User.create({
        email: mockData.user.email,
        password: hashedPassword,
        firstName: mockData.user.firstName,
        lastName: mockData.user.lastName
      });

      console.log(`✅ Created user: ${user.firstName} ${user.lastName} (${user.email})`);

      // Create profile
      const profile = await Profile.create({
        userId: user.id,
        ...mockData.profile
      });

      console.log(`   ✅ Created profile: ${profile.title}`);
      console.log(`   📍 Location: ${profile.location}`);
      console.log(`   💼 ${profile.experience.length} experiences, ${profile.projects.length} projects\n`);
    }

    console.log('✨ All mock profiles created successfully!\n');
    console.log('📊 Summary:');
    console.log(`   Total profiles: ${mockProfiles.length}`);
    console.log('\n🔐 Login credentials (all passwords are: password123):');
    mockProfiles.forEach(mock => {
      console.log(`   📧 ${mock.user.email} - ${mock.user.firstName} ${mock.user.lastName} (${mock.profile.title})`);
    });
    console.log('\n🌐 Visit http://localhost:3000/browse to see all profiles!');
    console.log('🤖 Click "AI Tools" on any profile to test recruiter features!\n');

  } catch (error) {
    console.error('❌ Error creating mock profiles:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  addMockProfiles()
    .then(() => {
      console.log('Done! Exiting...');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

// Run if called directly
if (require.main === module) {
  addMockProfiles()
    .then(() => {
      console.log('Done! Exiting...');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = addMockProfiles;
