# DEPRECATED — superseded by the real backend

This was a stand-alone scaffold written before backend access was
available. The actual ApplyPilot backend now lives in
`../backend/` and is mounted at `/api/applypilot/*` from the main
ProfileAI server.

Where the real code lives:

- `backend/routes/applyPilot.js`
- `backend/services/applyPilotService.js`        – Claude calls
- `backend/services/applyPilotScout.js`          – cron worker
- `backend/models/ApplyPilotConfig.js`
- `backend/models/ApplyPilotApplication.js`
- `backend/models/ApplyPilotTrainingMemory.js`
- `backend/models/ApplyPilotTrainingMessage.js`

You can safely delete this folder.
