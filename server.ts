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
import { createRateLimiter } from './server/middleware/rateLimit';
import { createWorkflowRun, updateWorkflowRun, getWorkflowRun, listWorkflowRuns, abortWorkflowRun } from './server/services/workflowRunService';
import { createWorkflowVersion, publishWorkflowVersion, scheduleWorkflow, runWorkflowWorkerOnce, logWorkflowEvent } from './server/services/workflowAutomationService';
import { enqueueJob, JOB_TYPES } from './server/services/jobService';
// Email worker runs through the managed worker entrypoint in server/workers/emailWorker.ts.
import { callbackUrl, completeOAuthCallback, createOAuthStart, type OAuthProvider } from './server/services/integrationOAuth';
import { createFilesRouter } from './server/routes/files';
import { analyticsRouter } from './server/routes/analytics';
import { verifyStripeWebhook, handleStripeEvent } from './server/services/billingService';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 8080);
  const isProduction = process.env.NODE_ENV === 'production';

  app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);

  // Rate-limit before body parsing so abusive requests cannot consume parser memory first.