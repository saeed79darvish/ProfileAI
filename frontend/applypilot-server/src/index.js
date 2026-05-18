/**
 * ApplyPilot HTTP server.
 *
 * Exposes /api/applypilot/* — the exact routes the frontend client
 * in src/services/api.js (applyPilotAPI) expects. Keep the two in
 * lockstep: if you rename an endpoint here, update the client too.
 *
 * This is a scaffold. It boots, answers every route with data shaped
 * correctly for the UI, and shows where the real DB / worker calls
 * would slot in. The LLM glue (services/llm.js) is implemented with
 * real Claude calls so you can wire it up incrementally.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authMiddleware } from './services/auth.js';
import configRoutes from './routes/config.js';
import dashboardRoutes from './routes/dashboard.js';
import reviewRoutes from './routes/review.js';
import trainingRoutes from './routes/training.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health probe for the orchestrator / load balancer.
app.get('/health', (_req, res) => res.json({ ok: true, service: 'applypilot' }));

// All ApplyPilot routes require a logged-in candidate.
app.use('/api/applypilot', authMiddleware);
app.use('/api/applypilot', configRoutes);
app.use('/api/applypilot', dashboardRoutes);
app.use('/api/applypilot', reviewRoutes);
app.use('/api/applypilot', trainingRoutes);

// Typed 404 the frontend hook can detect (isMissingEndpoint).
app.use('/api/applypilot', (_req, res) => {
  res.status(404).json({ error: 'unknown_applypilot_route' });
});

const port = Number(process.env.PORT) || 5010;
app.listen(port, () => {
  console.log(`[applypilot] listening on :${port}`);
});
