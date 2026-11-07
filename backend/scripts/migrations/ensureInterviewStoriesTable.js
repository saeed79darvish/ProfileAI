/**
 * Migration: InterviewStories, the stories a candidate prepares on the
 * Interview prep page. CREATE TABLE IF NOT EXISTS plus an index: safe on
 * every boot.
 */

const { sequelize } = require('../../models');

async function up() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "InterviewStories" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" uuid NOT NULL,
      "prepId" uuid,
      "tailoredProfileId" uuid,
      "company" varchar(255),
      "role" varchar(255),
      "theme" varchar(255),
      "title" varchar(255),
      "spoken" text,
      "beats" jsonb,
      "tips" jsonb,
      "needsYou" jsonb,
      "experienceRef" jsonb,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `);
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "interview_stories_user_prep"
    ON "InterviewStories" ("userId", "prepId")
  `);
  console.log('[InterviewStories] table ensured');
}

if (require.main === module) {
  up().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { up };
