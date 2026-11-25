# Data files

## storesignal-boards.csv

Company job boards on Greenhouse, Ashby and Lever, taken from the
"StoreSignal ATS job boards directory"
(https://github.com/storesignalhq/ats-job-boards), verified by its authors on
2026-11-16. Licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
Credit: "StoreSignal ATS job boards directory".

Changes made here: kept only the three systems our sync can read today
(the directory also lists Workable, SmartRecruiters and Recruitee boards) and
only the columns ats, slug, company_name, open_jobs. open_jobs is the count on
the verification date, used only to order the first checks.

Nothing in this file is trusted as-is. services/boardImport.js checks every
board against its system's public feed before it is added, and adds the boards
with the most US tech jobs first, only while there is room under
MAX_ACTIVE_BOARDS.

To refresh: download boards.csv from the repository above and run
`node scripts/refreshStoreSignalBoards.js <path-to-boards.csv>`.
