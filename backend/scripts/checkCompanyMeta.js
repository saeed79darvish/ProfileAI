require("dotenv").config();
const { ExternalJob } = require("../models");

async function main() {
  const sources = ["theirstack", "greenhouse", "ashby", "jsearch", "lever", "remoteok"];
  for (const src of sources) {
    const job = await ExternalJob.findOne({ where: { source: src }, raw: true, attributes: ["company", "metadata"] });
    if (!job) { console.log(`\n=== ${src}: no jobs`); continue; }
    console.log(`\n=== ${src} (${job.company}):`);
    console.log("  metadata keys:", Object.keys(job.metadata || {}).join(", "));
    if (job.metadata) {
      const m = job.metadata;
      // TheirStack fields
      if (m.company_domain) console.log("  company_domain:", m.company_domain);
      if (m.company_employee_count) console.log("  company_employee_count:", m.company_employee_count);
      if (m.company_industry) console.log("  company_industry:", m.company_industry);
      if (m.company_logo) console.log("  company_logo:", m.company_logo);
      if (m.company_funding_stage) console.log("  company_funding_stage:", m.company_funding_stage);
      // JSearch fields
      if (m.employer_website) console.log("  employer_website:", m.employer_website);
      if (m.employer_logo) console.log("  employer_logo:", m.employer_logo);
      if (m.employer_company_type) console.log("  employer_company_type:", m.employer_company_type);
    }
  }

  // Unique company count
  const [res] = await ExternalJob.sequelize.query(
    'SELECT COUNT(DISTINCT company) as c FROM "ExternalJobs" WHERE "isActive" = true'
  );
  console.log("\n=== Unique active companies:", res[0].c);
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
