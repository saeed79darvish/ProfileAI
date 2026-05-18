require("dotenv").config();
const { ExternalJob, ATSBoard } = require("../models");

(async () => {
  const bySource = await ExternalJob.findAll({
    where: { isActive: true },
    attributes: ["source", [ExternalJob.sequelize.fn("COUNT", "id"), "c"]],
    group: ["source"],
    order: [[ExternalJob.sequelize.fn("COUNT", "id"), "DESC"]],
    raw: true
  });
  
  console.log("Jobs by source:");
  let total = 0;
  bySource.forEach(r => {
    console.log(`  ${r.source}: ${r.c}`);
    total += parseInt(r.c);
  });
  console.log(`  TOTAL: ${total}`);
  
  const boards = await ATSBoard.count({ where: { isActive: true } });
  console.log(`\nActive ATS boards: ${boards}`);
  
  process.exit(0);
})();
