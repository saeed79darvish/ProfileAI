/**
 * ResumeParserService
 * 
 * Main service for resume parsing, enhancement, gap analysis, and tailoring.
 * 
 * This service has been modularized into:
 * - ./resume/extractors.js: PDF/DOCX text extraction
 * - ./resume/patterns.js: Regex patterns and utilities
 * - ./resume/prompts.js: AI prompts for all operations
 */

const Anthropic = require('@anthropic-ai/sdk');
// IMPORTANT: pdf-parse@1.1.1's top-level index.js has a debug shim that
// tries to read a bundled test fixture when `module.parent` is undefined,
// which is the case under Render's Node 22 runtime. Requiring the inner
// lib path directly avoids that codepath entirely.
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const mammoth = require('mammoth');

// Import modular components
const { extractors: resumeExtractors, patterns: resumePatterns, prompts: resumePrompts } = require('./resume');
const { classifyDepartment } = require('./resume/departmentClassifier');
const { getDepartmentEnhancementPrompt } = require('./resume/enhancementPrompts');
const { buildTailoringPrompt } = require('./resume/tailoringPrompts');

const anthropic = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// OpenAI fallback when Claude is unavailable
const OpenAI = require('openai');
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60000, maxRetries: 1 })
  : null;

// Fallback: call OpenAI GPT-4o when Claude is down
async function callOpenAI({ system, prompt, max_tokens = 2000, temperature = 0.7 }) {
  if (!openai) throw new Error('OpenAI API key not configured — no fallback available');
  console.log('[ProfilleAI] Falling back to OpenAI GPT-4o...');
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens,
    temperature,
    messages: [
      { role: 'system', content: system || 'You are a helpful AI assistant.' },
      { role: 'user', content: prompt },
    ],
  });
  return response.choices[0].message.content.trim();
}

