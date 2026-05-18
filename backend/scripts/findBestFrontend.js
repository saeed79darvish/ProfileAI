const { Profile, User } = require("../models");
const { Op } = require("sequelize");

async function findBestFrontend() {
  const profiles = await Profile.findAll({
    include: [{ model: User, as: 'user', attributes: ["email"] }],
    where: {
      [Op.or]: [
        { title: { [Op.iLike]: "%frontend%" } },
        { title: { [Op.iLike]: "%front-end%" } },
        { title: { [Op.iLike]: "%full-stack%" } },
        { title: { [Op.iLike]: "%fullstack%" } },
        { headline: { [Op.iLike]: "%frontend%" } },
        { headline: { [Op.iLike]: "%react%" } }
      ]
    }
  });
  
  console.log("=== BEST FRONTEND DEVELOPERS ===\n");
  
  // Score them based on frontend skills and experience
  const scored = profiles.map(p => {
    let score = 0;
    let skillsObj = p.skills || {};
    
    // Skills is an object with categories like { frontend: [...], backend: [...] }
    // Flatten all skills into one array
    let allSkills = [];
    if (typeof skillsObj === 'object' && !Array.isArray(skillsObj)) {
      Object.values(skillsObj).forEach(arr => {
        if (Array.isArray(arr)) allSkills = allSkills.concat(arr);
      });
    } else if (Array.isArray(skillsObj)) {
      allSkills = skillsObj;
    }
    
    const title = (p.title || "").toLowerCase();
    
    // Extract years from experience array
    let totalYears = 0;
    const exp = p.experience || [];
    if (Array.isArray(exp)) {
      exp.forEach(e => {
        if (e.years) totalYears += parseInt(e.years) || 0;
        else if (e.duration) {
          const match = e.duration.match(/(\d+)/);
          if (match) totalYears += parseInt(match[1]) || 0;
        }
      });
    }
    
    // Frontend skills (10 points each)
    const frontendSkills = ["react", "vue", "angular", "javascript", "typescript", "css", "html", "redux", "next.js", "tailwind"];
    frontendSkills.forEach(s => {
      if (allSkills.some(sk => sk.toLowerCase().includes(s))) score += 10;
    });
    
    // Bonus for having frontend category
    if (skillsObj.frontend && skillsObj.frontend.length > 0) {
      score += skillsObj.frontend.length * 5;
    }
    
    // Title bonus
    if (title.includes("senior")) score += 15;
    if (title.includes("lead")) score += 20;
    if (title.includes("frontend") || title.includes("front-end")) score += 25;
    if (title.includes("full-stack") || title.includes("fullstack")) score += 15;
    
    // Experience (3 points per year, max 30)
    score += Math.min(totalYears * 3, 30);
    
    return { 
      name: p.fullName || p.user?.email,
      title: p.title,
      experience: totalYears,
      skills: allSkills.slice(0, 8).join(", "),
      frontendSkills: (skillsObj.frontend || []).join(", "),
      score
    };
  });
  
  scored.sort((a, b) => b.score - a.score);
  
  scored.slice(0, 10).forEach((c, i) => {
    console.log(`${i + 1}. ${c.name} (Score: ${c.score})`);
    console.log(`   Title: ${c.title}`);
    console.log(`   Experience: ${c.experience} years`);
    console.log(`   Frontend Skills: ${c.frontendSkills || 'N/A'}`);
    console.log(`   All Skills: ${c.skills}`);
    console.log("");
  });
  
  process.exit(0);
}

findBestFrontend().catch(err => {
  console.error(err);
  process.exit(1);
});
