/**
 * Department Group Classifier
 * 
 * Classifies a candidate's profile into one of 6 department groups
 * for department-aware resume enhancement prompts.
 * 
 * Groups:
 *   1. engineering    — Engineering, Software, AI/ML, Security, Data, Hardware, Defense/Aerospace
 *   2. sales          — Sales, Business Development, Account Management
 *   3. product_ops    — Product Management, Marketing, GTM, Operations
 *   4. design         — UX, UI, Brand, Motion, Design Systems
 *   5. people_legal   — HR, Legal, Compliance, Customer Success, Support
 *   6. finance        — Finance, Accounting, FP&A, Audit, Treasury
 */

const GROUP_PATTERNS = {
  engineering: {
    titles: [
      /\b(software|backend|frontend|full[- ]?stack|devops|sre|platform|cloud|data|ml|machine learning|ai|deep learning)\b/i,
      /\b(engineer|developer|architect|programmer|cto|vp.*engineering|head.*engineering)\b/i,
      /\b(security|infosec|cyber|penetration|soc)\b.*\b(engineer|analyst|architect|specialist)\b/i,
      /\b(hardware|firmware|embedded|electrical|mechanical|manufacturing|aerospace|defense)\b.*\b(engineer|designer|scientist)\b/i,
      /\b(data scientist|data analyst|data engineer|analytics engineer|research scientist)\b/i,
      /\b(qa|quality|test|sdet|automation)\b.*\b(engineer|lead|manager)\b/i,
    ],
    skills: [
      /\b(javascript|typescript|python|java|c\+\+|go|rust|ruby|swift|kotlin|scala|php|sql)\b/i,
      /\b(react|angular|vue|node|django|flask|spring|rails|kubernetes|docker|terraform|aws|azure|gcp)\b/i,
      /\b(pytorch|tensorflow|scikit|pandas|spark|hadoop|kafka|redis|mongodb|postgresql|mysql)\b/i,
      /\b(ci\/cd|jenkins|github actions|gitlab|ansible|puppet|chef|prometheus|grafana)\b/i,
      /\b(verilog|vhdl|fpga|pcb|solidworks|autocad|catia|matlab|simulink)\b/i,
      /\b(penetration testing|siem|splunk|crowdstrike|nessus|burp suite|oscp|cissp)\b/i,
    ],
  },
  sales: {
    titles: [
      /\b(sales|account executive|account manager|business development|bdr|sdr)\b/i,
      /\b(sales engineer|solutions consultant|pre-?sales|sales manager|vp.*sales|chief revenue|cro)\b/i,
      /\b(territory|quota|revenue|partnership|channel)\b.*\b(manager|director|lead|rep)\b/i,
    ],
    skills: [
      /\b(salesforce|hubspot|outreach|salesloft|gong|clari|linkedin sales navigator)\b/i,
      /\b(meddic|meddicc|challenger|spin|sandler|solution selling|value selling)\b/i,
      /\b(pipeline|quota|arr|mrr|deal size|cold call|prospecting|negotiation)\b/i,
    ],
  },
  product_ops: {
    titles: [
      /\b(product manager|product owner|program manager|product lead|vp.*product|chief product|cpo)\b/i,
      /\b(marketing|growth|demand gen|content|brand|communications|pr|gtm|go.to.market)\b/i,
      /\b(operations|ops manager|chief operating|coo|supply chain|logistics|procurement)\b/i,
      /\b(revenue operations|revops|marketing operations|bizops|strategy.*operations)\b/i,
    ],
    skills: [
      /\b(jira|asana|trello|notion|productboard|amplitude|mixpanel|pendo|fullstory)\b/i,
      /\b(google analytics|segment|marketo|pardot|mailchimp|semrush|ahrefs)\b/i,
      /\b(roadmap|okr|a\/b test|user research|market research|competitive analysis)\b/i,
      /\b(lean|six sigma|kaizen|kanban|scrum)\b/i,
    ],
  },
  design: {
    titles: [
      /\b(designer|design lead|design manager|head.*design|vp.*design|chief design|creative director)\b/i,
      /\b(ux|ui|product design|visual design|interaction design|motion design|brand design)\b/i,
      /\b(design system|ux research|user research|content design|service design)\b/i,
    ],
    skills: [
      /\b(figma|sketch|adobe xd|invision|framer|principle|origami)\b/i,
      /\b(illustrator|photoshop|after effects|premiere|blender|cinema 4d|rive|lottie)\b/i,
      /\b(design system|component library|style guide|brand guidelines|wcag|accessibility)\b/i,
      /\b(user testing|usability|wireframe|prototype|information architecture|journey map)\b/i,
    ],
  },
  people_legal: {
    titles: [
      /\b(hr|human resources|people|talent|recruiter|recruiting|hrbp)\b/i,
      /\b(legal|counsel|attorney|lawyer|paralegal|compliance|regulatory)\b/i,
      /\b(customer success|csm|customer experience|support|client success|client services)\b/i,
      /\b(compensation|benefits|total rewards|learning.*development|dei|diversity)\b/i,
    ],
    skills: [
      /\b(workday|bamboohr|greenhouse|lever|adp|paylocity|successfactors)\b/i,
      /\b(zendesk|intercom|freshdesk|gainsight|totango|churnzero|vitally)\b/i,
      /\b(soc ?2|gdpr|hipaa|iso|sox|pci|ccpa|ferpa)\b/i,
      /\b(contract|litigation|m&a|intellectual property|employment law|regulatory)\b/i,
    ],
  },
  finance: {
    titles: [
      /\b(finance|financial|fp&a|controller|accounting|accountant|auditor|treasury|tax)\b/i,
      /\b(cfo|chief financial|vp.*finance|director.*finance|bookkeeper)\b/i,
      /\b(investment|portfolio|fund|analyst.*finance|financial analyst)\b/i,
    ],
    skills: [
      /\b(excel|financial modeling|vlookup|pivot table|power bi|tableau)\b/i,
      /\b(netsuite|sap|quickbooks|oracle|workday financials|xero|sage)\b/i,
      /\b(gaap|ifrs|asc 606|revenue recognition|sox compliance|audit)\b/i,
      /\b(cpa|cfa|cma|acca|series 7|series 63)\b/i,
      /\b(forecast|budget|variance|reconcil|month.end close|p&l|balance sheet)\b/i,
    ],
  },
};

