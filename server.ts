import 'dotenv/config';

/**
 * Vortex One - Server Entry Point (Express + Vite)
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

import { initializeDatabase, getDatabaseStatus, inMemoryStore, getPgPool, seedInitialData } from './server/db/db';
import { persistLegacyCall, buildCallPersistencePlan } from './server/db/legacySchemaCompatibility';
import { getAllAgents, getAgent, registerAgent, updateAgent } from './server/agents/registry';
import { MasterOrchestrator } from './server/agents/orchestrator';
import { executeSubAgent } from './server/agents/subAgents';
import { generateSpeechTTS } from './server/gemini';
import { AgentDefinition, Workflow, WorkflowStep, WorkflowRun, Task, Property, CallRecord } from './src/types';
import { CampaignManager } from './server/dialer/campaignManager';
import { SuppressionService } from './server/dialer/suppressionService';
import { WebhookHandler, verifyRingCentralWebhook, handleRingCentralValidation } from './server/dialer/webhookHandler';
import { getTelephonyAdapter } from './server/dialer/telephonyAdapter';
import { ManualDialService, ManualDialNotFoundError, ManualDialSuppressedError } from './server/dialer/manualDialService';
import { DataImportService } from './server/services/dataImportService';
import { UnifiedPropertyDataProvider } from './server/services/propertyProviders/PropertyDataProvider';
import { SkipTraceService } from './server/services/skipTraceService';
import { externalWebhookService } from './server/services/externalWebhookService';
import { requireAuth, AuthRequest, shouldBypassApiAuth, requireRole } from './server/middleware/auth';
import { taskCacheService } from './server/services/cacheService';
import { requireOrganizationId } from './server/services/organizationContext';
import { startDialingEngine } from './server/dialer/dialingEngine';
import { applyCallDisposition } from './server/services/dispositionService';
import { subscribeDialerEvents } from './server/dialer/realtime';
import { validateDialRequest } from './server/dialer/dialRequestValidation';
import { searchProperties, type PropertySearchQuery } from './server/services/propertySearchService';
import { upsertCanonicalLead } from './server/services/crmService';
import { listTasks, createTask, updateTaskResult, createApproval, listWorkflows, getWorkflow, upsertWorkflow, updateWorkflow, deleteWorkflow, listApprovals, decideApproval } from './server/services/agentOperationsService';
import { queueEmailOutreach } from './server/services/emailOutreachService';
import { enqueueJob, JOB_TYPES } from './server/services/jobService';
// Email worker runs through the managed worker entrypoint in server/workers/emailWorker.ts.
import { callbackUrl, completeOAuthCallback, createOAuthStart, type OAuthProvider } from './server/services/integrationOAuth';
import { createRateLimiter } from './server/middleware/rateLimit';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 8080);
  const isProduction = process.env.NODE_ENV === 'production';

  app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);

  // Bound request sizes before parsing and rate-limit all API traffic before authentication.
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: process.env.URLENCODED_BODY_LIMIT || '1mb' }));
  app.use('/api/auth', createRateLimiter({ windowMs: 60_000, max: 20, message: 'Too many authentication requests. Please try again in a minute.' }));
  app.use('/api', createRateLimiter({ windowMs: 60_000, max: 300 }));

  // Initialize DB & Migrations on Boot
  try {
    const dbStatus = await initializeDatabase();
    console.log(`Vortex One database initialized (${dbStatus.type}). Migrations count: ${dbStatus.appliedMigrationsCount}`);
    if (isProduction && (!dbStatus.connected || dbStatus.type !== 'postgresql')) {
      throw new Error('Production startup requires an available PostgreSQL database; refusing in-memory mode');
    }
  } catch (err: any) {
    console.error('Database initialization warning:', err.message);
    if (isProduction) throw err;
  }

  // --- API Routes ---

  // Health & DB Status
  app.get('/api/health', (req, res) => {
    const db = getDatabaseStatus();
    const healthy = db.connected && db.type === 'postgresql';
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      platform: 'Vortex One Multi-Agent Intelligence',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      db: {
        type: db.type,
        connected: db.connected,
        appliedMigrationsCount: db.appliedMigrationsCount,
      },
    });
  });

  app.post('/internal/scheduler/property-refresh', async (req, res) => {
    const configuredSecret = process.env.SCHEDULER_TRIGGER_SECRET?.trim();
    const suppliedSecret = typeof req.headers['x-vortex-scheduler-secret'] === 'string' ? req.headers['x-vortex-scheduler-secret'].trim() : '';
    if (!configuredSecret || suppliedSecret !== configuredSecret) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const pool = getPgPool();
      if (!pool) return res.status(503).json({ error: 'PostgreSQL is required for scheduler execution' });
      const { runPropertyRefreshWorkerOnce } = await import('./server/workers/schedulerWorker');
      const results = [];
      for (let i = 0; i < 10; i += 1) {
        const result = await runPropertyRefreshWorkerOnce();
        if (!result.claimed) break;
        results.push(result);
      }
      return res.json({ processedJobs: results.length, results });
    } catch (err: any) {
      console.error('[scheduler-trigger] failed:', err);
      return res.status(500).json({ error: err?.message || 'Scheduler trigger failed' });
    }
  });

  app.get('/api/ready', (req, res) => {
    const db = getDatabaseStatus();
    const ready = db.connected && db.type === 'postgresql';
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      database: ready ? 'postgresql' : 'unavailable',
      timestamp: new Date().toISOString(),
    });
  });

  // All API routes are authenticated except the minimal health endpoint and
  // provider callbacks that must be reachable without a Firebase user token.
  app.use('/api', (req: AuthRequest, res, next) => {
    if (shouldBypassApiAuth(req.path)) {
      return next();
    }
    return requireAuth(req, res, next);
  });

  app.get('/api/db/status', (req, res) => {
    res.json(getDatabaseStatus());
  });