// Centralized AI call — tries Claude Sonnet with retry, falls back to OpenAI GPT-4o
async function callAI({ system, prompt, max_tokens = 2000, temperature = 0.7, retries = 3 }) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
        max_tokens,
        temperature,
        system: system || 'You are a helpful AI assistant.',
        messages: [{ role: 'user', content: prompt }],
      });
      return response.content[0].text.trim();
    } catch (err) {
      lastError = err;
      const isRetryable = err.status === 529 || err.status === 503 || err.status === 500 ||
        (err.error?.type === 'overloaded_error') || (err.message && err.message.includes('overloaded'));
      if (isRetryable && attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.warn(`[ProfilleAI] Claude attempt ${attempt}/${retries} failed (${err.status || err.message}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        break;
      }
    }
  }

  // All Claude retries failed — try OpenAI fallback
  const isOverloaded = lastError?.status === 529 || lastError?.status === 503 ||
    lastError?.error?.type === 'overloaded_error';
  if (isOverloaded && openai) {
    try {
      return await callOpenAI({ system, prompt, max_tokens, temperature });
    } catch (fallbackErr) {
      console.error('[ProfilleAI] OpenAI fallback also failed:', fallbackErr.message);
      // Throw the original Claude error
    }
  }

  throw lastError;
}

class ResumeParserService {
  /**
   * Extract text from PDF file buffer
   */
  async extractPdfText(buffer) {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  /**
   * Extract text from DOCX file buffer
   */
  async extractDocxText(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      console.error('Error extracting DOCX text:', error);
      throw new Error('Failed to extract text from DOCX');
    }
  }

  /**
   * Extract text from resume based on file type
   */
  async extractTextFromResume(file) {
    const { buffer, mimetype } = file;

    if (mimetype === 'application/pdf') {
      return await this.extractPdfText(buffer);
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimetype === 'application/msword'
    ) {
      return await this.extractDocxText(buffer);
    } else {
      throw new Error('Unsupported file type. Only PDF and DOCX files are supported.');
    }
  }

  /**
   * Parse resume text using Claude AI to extract structured data
   */
  async parseResumeWithAI(resumeText) {
    try {
      const prompt = `You are an expert resume parser. Analyze the following resume and extract structured information.

Resume Text:
${resumeText}

Extract and return a JSON object with the following structure:
{
  "firstName": "First name of the person (string)",
  "lastName": "Last name of the person (string)",
  "email": "Email address if available (string or null)",
  "title": "Job title or desired position (string)",
  "location": "City, State or Country (string)",
  "phone": "Phone number if available (string or null)",
  "website": "Personal website URL if available (string or null)",
  "linkedinUrl": "LinkedIn profile URL if available (string or null)",
  "githubUrl": "GitHub profile URL if available (string or null)",
  "summary": "A professional summary or objective (string, 2-3 sentences)",
  "skills": ["skill1", "skill2", "skill3", ...] (array of strings),
  "experience": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "startDate": "YYYY-MM-DD format (e.g., 2020-01-01). Use first day of month if only month/year given.",
      "endDate": "YYYY-MM-DD format or null if current position",
      "current": true/false (boolean indicating if currently working here),
      "description": "Brief description of responsibilities and achievements"
    }
  ],
  "education": [
    {
      "institution": "University or School Name",
      "degree": "Degree Name (e.g., Bachelor of Science, Master of Arts)",
      "field": "Field of Study (e.g., Computer Science)",
      "startDate": "YYYY-MM-DD format",
      "endDate": "YYYY-MM-DD format or null if currently enrolled",
      "current": true/false (boolean indicating if currently studying),
      "gpa": "GPA if mentioned (string or null)"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description of the project",
      "technologies": ["tech1", "tech2", ...],
      "link": "Project URL if available (optional)"
    }
  ]
}

Important guidelines:
- Extract the person's FULL NAME and split into firstName and lastName
- Extract EMAIL ADDRESS - look for patterns like name@domain.com
- Format ALL DATES as YYYY-MM-DD (e.g., 2020-01-15). If only month/year given, use day 01. If only year, use January 1st.
- For "Present" or "Current" positions, set endDate to null and current to true
- Extract all information accurately from the resume
- If a field is not present in the resume, use null for strings and empty arrays for lists
- Extract ALL skills mentioned in the resume
- Include soft skills and technical skills
- For the summary, if there's no explicit summary section, create a brief 2-3 sentence professional summary based on the resume content
- Keep descriptions concise but informative
- Return ONLY valid JSON, no additional text or explanation`;

      const responseText = await callAI({
        system: 'You are a professional resume parser that extracts structured data from resumes. You always return valid JSON.',
        prompt,
        temperature: 0.3,
        max_tokens: 2000
      });
      
      // Remove markdown code blocks if present
      let jsonText = responseText;
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      const parsedData = JSON.parse(jsonText);
      
      return parsedData;
    } catch (error) {
      console.error('Error parsing resume with AI:', error);
      throw new Error('Failed to parse resume content with AI');
    }
  }

  /**
   * Parse resume using pattern matching (no AI)
   */
  parseResumeWithPatterns(resumeText) {
    const lines = resumeText.split('\n').map(l => l.trim()).filter(l => l);
    const text = resumeText;
    
    // Extract email
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : null;
    
    // Extract phone
    const phoneMatch = text.match(/(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/);
    const phone = phoneMatch ? phoneMatch[0] : null;
    
    // Extract LinkedIn URL
    const linkedinMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/i);
    const linkedinUrl = linkedinMatch ? linkedinMatch[0] : null;
    
    // Extract GitHub URL
    const githubMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+\/?/i);
    const githubUrl = githubMatch ? githubMatch[0] : null;
    
    // Extract website
    const websiteMatch = text.match(/(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?/);
    const website = websiteMatch && !websiteMatch[0].includes('linkedin') && !websiteMatch[0].includes('github') 
      ? websiteMatch[0] : null;
    
    // Try to extract name from first few lines (usually at the top)
    let firstName = null;
    let lastName = null;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      // Skip lines that look like contact info, titles, or are too long
      if (line.includes('@') || line.includes('http') || line.match(/^\d/) || line.length > 40) continue;
      // Look for a name pattern (2-3 words, capitalized)
      const nameMatch = line.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)(?:\s+([A-Z][a-z]+))?$/);
      if (nameMatch) {
        firstName = nameMatch[1];
        lastName = nameMatch[3] || nameMatch[2];
        break;
      }
      // Simpler pattern: just capitalized words
      const words = line.split(/\s+/).filter(w => /^[A-Z][a-z]+$/.test(w));
      if (words.length >= 2 && words.length <= 3) {
        firstName = words[0];
        lastName = words[words.length - 1];
        break;
      }
    }
    
    // Extract location (City, State pattern)
    const locationMatch = text.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*([A-Z]{2}|[A-Z][a-z]+)/);
    const location = locationMatch ? `${locationMatch[1]}, ${locationMatch[2]}` : null;
    
    // Extract skills - look for common skill keywords and programming languages
    const skillPatterns = [
      /JavaScript/gi, /TypeScript/gi, /Python/gi, /Java(?!Script)/gi, /C\+\+/gi, /C#/gi,
      /React/gi, /Angular/gi, /Vue/gi, /Node\.?js/gi, /Express/gi, /Django/gi, /Flask/gi,
      /SQL/gi, /PostgreSQL/gi, /MongoDB/gi, /MySQL/gi, /Redis/gi,
      /AWS/gi, /Azure/gi, /GCP/gi, /Docker/gi, /Kubernetes/gi, /Git/gi,
      /HTML/gi, /CSS/gi, /SASS/gi, /REST/gi, /GraphQL/gi, /API/gi,
      /Machine Learning/gi, /AI/gi, /Data Science/gi, /TensorFlow/gi, /PyTorch/gi,
      /Agile/gi, /Scrum/gi, /CI\/CD/gi, /DevOps/gi, /Linux/gi,
      /Swift/gi, /Kotlin/gi, /Go(?:lang)?/gi, /Rust/gi, /Ruby/gi, /PHP/gi,
      /Spring/gi, /\.NET/gi, /Microservices/gi, /Serverless/gi
    ];
    
    const skills = [];
    const seenSkills = new Set();
    for (const pattern of skillPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        const skill = matches[0];
        const normalizedSkill = skill.toLowerCase();
        if (!seenSkills.has(normalizedSkill)) {
          seenSkills.add(normalizedSkill);
          skills.push(skill);
        }
      }
    }
    
    // Extract experience sections
    const experience = [];
    
    // Debug: print the full text to understand structure
    console.log('=== FULL RESUME TEXT (first 2000 chars) ===');
    console.log(text.substring(0, 2000));
    console.log('=== END RESUME TEXT ===');
    
    // Find where each major section starts
    const sectionHeaders = ['EXPERIENCE', 'PROFESSIONAL EXPERIENCE', 'WORK EXPERIENCE', 'EDUCATION', 'SKILLS', 'TECHNICAL SKILLS', 'PROJECTS', 'CERTIFICATIONS'];
    sectionHeaders.forEach(header => {
      const idx = text.toUpperCase().indexOf(header);
      if (idx !== -1) {
        console.log(`Section "${header}" found at index ${idx}`);
      }
    });
    
    // Find experience section by looking for a standalone header line
    // Use lines array to avoid matching "experience" inside paragraph text
    const expHeaderLineRegex = /^(PROFESSIONAL\s+EXPERIENCE|WORK\s+EXPERIENCE|EXPERIENCE|EMPLOYMENT(?:\s+HISTORY)?|WORK\s+HISTORY|CAREER\s+HISTORY)\s*:?\s*$/i;
    let expLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (expHeaderLineRegex.test(lines[i])) {
        expLineIndex = i;
        break;
      }
    }
    
    // Also find where the experience section header is in raw text for substring extraction
    let expHeaderMatch = null;
    if (expLineIndex !== -1) {
      // Build a regex from the actual matched line to find its position in raw text
      const escapedHeader = lines[expLineIndex].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expHeaderMatch = text.match(new RegExp('(?:^|\\n)\\s*' + escapedHeader + '\\s*[:\\n]?', 'im'));
    }
    
    let expSection = '';
    if (expHeaderMatch) {
      const expStartIndex = expHeaderMatch.index + expHeaderMatch[0].length;
      console.log('Experience header match:', expHeaderMatch[0].trim(), 'at index', expHeaderMatch.index);
      
      // Find the next section header after experience
      const remainingText = text.substring(expStartIndex);
      const nextSectionMatch = remainingText.match(/(?:^|\n)\s*(EDUCATION|SKILLS|TECHNICAL\s+SKILLS|CORE\s+COMPETENCIES|PROJECTS|CERTIFICATIONS|AWARDS|REFERENCES|(?:PROFESSIONAL\s+|EXECUTIVE\s+|CAREER\s+)?SUMMARY|OBJECTIVE|PROFILE|ACCOMPLISHMENTS)\s*[:\n]/im);
      
      if (nextSectionMatch) {
        expSection = remainingText.substring(0, nextSectionMatch.index);
        console.log('Next section found:', nextSectionMatch[1], 'at offset', nextSectionMatch.index);
      } else {
        expSection = remainingText;
        console.log('No next section found, using all remaining text');
      }
    }
    
    if (expSection && expSection.length > 0) {
      console.log('Experience section content (first 500 chars):', expSection.substring(0, 500));
      console.log('Experience section length:', expSection.length);
      
      // Debug: search for any 4-digit year in the section
      const yearMatches = expSection.match(/\d{4}/g);
      console.log('Year matches found:', yearMatches);
      
      // Debug: look for any date-like patterns
      const anyDatePattern = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{2,4}/gi;
      const anyDates = expSection.match(anyDatePattern);
      console.log('Any date-like patterns:', anyDates);
      
      // First, try to find all date ranges in the section
      const globalDatePattern = /((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.\s]*\d{4}|(?:\d{1,2}\/\d{4}))\s*[-–—to]+\s*((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.\s]*\d{4}|(?:\d{1,2}\/\d{4})|Present|Current|Now|Ongoing)/gi;
      
      const dateMatches = [...expSection.matchAll(globalDatePattern)];
      console.log('Found', dateMatches.length, 'date ranges in experience section');
      
      if (dateMatches.length > 0) {
        // Split by date patterns to get job entries
        let lastIndex = 0;
        
        for (let i = 0; i < dateMatches.length; i++) {
          const match = dateMatches[i];
          const dateRange = match[0];
          const startDate = match[1];
          const endDate = match[2];
          const matchIndex = match.index;
          
          // Get text before this date (company/title info)
          const textBefore = expSection.substring(lastIndex, matchIndex).trim();
          
          // Get text after until next date or end (description)
          const nextMatchIndex = i < dateMatches.length - 1 ? dateMatches[i + 1].index : expSection.length;
          const textAfter = expSection.substring(matchIndex + dateRange.length, nextMatchIndex).trim();
          
          console.log(`Date match ${i + 1}: "${dateRange}" at index ${matchIndex}`);
          console.log(`  Text before: "${textBefore.substring(Math.max(0, textBefore.length - 150))}"`);
          
          // Parse company and title from textBefore
          // IMPORTANT: Title and company are at the END of textBefore (right before the date)
          // The beginning of textBefore contains the previous job's description
          let company = '';
          let title = '';
          
          // Split by various delimiters and get the LAST few meaningful parts
          const allParts = textBefore.split(/[,|–—\n]+/).map(p => p.trim()).filter(p => p.length > 2);
          
          // Take only the last 3-4 parts which should contain title and company
          const parts = allParts.slice(-4);
          console.log(`  Last parts found:`, parts);
          
          // Title patterns to detect job titles
          const titlePatterns = [
            /(?:Senior|Junior|Lead|Principal|Staff|Associate|Sr\.?|Jr\.?)?\s*(?:Software|Frontend|Backend|Full[- ]?Stack|UI|UX|DevOps|Data|ML|AI|Cloud|Mobile|Web|QA|Platform|SRE|Solutions?|Systems?)?\s*(?:Engineer|Developer|Architect|Designer|Scientist|Analyst|Manager|Specialist|Consultant|Lead)/i,
            /(?:CEO|CTO|CFO|COO|VP|Director|Manager|Lead|Head|Principal|Staff|Senior|Junior)\s+(?:of\s+)?(?:\w+\s*)+/i,
            /\b(?:Engineer|Developer|Architect|Designer|Manager)\b.*\b(?:I{1,3}|IV|V|1|2|3|4|5)?\b/i
          ];
          
          // Find which parts are titles vs companies
          let titleIdx = -1;
          for (let j = 0; j < parts.length; j++) {
            if (titlePatterns.some(p => p.test(parts[j]))) {
              titleIdx = j;
              break;
            }
          }
          
          if (titleIdx !== -1) {
            title = parts[titleIdx].replace(/\s+/g, ' ').trim();
            // Company is usually after the title, or could be before
            if (titleIdx < parts.length - 1) {
              // Company comes after title
              company = parts.slice(titleIdx + 1).join(' ').replace(/\s+/g, ' ').trim();
            } else if (titleIdx > 0) {
              // Company might be before (less common)
              company = parts[titleIdx - 1].replace(/\s+/g, ' ').trim();
            }
          } else if (parts.length >= 2) {
            // No clear title found, assume last parts are title, company
            title = parts[parts.length - 2].replace(/\s+/g, ' ').trim();
            company = parts[parts.length - 1].replace(/\s+/g, ' ').trim();
          } else if (parts.length === 1) {
            // Only one part - could be title or company
            const isTitle = titlePatterns.some(p => p.test(parts[0]));
            if (isTitle) {
              title = parts[0].replace(/\s+/g, ' ').trim();
            } else {
              company = parts[0].replace(/\s+/g, ' ').trim();
            }
          }
          
          const isCurrent = /present|current|now|ongoing/i.test(endDate);
          
          const expEntry = {
            company: company || 'Unknown Company',
            title: title || '',
            startDate: this.parseDateToISO(startDate),
            endDate: isCurrent ? null : this.parseDateToISO(endDate),
            current: isCurrent,
            description: textAfter.substring(0, 500).replace(/\s+/g, ' ').trim() // Clean up description
          };
          
          console.log(`  Parsed: ${expEntry.title} @ ${expEntry.company} | ${startDate} - ${endDate}`);
          experience.push(expEntry);
          
          lastIndex = matchIndex + dateRange.length;
        }
      } else {
        // Fallback: try line-by-line parsing
        console.log('No date matches found, trying line-by-line parsing...');
        const lines = expSection.split('\n').map(l => l.trim()).filter(l => l);
        // Line-by-line parsing would go here if needed
      }
    }
    
    // If we still have no experience entries, try fallback extraction
    if (experience.length === 0) {
      console.log('No experience entries found, attempting fallback extraction...');
      console.log('Resume text preview:', text.substring(0, 1000));
      
      // FALLBACK: Try to find experience entries by looking for date patterns anywhere
      const datePatternGlobal = /((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.\s]*\d{4}|(?:\d{1,2}\/\d{4})|\d{4})\s*[-–—to]+\s*((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.\s]*\d{4}|(?:\d{1,2}\/\d{4})|\d{4}|Present|Current|Now|Ongoing)/gi;
      
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      let currentExp = null;
      let descriptionLines = [];
      let pendingLines = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const dateMatch = line.match(datePatternGlobal);
        
        if (dateMatch) {
          // Save previous experience
          if (currentExp) {
            currentExp.description = descriptionLines.join(' ').trim();
            if (currentExp.company || currentExp.title) {
              experience.push(currentExp);
            }
          }
          
          // Use pending lines for company/title
          let company = '';
          let title = '';
          
          // Check the 1-2 lines before this date line
          for (let j = Math.max(0, pendingLines.length - 2); j < pendingLines.length; j++) {
            const prevLine = pendingLines[j];
            if (prevLine && prevLine.length > 3 && prevLine.length < 80) {
              if (!company) {
                company = prevLine;
              } else if (!title) {
                title = prevLine;
              }
            }
          }
          
          // Also check if company/title is on same line as date
          const lineWithoutDate = line.replace(datePatternGlobal, '').trim();
          if (lineWithoutDate.length > 3) {
            const parts = lineWithoutDate.split(/[|–—,]/);
            if (parts.length >= 2) {
              company = parts[0].trim() || company;
              title = parts[1].trim() || title;
            } else if (!company) {
              company = lineWithoutDate;
            }
          }
          
          // Extract dates from the match
          const fullMatch = line.match(/((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.\s]*\d{4}|(?:\d{1,2}\/\d{4})|\d{4})\s*[-–—to]+\s*((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.\s]*\d{4}|(?:\d{1,2}\/\d{4})|\d{4}|Present|Current|Now|Ongoing)/i);
          
          if (fullMatch) {
            const isCurrent = /present|current|now|ongoing/i.test(fullMatch[2]);
            currentExp = {
              company: company || 'Unknown Company',
              title: title || '',
              startDate: this.parseDateToISO(fullMatch[1]),
              endDate: isCurrent ? null : this.parseDateToISO(fullMatch[2]),
              current: isCurrent,
              description: ''
            };
            console.log(`Fallback parsed: ${currentExp.company} | ${currentExp.title} | ${fullMatch[1]} - ${fullMatch[2]}`);
          }
          
          descriptionLines = [];
          pendingLines = [];
        } else if (currentExp) {
          // Description line
          if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || line.length > 30) {
            descriptionLines.push(line);
          }
        } else {
          // Potential company/title line before date
          pendingLines.push(line);
          if (pendingLines.length > 3) {
            pendingLines.shift();
          }
        }
      }
      
      // Don't forget the last one
      if (currentExp) {
        currentExp.description = descriptionLines.join(' ').trim();
        if (currentExp.company || currentExp.title) {
          experience.push(currentExp);
        }
      }
    }
    
    console.log(`Parsed ${experience.length} experience entries`);
    
    // Extract education sections
    const education = [];
    const eduSectionMatch = text.match(/(?:^|\n)\s*(EDUCATION|ACADEMIC\s+BACKGROUND|ACADEMIC|QUALIFICATIONS)\s*[:\n]([\s\S]*?)(?=(?:^|\n)\s*(?:EXPERIENCE|WORK\s+EXPERIENCE|SKILLS|TECHNICAL\s+SKILLS|PROJECTS|CERTIFICATIONS|AWARDS|REFERENCES|ACCOMPLISHMENTS)\s*(?:[:\n]|$)|$)/im);
    
    if (eduSectionMatch) {
      const eduSection = eduSectionMatch[2]; // Group 2 since header is in group 1
      console.log('Found education section header:', eduSectionMatch[1]);
      console.log('Education section content:', eduSection.substring(0, 500));
      
      // Debug: Look for any dates in education section
      const eduDates = eduSection.match(/\d{4}/g);
      console.log('Education section dates found:', eduDates);
      
      // Split by lines or common delimiters
      const lines = eduSection.split(/[\n]+/).map(l => l.trim()).filter(l => l.length > 3);
      console.log('Education lines:', lines.slice(0, 5));
      
      let currentEdu = null;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        // Look for degree patterns - including bootcamps and certifications
        const degreeMatch = trimmedLine.match(/(Bachelor|Master|Ph\.?D|B\.?S\.?|M\.?S\.?|B\.?A\.?|M\.?A\.?|MBA|Associate|Doctor|Diploma|Certificate|Bootcamp|Immersive|Program)(?:'?s)?(?:\s+(?:of|in))?\s*(?:Science|Arts|Engineering|Business|Computer|Information|Technology|Software)?/i);
        
        // Look for university/institution - more flexible pattern
        const institutionMatch = trimmedLine.match(/([A-Z][A-Za-z\s]+(?:University|College|Institute|School|Academy|Reactor|Bootcamp|Program))/i);
        
        // Look for dates in education - including standalone years
        const dateMatch = trimmedLine.match(/(\d{4})\s*[-–—to]*\s*(\d{4}|Present|Current|Expected)?/);
        
        // Check if this line looks like an education entry (has a program name or institution)
        const looksLikeEducation = degreeMatch || institutionMatch || 
          /(?:bootcamp|immersive|certification|degree|diploma|program|course)/i.test(trimmedLine);
        
        if (looksLikeEducation) {
          // If we have a previous education entry, save it
          if (currentEdu && (currentEdu.institution || currentEdu.degree)) {
            education.push(currentEdu);
          }
          
          currentEdu = {
            institution: institutionMatch ? institutionMatch[1].trim() : trimmedLine.substring(0, 100),
            degree: degreeMatch ? degreeMatch[0].trim() : '',
            field: '',
            startDate: dateMatch ? this.parseDateToISO(dateMatch[1]) : null,
            endDate: dateMatch && dateMatch[2] ? this.parseDateToISO(dateMatch[2]) : null,
            current: dateMatch && /present|current|expected/i.test(dateMatch[2] || ''),
            gpa: null
          };
          
          console.log('Found education entry:', currentEdu.institution, currentEdu.degree);
          
          // Try to extract field of study
          const fieldMatch = trimmedLine.match(/(?:in|of)\s+([A-Za-z\s]+?)(?:\s*[-–,|]|\s*\d{4}|$)/i);
          if (fieldMatch) {
            currentEdu.field = fieldMatch[1].trim();
          }
          
          // Look for GPA
          const gpaMatch = trimmedLine.match(/GPA[:\s]*(\d+\.?\d*)/i);
          if (gpaMatch) {
            currentEdu.gpa = gpaMatch[1];
          }
        } else if (currentEdu) {
          // Additional info for current education entry
          const gpaMatch = trimmedLine.match(/GPA[:\s]*(\d+\.?\d*)/i);
          if (gpaMatch) {
            currentEdu.gpa = gpaMatch[1];
          }
          // Check if this line has dates we missed
          const lineDateMatch = trimmedLine.match(/(\d{4})\s*[-–—to]*\s*(\d{4}|Present|Current|Expected)?/);
          if (lineDateMatch && !currentEdu.startDate) {
            currentEdu.startDate = this.parseDateToISO(lineDateMatch[1]);
            if (lineDateMatch[2]) {
              currentEdu.endDate = /present|current|expected/i.test(lineDateMatch[2]) ? null : this.parseDateToISO(lineDateMatch[2]);
              currentEdu.current = /present|current|expected/i.test(lineDateMatch[2]);
            }
          }
        }
      }
      
      // Don't forget the last education entry
      if (currentEdu && (currentEdu.institution || currentEdu.degree)) {
        education.push(currentEdu);
      }
    } else {
      console.log('No education section found in resume text');
    }
    
    console.log(`Parsed ${education.length} education entries`);
    
    // Try to extract a title/position from the text
    // Use [^\S\n]* instead of \s* to avoid matching across line breaks
    const titlePatterns = [
      /(?:Senior|Junior|Lead|Principal|Staff)?[^\S\n]*(?:Software|Frontend|Backend|Full[- ]?Stack|DevOps|Data|ML|AI|Cloud|Mobile|Web)[^\S\n]*(?:Engineer|Developer|Architect|Scientist)/gi,
      /(?:Product|Project|Program|Engineering)[^\S\n]*Manager/gi,
      /(?:UI|UX|Product)[^\S\n]*Designer/gi
    ];
    
    let title = null;
    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match) {
        title = match[0].trim();
        break;
      }
    }
    
    // Extract Professional Summary / Objective section from resume
    // Use lines array for robust detection - section headers are short standalone lines
    let summary = null;
    const summaryHeaderRegex = /^(PROFESSIONAL\s+SUMMARY|EXECUTIVE\s+SUMMARY|CAREER\s+SUMMARY|PROFILE\s+SUMMARY|SUMMARY\s+OF\s+QUALIFICATIONS|SUMMARY|OBJECTIVE|CAREER\s+OBJECTIVE|PROFESSIONAL\s+OBJECTIVE|PROFILE|ABOUT\s+ME|ABOUT)\s*:?\s*$/i;
    const sectionHeaderRegex = /^(EXPERIENCE|PROFESSIONAL\s+EXPERIENCE|WORK\s+EXPERIENCE|EMPLOYMENT(?:\s+HISTORY)?|WORK\s+HISTORY|CAREER\s+HISTORY|EDUCATION|ACADEMIC\s+BACKGROUND|SKILLS|TECHNICAL\s+SKILLS|CORE\s+COMPETENCIES|PROJECTS|CERTIFICATIONS|AWARDS|REFERENCES|ACCOMPLISHMENTS)\s*:?\s*$/i;
    
    // Debug: log first 30 lines to understand PDF extraction format
    console.log('=== FIRST 30 LINES OF RESUME ===');
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      console.log(`  Line ${i}: [${lines[i].length} chars] "${lines[i].substring(0, 120)}"`);
    }
    console.log('=== END FIRST 30 LINES ===');
    
    let summaryLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (summaryHeaderRegex.test(lines[i])) {
        summaryLineIndex = i;
        console.log(`[Summary] Found summary header at line ${i}: "${lines[i]}"`);
        break;
      }
    }
    
    if (summaryLineIndex === -1) {
      // Fallback: try matching lines that START with a summary header keyword
      // PDF extraction may merge the header with the next line
      console.log('[Summary] No standalone summary header found, trying prefix match...');
      const summaryPrefixRegex = /^(PROFESSIONAL\s+SUMMARY|EXECUTIVE\s+SUMMARY|CAREER\s+SUMMARY|PROFILE\s+SUMMARY|SUMMARY\s+OF\s+QUALIFICATIONS|SUMMARY|OBJECTIVE|CAREER\s+OBJECTIVE|PROFESSIONAL\s+OBJECTIVE|PROFILE|ABOUT\s+ME|ABOUT)\s*:?\s*/i;
      
      for (let i = 0; i < lines.length; i++) {
        const prefixMatch = lines[i].match(summaryPrefixRegex);
        if (prefixMatch && lines[i].length > prefixMatch[0].length + 10) {
          // The header and summary text are merged on the same line
          summaryLineIndex = i;
          // Extract the text after the header
          const afterHeader = lines[i].substring(prefixMatch[0].length).trim();
          console.log(`[Summary] Found merged summary header at line ${i}, text starts: "${afterHeader.substring(0, 80)}..."`);
          // Replace the line with just the text (so the collection loop below works)
          lines[i] = afterHeader;
          // Adjust so the loop below starts at the current line (includes the text portion)
          summaryLineIndex = i - 1;
          break;
        }
      }
    }
    
    if (summaryLineIndex !== -1) {
      // Collect lines after the summary header until the next section header
      // Only match SHORT standalone header lines to avoid false matches on paragraph text
      // that happens to start with a keyword like "experience"
      const summaryParts = [];
      for (let i = summaryLineIndex + 1; i < lines.length; i++) {
        // A section header must be a short line (< 60 chars) matching a known pattern
        if (lines[i].length < 60 && sectionHeaderRegex.test(lines[i])) {
          console.log(`[Summary] Hit next section at line ${i}: "${lines[i].substring(0, 60)}"`);
          break;
        }
        summaryParts.push(lines[i]);
      }
      
      const cleanedSummary = summaryParts.join(' ').replace(/\s+/g, ' ').trim();
      if (cleanedSummary.length >= 20) {
        summary = cleanedSummary;
        console.log('Extracted professional summary from resume:', summary.substring(0, 100) + '...');
      }
    }
    
    // Fallback: generate a simple summary if none was extracted
    if (!summary) {
      summary = title 
        ? `Experienced ${title} with expertise in ${skills.slice(0, 5).join(', ')}.`
        : skills.length > 0 
          ? `Professional with skills in ${skills.slice(0, 5).join(', ')}.`
          : null;
    }
    
    return {
      firstName,
      lastName,
      email,
      phone,
      linkedinUrl,
      githubUrl,
      website,
      location,
      title,
      summary,
      skills,
      experience,
      education,
      projects: []
    };
  }

  /**
   * Parse date string to ISO format (YYYY-MM-DD)
   */
  parseDateToISO(dateStr) {
    if (!dateStr) return null;
    
    const monthMap = {
      jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
      apr: '04', april: '04', may: '05', jun: '06', june: '06',
      jul: '07', july: '07', aug: '08', august: '08', sep: '09', sept: '09', september: '09',
      oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12'
    };
    
    // Match "Month Year" or "Mon Year" pattern
    const match = dateStr.match(/([A-Za-z]+)\.?\s*(\d{4})/);
    if (match) {
      const month = monthMap[match[1].toLowerCase()] || '01';
      const year = match[2];
      return `${year}-${month}-01`;
    }
    
    // Match just year
    const yearMatch = dateStr.match(/(\d{4})/);
    if (yearMatch) {
      return `${yearMatch[1]}-01-01`;
    }
    
    return null;
  }

  /**
   * Complete resume parsing pipeline (NO AI - uses pattern matching)
   */
  async parseResume(file) {
    try {
      // Step 1: Extract text from file
      console.log('Extracting text from resume...');
      const resumeText = await this.extractTextFromResume(file);
      
      if (!resumeText || resumeText.trim().length < 50) {
        throw new Error('Resume appears to be empty or too short');
      }

      console.log(`Extracted ${resumeText.length} characters from resume`);

      // Step 2: Parse with pattern matching (NO AI)
      console.log('Parsing resume with pattern matching...');
      const parsedData = this.parseResumeWithPatterns(resumeText);

      console.log('Resume parsed successfully');
      
      return {
        success: true,
        data: parsedData,
        originalText: resumeText.substring(0, 500) // Keep first 500 chars for reference
      };
    } catch (error) {
      console.error('Resume parsing error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enhance profile data with AI-powered improvements (department-aware)
   */
  async enhanceProfileData(profileData, customPrompt = '') {
    try {
      // Classify the candidate's department group for prompt selection
      const classification = classifyDepartment(profileData);
      console.log(`[ProfilleAI] Department classification: group=${classification.group}, confidence=${classification.confidence}`);

      // Get the department-specific enhancement prompt
      const promptConfig = getDepartmentEnhancementPrompt(classification.group, profileData, customPrompt);

      const responseText = await callAI({
        system: promptConfig.system,
        prompt: promptConfig.prompt,
        temperature: promptConfig.temperature,
        max_tokens: promptConfig.max_tokens
      });
      
      // Remove markdown code blocks if present
      let jsonText = responseText;
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      const enhancedData = JSON.parse(jsonText);
      
      return {
        success: true,
        data: enhancedData
      };
    } catch (error) {
      console.error('Error enhancing profile:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate specific enhancement suggestions without modifying data
   */
  async getEnhancementSuggestions(profileData) {
    try {
      const prompt = `You are an expert career coach. Review this profile and provide specific, actionable suggestions to improve it.

Profile Data:
${JSON.stringify(profileData, null, 2)}

Provide suggestions in the following JSON format:
{
  "summaryTips": [
    {"current": "issue with current summary", "suggestion": "specific improvement suggestion"}
  ],
  "experienceTips": [
    {"role": "Job Title at Company", "tip": "specific suggestion to improve this experience entry"}
  ],
  "skillsTips": [
    {"tip": "suggestion about skills organization or missing skills"}
  ],
  "projectTips": [
    {"project": "Project Name", "tip": "suggestion to improve project description"}
  ],
  "generalTips": [
    "Overall suggestion 1",
    "Overall suggestion 2"
  ],
  "missingElements": [
    "Element that would strengthen the profile"
  ],
  "strengthsToHighlight": [
    "Strength that should be emphasized more"
  ]
}

Be specific and actionable. Return ONLY valid JSON.`;

      const responseText = await callAI({
        system: 'You are a career coach providing specific, actionable feedback to improve professional profiles.',
        prompt,
        temperature: 0.7,
        max_tokens: 2000
      });
      
      let jsonText = responseText;
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      const suggestions = JSON.parse(jsonText);
      
      return {
        success: true,
        suggestions
      };
    } catch (error) {
      console.error('Error getting enhancement suggestions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze skill gaps between a candidate's profile/resume and a job description.
   * Returns categorized gaps the user can accept/skip before tailoring.
   * @param {Object} profileData - Structured profile data
   * @param {string} jobDescription - The job posting text
   * @param {string|null} originalResumeText - Raw resume text if available
   * @returns {{ success: boolean, gaps: Array<{ skill: string, category: string, severity: string, description: string, learningResource: string }> }}
   */
  async analyzeResumeGaps(profileData, jobDescription, originalResumeText = null) {
    try {
      const hasResume = originalResumeText && originalResumeText.trim().length > 100;

      const candidateInfo = hasResume
        ? `CANDIDATE'S RESUME:\n${originalResumeText}\n\nSTRUCTURED DATA (supplementary):\n${JSON.stringify(profileData, null, 2)}`
        : `CANDIDATE'S PROFILE:\n${JSON.stringify(profileData, null, 2)}`;

      const prompt = `You are a career gap analyst. Compare the candidate's profile/resume against the job description and identify skill/requirement gaps — but you MUST correctly handle OR-patterns, preferred vs required language, and technology families.

${candidateInfo}

JOB DESCRIPTION:
${jobDescription}

═══ CRITICAL RULES FOR GAP DETECTION ═══

1. OR-PATTERN DETECTION:
   When a job description lists alternatives (e.g., "React, Angular, or Vue.js", "Python or Java", "AWS or Azure or GCP"),
   the candidate only needs ONE of the alternatives to satisfy the requirement.
   - If the candidate has React, do NOT flag Vue.js or Angular as gaps.
   - Only flag a gap if the candidate has NONE of the listed alternatives.

2. TECHNOLOGY FAMILY GROUPING:
   Treat equivalent technologies in the same family as interchangeable:
   - Frontend frameworks: React, Vue.js, Angular, Svelte
   - Backend languages: Python, Java, C#, Go, Node.js
   - Cloud providers: AWS, Azure, GCP
   - Databases: PostgreSQL, MySQL, MongoDB, DynamoDB
   - Container orchestration: Kubernetes, Docker Swarm, ECS
   If the job requires "a frontend framework" and the candidate has React, do NOT flag other frameworks.

3. REQUIRED vs PREFERRED LANGUAGE:
   - "Required", "must have", "essential", "mandatory" → severity "critical", type "required"
   - "Preferred", "nice to have", "bonus", "ideally", "a plus", "desirable" → severity "nice_to_have", type "nice_to_have"
   - "Strongly preferred", "highly desired" → severity "important", type "nice_to_have"

4. IMPLIED/ADJACENT SKILLS:
   Do NOT flag skills that are implied by what the candidate already has:
   - React → JSX, component architecture, virtual DOM (not gaps)
   - Python → pip, basic scripting (not gaps)
   - Full-stack developer → basic understanding of both frontend and backend (not gaps)

5. suggest_adding FIELD:
   - Set to true ONLY if the candidate genuinely lacks this skill AND it's not covered by an OR-alternative they already have.
   - Set to false if the candidate already satisfies the requirement via an OR-pattern alternative or technology family equivalent.

For each gap found, return a JSON array where each element has:
- "skill": The specific skill, technology, or requirement (concise, 2-5 words)
- "category": One of "technical", "experience", "certification", "soft_skill", "domain_knowledge"
- "severity": One of "critical" (must-have), "important" (strongly preferred), "nice_to_have"
- "type": One of "required" (job explicitly requires it) or "nice_to_have" (preferred/optional/one of several alternatives)
- "suggest_adding": boolean — true if this is a genuine gap the candidate should address, false if already covered by an alternative
- "reason": 1-sentence explanation of WHY this is or isn't a real gap (mention OR-patterns if applicable, e.g., "JD lists React OR Vue — candidate has React, this is optional")
- "description": A 1-sentence explanation of the gap
- "learningResource": A specific suggestion for how to learn/acquire this (online course, project idea, certification name, etc.)

Rules:
- Include BOTH genuine gaps (suggest_adding: true) AND satisfied alternatives (suggest_adding: false) so the user can see the full picture
- Do NOT list skills the candidate clearly already has as gaps
- Order by: suggest_adding true first, then by severity (critical → important → nice_to_have)
- Maximum 15 items total
- Be specific — "Kubernetes orchestration" not just "DevOps"

Return ONLY a valid JSON array, no additional text.`;

      const responseText = await callAI({
        system: 'You are a career gap analyst. You understand OR-patterns, required vs preferred language, and technology families. You correctly identify which gaps are real vs already covered by alternatives. Return valid JSON arrays only.',
        prompt,
        temperature: 0.3,
        max_tokens: 3000
      });

      let jsonText = responseText;
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      const allGaps = JSON.parse(jsonText);
      const parsed = Array.isArray(allGaps) ? allGaps : [];

      // Split into actionable gaps vs satisfied alternatives
      const gaps = parsed.filter(g => g.suggest_adding !== false);
      const satisfiedAlternatives = parsed.filter(g => g.suggest_adding === false);

      console.log(`[ProfilleAI] Gap analysis: ${gaps.length} actionable gaps, ${satisfiedAlternatives.length} satisfied alternatives`);

      return {
        success: true,
        gaps,
        satisfiedAlternatives
      };
    } catch (error) {
      console.error('Error analyzing resume gaps:', error);
      // Re-throw overloaded errors so the route handler can return 503
      if (error.status === 529 || error.status === 503 || error.error?.type === 'overloaded_error') {
        throw error;
      }
      return {
        success: false,
        error: error.message,
        gaps: [],
        satisfiedAlternatives: []
      };
    }
  }

  /**
   * Tailor profile for a specific job description (using Claude API)
   * @param {Object} profileData - Structured profile data (title, summary, skills, experience, etc.)
   * @param {string} jobDescription - The job posting text
   * @param {string|null} originalResumeText - Raw text from the candidate's uploaded resume (PDF/DOCX)
   * @param {Object} gapSelections - Optional gap selections: { acceptedGaps: string[], skippedGaps: string[] }
   */
  async tailorProfileForJob(profileData, jobDescription, originalResumeText = null, gapSelections = null, tailorSettings = null) {
    try {
      const hasUploadedResume = originalResumeText && originalResumeText.trim().length > 100;

      // ═══════════════════════════════════════════════════════════════
      // STEP 1: EXTRACT KEYWORDS FROM JOB DESCRIPTION (separate AI call)
      // This ensures we have an EXPLICIT list of keywords to inject,
      // rather than hoping the AI "figures it out" during tailoring.
      // ═══════════════════════════════════════════════════════════════
      console.log('[ProfilleAI] Step 1: Extracting keywords from job description...');
      let extractedKeywords = { required: [], preferred: [], soft: [], domain: [] };
      try {
        const keywordResponse = await callAI({
          system: 'You extract SKILLS and TOOLS from job postings for ANY industry. You detect OR-patterns and alternative skill groups. Return ONLY valid JSON, nothing else.',
          prompt: `Extract ONLY the specific skills, tools, technologies, certifications, and methodologies from this job posting.

JOB POSTING:
${jobDescription}

Return JSON:
{
  "required": ["ONLY specific skills/tools/technologies that are REQUIRED — each item should be a single skill name like 'Vue.js', 'Python', 'REST APIs', 'Agile', 'PMP certification'"],
  "preferred": ["skills/tools listed as preferred/nice-to-have/bonus — same format, single skill names only"],
  "soft": ["soft skills — like 'cross-functional collaboration', 'mentoring', 'problem-solving'"],
  "domain": ["domain-specific technical terms — like 'distributed systems', 'microservices', 'data visualization'"],
  "orGroups": [["React", "Vue.js", "Angular"], ["AWS", "Azure", "GCP"]],
  "jobTitle": "exact job title from posting",
  "company": "company name if mentioned"
}

CRITICAL RULES — what to INCLUDE vs EXCLUDE:
INCLUDE: Specific skill names, tool names, framework names, language names, methodology names, certification names
  Examples: "Vue.js", "Python", "REST APIs", "Agile", "cross-browser compatibility", "object-oriented design", "data structures"
EXCLUDE — do NOT include any of these:
  - Degree requirements (e.g., "Bachelors in computer science" — this is NOT a skill)
  - Years of experience (e.g., "5+ years of experience" — this is NOT a skill)
  - Vague phrases (e.g., "equivalent experience", "related engineering")
  - Job duties/descriptions (e.g., "working on frontend design", "collecting requirements")
  - Sentence fragments (e.g., "design solutions to mitigate them")

OR-GROUPS RULE:
When the job posting lists alternatives (e.g., "React, Angular, or Vue.js", "Python or Java", "AWS or Azure"),
include each individual skill in the required/preferred arrays AND also list the group in "orGroups".
Each orGroup is an array of the alternative skills that satisfy the SAME requirement.
If there are no OR-patterns, return "orGroups": [].
  
Each item in the arrays must be a SHORT skill/tool name (1-5 words max). No sentences.`,
          max_tokens: 1000,
          temperature: 0.1
        });
        
        let kwJson = keywordResponse;
        if (kwJson.startsWith('```')) kwJson = kwJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        extractedKeywords = JSON.parse(kwJson);
        
        // Programmatic filter: remove anything that's not actually a skill name
        const isValidSkill = (kw) => {
          if (!kw || typeof kw !== 'string') return false;
          const lower = kw.toLowerCase().trim();
          // Too long to be a skill name (more than 6 words)
          if (lower.split(/\s+/).length > 6) return false;
          // Degree/education requirements
          if (/\b(bachelor|master|phd|degree|diploma|university|college|education|equivalent experience)\b/i.test(lower)) return false;
          // Years of experience
          if (/\b\d+\+?\s*(years?|yrs?)\b/i.test(lower)) return false;
          // Vague phrases
          if (/\b(or equivalent|related engineering|or related|and equivalent)\b/i.test(lower)) return false;
          // Sentence fragments with verbs
          if (/\b(working on|collecting|providing|solutions to|mitigate them|design solutions)\b/i.test(lower)) return false;
          return true;
        };
        
        extractedKeywords.required = (extractedKeywords.required || []).filter(isValidSkill);
        extractedKeywords.preferred = (extractedKeywords.preferred || []).filter(isValidSkill);
        extractedKeywords.soft = (extractedKeywords.soft || []).filter(isValidSkill);
        extractedKeywords.domain = (extractedKeywords.domain || []).filter(isValidSkill);
        
        console.log('[ProfilleAI] Extracted required keywords:', extractedKeywords.required);
        console.log('[ProfilleAI] Extracted preferred keywords:', extractedKeywords.preferred);
        console.log('[ProfilleAI] Extracted domain terms:', extractedKeywords.domain);
        console.log('[ProfilleAI] Detected OR-groups:', extractedKeywords.orGroups || []);
      } catch (kwError) {
        console.error('[ProfilleAI] Keyword extraction failed, continuing with prompt-only approach:', kwError.message);
      }

      const allRequiredKeywords = [...(extractedKeywords.required || []), ...(extractedKeywords.preferred || [])];
      const allKeywords = [...allRequiredKeywords, ...(extractedKeywords.soft || []), ...(extractedKeywords.domain || [])];
      
      // Build the explicit keyword injection block for the tailoring prompt
      const orGroups = extractedKeywords.orGroups || [];
      const orGroupsBlock = orGroups.length > 0 ? `
OR-GROUPS (alternatives — the candidate only needs ONE from each group):
${orGroups.map((group, i) => `  Group ${i + 1}: ${group.join(' OR ')}`).join('\n')}
If the candidate already has a skill from an OR-group, do NOT replace it with another from the same group. The existing skill takes priority.
` : '';

      const keywordBlock = allRequiredKeywords.length > 0 ? `
═══ TARGET KEYWORDS (extracted from job posting) ═══
REQUIRED SKILLS/TOOLS — ensure these appear in the SKILLS list:
${(extractedKeywords.required || []).map((k, i) => `  ${i + 1}. ${k}`).join('\n')}

PREFERRED SKILLS/TOOLS — include in SKILLS list if the candidate's background supports them:
${(extractedKeywords.preferred || []).map((k, i) => `  ${i + 1}. ${k}`).join('\n')}

DOMAIN TERMS — use naturally in SUMMARY when relevant:
${(extractedKeywords.domain || []).map((k, i) => `  ${i + 1}. ${k}`).join('\n')}
${orGroupsBlock}
NOTE: The SKILLS section is where keywords matter most for ATS. For EXPERIENCE entries, only use keywords that genuinely relate to what the candidate did in that specific role. Do NOT force all keywords into all entries.
` : '';

      // Build gap awareness context if user reviewed gaps
      let gapContext = '';
      if (gapSelections && (gapSelections.acceptedGaps?.length || gapSelections.skippedGaps?.length)) {
        const accepted = gapSelections.acceptedGaps || [];
        const skipped = gapSelections.skippedGaps || [];
        const acceptedObjects = gapSelections.acceptedGapObjects || [];
        
        // Build rich gap context with type metadata
        const formatGapWithType = (gapName) => {
          const gapObj = acceptedObjects.find(g => g.skill === gapName);
          if (gapObj) {
            const typeLabel = gapObj.type === 'required' ? 'REQUIRED' : 'NICE-TO-HAVE';
            return `• ${gapName} [${typeLabel}]${gapObj.reason ? ` — ${gapObj.reason}` : ''}`;
          }
          return `• ${gapName}`;
        };

        gapContext = `
═══ CANDIDATE'S GAP REVIEW DECISIONS ═══
The candidate reviewed their skill gaps and made these decisions:
${accepted.length > 0 ? `ACCEPTED GAPS (candidate wants these added to their resume):
${accepted.map(g => formatGapWithType(g)).join('\n')}

IMPORTANT RULES FOR ADDING ACCEPTED GAPS:
- For REQUIRED gaps: Add prominently — in Skills section AND as complementary mentions in Summary/Experience where relevant.
- For NICE-TO-HAVE gaps: Add primarily to Skills section. Only mention in Summary/Experience if genuinely relevant.
- NEVER replace the candidate's existing skills with gap skills. ADD alongside them.
- Use honest framing for skills the candidate doesn't have direct experience with: "familiar with", "exposure to", "experience with adjacent patterns in [X]"
- The candidate's PRIMARY technology stack must remain dominant throughout.` : ''}
${skipped.length > 0 ? `SKIPPED GAPS (candidate believes they already have these or they don't apply — try to highlight existing relevant experience):
${skipped.map(g => `• ${g}`).join('\n')}` : ''}
`;
      }

      // Build user preferences context if settings provided
      let settingsContext = '';
      if (tailorSettings) {
        const toneDesc = {
          concise: 'Use concise, ATS-friendly bullet-point style. Keep sentences short and impactful.',
          professional: 'Use a balanced professional tone with clear, well-structured prose.',
          detailed: 'Use rich, detailed descriptions that provide full context and depth.',
        };
        const parts = [];
        parts.push(`WRITING TONE: ${toneDesc[tailorSettings.tone] || toneDesc.professional}`);
        if (tailorSettings.summaryLines) {
          parts.push(`SUMMARY LENGTH: Write the summary in approximately ${tailorSettings.summaryLines} lines/sentences.`);
        }
        if (tailorSettings.experienceLines) {
          parts.push(`EXPERIENCE DESCRIPTION LENGTH: Each experience entry description should be approximately ${tailorSettings.experienceLines} lines/sentences long.`);
        }
        if (tailorSettings.maxSkills) {
          parts.push(`SKILLS LIST: Include at most ${tailorSettings.maxSkills} skills total, prioritizing the most job-relevant ones.`);
        }
        if (tailorSettings.includeProjects === false) {
          parts.push('PROJECTS: Omit the projects section entirely. Return an empty array for projects.');
        }
        if (tailorSettings.focusAreas && tailorSettings.focusAreas.length > 0) {
          parts.push(`EMPHASIS AREAS: Especially emphasize these aspects throughout the resume: ${tailorSettings.focusAreas.join(', ')}. Weave these themes more prominently into descriptions.`);
        }
        settingsContext = `\n═══ USER'S TAILORING PREFERENCES ═══\n${parts.join('\n')}\n`;
      }

      // Determine the number of experience entries
      const expCount = (profileData.experience || []).length;

      // ═══════════════════════════════════════════════════════════════
      // DEPARTMENT-AWARE PROMPT: Master prompt + role-specific addon
      // ═══════════════════════════════════════════════════════════════
      const classification = classifyDepartment(profileData);
      console.log(`[ProfilleAI] Department classification: group=${classification.group}, confidence=${classification.confidence}`);

      const tailoringConfig = buildTailoringPrompt({
        group: classification.group,
        originalResumeText: hasUploadedResume ? originalResumeText : null,
        profileData,
        jobDescription,
        gapContext,
        settingsContext,
        extractedKeywords,
        expCount
      });

      console.log(`[ProfilleAI] Step 2: Tailoring resume (${hasUploadedResume ? 'PATH A: uploaded resume' : 'PATH B: profile data'}, role: ${classification.group})...`);

      let responseText;
      responseText = await callAI({
        system: tailoringConfig.system,
        prompt: tailoringConfig.prompt,
        temperature: tailoringConfig.temperature,
        max_tokens: tailoringConfig.max_tokens
      });
      
      let jsonText = responseText;
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      const tailoredData = JSON.parse(jsonText);

      // Ensure changelog array exists (AI should have returned it, but be safe)
      if (!Array.isArray(tailoredData.changelog)) {
        tailoredData.changelog = [];
      }

      // ═══════════════════════════════════════════════════════════════
      // STEP 3: POST-PROCESSING — keyword verification & injection into skills only
      // ═══════════════════════════════════════════════════════════════

      // Normalize skills: support both grouped object and flat array formats
      const flattenSkills = (skills) => {
        if (!skills) return [];
        if (Array.isArray(skills)) return skills;
        if (typeof skills === 'object') return Object.values(skills).flat();
        return [];
      };

      if (allRequiredKeywords.length > 0) {
        console.log('[ProfilleAI] Step 3: Verifying keyword coverage...');
        console.log('[ProfilleAI] Checking for these keywords:', allRequiredKeywords);

        // Build full resume text for checking
        const buildResumeText = () => [
          tailoredData.summary || '',
          ...flattenSkills(tailoredData.skills),
          ...(tailoredData.experience || []).map(e => e.description || ''),
          ...(tailoredData.projects || []).map(p => p.description || '')
        ].join(' ').toLowerCase();

        let resumeText = buildResumeText();

        const missingKeywords = allRequiredKeywords.filter(kw => {
          const kwLower = kw.toLowerCase();
          return !resumeText.includes(kwLower);
        });

        if (missingKeywords.length > 0) {
          console.log('[ProfilleAI] ⚠️ Missing keywords detected:', missingKeywords);

          // INJECTION: Add missing keywords to skills
          const allSkillsFlat = flattenSkills(tailoredData.skills);
          const currentSkillsLower = new Set(allSkillsFlat.map(s => s.toLowerCase()));
          const injectedSkills = [];
          for (const kw of missingKeywords) {
            if (!currentSkillsLower.has(kw.toLowerCase())) {
              // If skills is a grouped object, add to a "Other" category
              if (tailoredData.skills && !Array.isArray(tailoredData.skills) && typeof tailoredData.skills === 'object') {
                if (!tailoredData.skills['Other']) tailoredData.skills['Other'] = [];
                tailoredData.skills['Other'].push(kw);
              } else {
                // Flat array
                if (!Array.isArray(tailoredData.skills)) tailoredData.skills = [];
                tailoredData.skills.push(kw);
              }
              currentSkillsLower.add(kw.toLowerCase());
              injectedSkills.push(kw);
              console.log(`[ProfilleAI]   → Injected "${kw}" into skills`);
            }
          }

          // Add changelog entry for post-processing injections
          if (injectedSkills.length > 0) {
            tailoredData.changelog.push({
              section: 'skills',
              action: 'auto_injected',
              detail: `Post-processing: Added ${injectedSkills.join(', ')} to skills (missing from AI output)`
            });
          }
        } else {
          console.log('[ProfilleAI] ✅ All required keywords present in tailored resume.');
        }

        // Final verification log
        const finalText = buildResumeText();
        const finalMissing = allRequiredKeywords.filter(kw => !finalText.includes(kw.toLowerCase()));
        if (finalMissing.length > 0) {
          console.log('[ProfilleAI] ⚠️ FINAL CHECK - still missing after injection:', finalMissing);
        } else {
          console.log('[ProfilleAI] ✅ FINAL CHECK - all keywords confirmed present.');
        }
        console.log('[ProfilleAI] Final skills list:', tailoredData.skills);
      }

      console.log('[ProfilleAI] Final skills list:', tailoredData.skills);

      // Normalize skills: keep grouped format as skillsGrouped, flatten skills to array
      if (tailoredData.skills && !Array.isArray(tailoredData.skills) && typeof tailoredData.skills === 'object') {
        tailoredData.skillsGrouped = tailoredData.skills;
        tailoredData.skills = Object.values(tailoredData.skills).flat();
      }

      // Sanitize text fields — strip characters that ATS platforms (Workday etc.) reject
      const sanitizeATS = (str) => typeof str === 'string' ? str.replace(/[<>\[\]"{}\\]/g, '') : str;
      if (tailoredData.summary) tailoredData.summary = sanitizeATS(tailoredData.summary);
      if (Array.isArray(tailoredData.experience)) {
        tailoredData.experience = tailoredData.experience.map(e => ({
          ...e,
          description: sanitizeATS(e.description)
        }));
      }
      if (Array.isArray(tailoredData.projects)) {
        tailoredData.projects = tailoredData.projects.map(p => ({
          ...p,
          description: sanitizeATS(p.description)
        }));
      }

      // Hard enforce includeProjects=false. The AI prompt asks for an empty
      // array, but models occasionally re-emit projects anyway — strip them
      // unconditionally so the user's toggle is always respected.
      if (tailorSettings && tailorSettings.includeProjects === false) {
        tailoredData.projects = [];
      }

      return {
        success: true,
        data: tailoredData
      };
    } catch (error) {
      console.error('Error tailoring profile for job:', error);
      // Re-throw overloaded errors so the route handler can return 503
      if (error.status === 529 || error.status === 503 || error.error?.type === 'overloaded_error') {
        throw error;
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate personalized interview preparation based on interview level, 
   * skill gaps, and candidate profile
   */
  async generateInterviewPrep({ jobTitle, companyName, interviewLevel, interviewFormat, specificConcerns, skillGaps, matchAnalysis, jobLevel, candidateProfile }) {
    try {
      const gapsList = skillGaps.map(g => `${g.skill} (${g.severity || 'unknown'} severity)`).join(', ');
      const strongList = (matchAnalysis.strongMatches || []).join(', ');
      const gapNames = (matchAnalysis.gaps || []).join(', ');

      const prompt = `You are an expert interview coach. A candidate is preparing for a specific interview. Generate a comprehensive, personalized interview preparation guide.

═══ CONTEXT ═══
Job Title: ${jobTitle}
Company: ${companyName || 'Not specified'}
Position Level: ${jobLevel.level || 'Unknown'} (${jobLevel.yearsExpected || 'N/A'} expected)
${jobLevel.summary ? `Level Details: ${jobLevel.summary}` : ''}

═══ INTERVIEW DETAILS ═══
Interview Round/Stage: ${interviewLevel}
Interview Format: ${interviewFormat}
${specificConcerns ? `Candidate's Specific Concerns: ${specificConcerns}` : ''}

═══ CANDIDATE CONTEXT ═══
Current Role: ${candidateProfile.headline}
Key Skills: ${Array.isArray(candidateProfile.skills) ? candidateProfile.skills.slice(0, 20).join(', ') : 'N/A'}

═══ GAP ANALYSIS ═══
Strong Matches: ${strongList || 'None identified'}
Skill Gaps: ${gapsList || 'None identified'}
Missing Requirements: ${gapNames || 'None identified'}

═══ YOUR TASK ═══
Generate a DETAILED interview prep guide specifically for this "${interviewLevel}" round. The prep should be highly specific to:
1. The interview round/stage (e.g., phone screen questions are different from onsite system design)
2. The candidate's gaps (help them prepare for tricky questions about their weak areas)
3. The position level (${jobLevel.level || 'unknown'} level expectations)

Return a JSON object with this EXACT structure:
{
  "roundOverview": "2-3 sentence overview of what to expect in this specific interview round, what the interviewer is evaluating, and typical duration",
  "expectedTopics": ["List of 5-8 specific topics likely to come up in THIS round"],
  "technicalQuestions": [
    {
      "question": "A specific technical question",
      "whyAsked": "Why this is likely to be asked based on the job/gaps",
      "suggestedApproach": "How the candidate should approach answering this",
      "relatedGap": "Which skill gap this relates to, if any"
    }
  ],
  "behavioralQuestions": [
    {
      "question": "A specific behavioral question",
      "whyAsked": "Why this is relevant for this role/level",
      "starExample": "A suggested STAR structure the candidate can use based on their experience"
    }
  ],
  "questionsToAsk": ["3-5 thoughtful questions the candidate should ask the interviewer, tailored to the company and round"],
  "talkingPoints": ["5-7 specific achievements or experiences from the candidate's background they should proactively mention"],
  "gapMitigation": [
    {
      "gap": "The skill gap",
      "strategy": "How to handle questions about this gap — what to say, how to frame it positively"
    }
  ],
  "areasToStudy": [
    {
      "topic": "Specific topic or technology to study",
      "priority": "high|medium|low",
      "resources": "Suggested resources or what to focus on"
    }
  ],
  "dosAndDonts": {
    "dos": ["4-5 specific do's for this interview round"],
    "donts": ["4-5 specific don'ts for this interview round"]
  },
  "levelExpectations": "What is specifically expected at the ${jobLevel.level || 'this'} level in this type of interview — the bar the candidate needs to clear",
  "timelinePlan": "Suggested study/preparation timeline leading up to the interview"
}

Generate 4-6 technical questions and 3-4 behavioral questions. Be highly specific — no generic advice.
Return ONLY valid JSON, no additional text.`;

      const responseText = await callAI({
        system: 'You are an expert interview coach who prepares candidates for tech interviews. You give specific, actionable advice based on the candidate\'s profile and gaps. Always return valid JSON only.',
        prompt,
        temperature: 0.6,
        max_tokens: 4000
      });

      let jsonText = responseText;
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      const prepData = JSON.parse(jsonText);

      return {
        success: true,
        data: prepData
      };
    } catch (error) {
      console.error('Error generating interview prep:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ResumeParserService();