/**
 * Classify a profile into a department group.
 * 
 * @param {Object} profileData - The candidate's profile data
 * @param {string} profileData.title - Current job title
 * @param {string[]} profileData.skills - Array of skills
 * @param {Object[]} profileData.experience - Array of experience entries
 * @returns {{ group: string, confidence: string }} - Detected group and confidence level
 */
function classifyDepartment(profileData) {
  const title = (profileData.title || '').toLowerCase();
  const rawSkills = profileData.skills || [];
  const skillsArr = Array.isArray(rawSkills) ? rawSkills : Object.values(rawSkills).flat();
  const skills = skillsArr.map(s => (typeof s === 'string' ? s : s.name || '')).join(' ');
  const experienceTitles = (profileData.experience || []).map(e => (e.title || '')).join(' ').toLowerCase();
  const experienceDescs = (profileData.experience || []).map(e => (e.description || '')).join(' ');

  const scores = {};

  for (const [group, patterns] of Object.entries(GROUP_PATTERNS)) {
    let score = 0;

    // Title match (strongest signal — weight 3)
    for (const regex of patterns.titles) {
      if (regex.test(title)) score += 3;
      if (regex.test(experienceTitles)) score += 1;
    }

    // Skills match (weight 1 per match)
    for (const regex of patterns.skills) {
      if (regex.test(skills)) score += 1;
      if (regex.test(experienceDescs)) score += 0.5;
    }

    scores[group] = score;
  }

  // Find best match
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestGroup, bestScore] = sorted[0];
  const [, secondScore] = sorted[1] || [null, 0];

  // Determine confidence
  let confidence;
  if (bestScore === 0) {
    confidence = 'none';
  } else if (bestScore >= 5 && bestScore > secondScore * 1.5) {
    confidence = 'high';
  } else if (bestScore >= 2) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    group: bestScore > 0 ? bestGroup : 'engineering', // default to engineering if no match
    confidence,
    scores, // for debugging
  };
}

module.exports = { classifyDepartment, GROUP_PATTERNS };
