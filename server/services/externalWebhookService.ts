/**
 * Vortex One external webhook delivery service.
 * Sends signed property discovery and lead enrichment events to tenant endpoints.
 * PostgreSQL is the sole persistence layer for endpoint and delivery state.
 */
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { getPgPool } from '../db/db';

export type ExternalWebhookEventType = 'property.discovered' | 'lead.enriched';

export interface ExternalWebhookEndpoint {
  id: string;
  organizationId: string;
  url: string;
  events: ExternalWebhookEventType[];
  enabled: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
  secret?: string;
}

export interface ExternalWebhookDelivery {
  id: string;
  endpointId: string;
  organizationId: string;
  eventId: string;
  eventType: ExternalWebhookEventType;
  url: string;
  status: 'delivered' | 'failed';
  statusCode?: number;
  attempts: number;
  error?: string;
  createdAt: string;
  completedAt: string;
}

export interface ExternalWebhookEvent<T = unknown> {
  id: string;
  type: ExternalWebhookEventType;
  version: '1';
  occurredAt: string;
  organizationId: string;
  data: T;
}

export interface DeliveryTestInput {
  endpointId: string;
  url: string;
  secret: string;
  organizationId: string;
  eventType: ExternalWebhookEventType;
  eventId: string;
  payload: Record<string, unknown>;
}

interface SendResult { ok: boolean; status: number; body: string; }

interface ExternalWebhookServiceOptions {
  send?: (url: string, init: RequestInit) => Promise<SendResult>;
  sleep?: (ms: number) => Promise<void>;
}

const MAX_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [250, 1_000, 4_000];

function requirePool() {
  const pool = getPgPool();
  if (!pool) throw new Error('Database unavailable');
  return pool;
}

function endpointFromRow(row: any, includeSecret = false): ExternalWebhookEndpoint {
  const endpoint: ExternalWebhookEndpoint = {
    id: row.id,
    organizationId: row.organization_id,
    url: row.url,
    events: Array.isArray(row.events) ? row.events : [],
    enabled: Boolean(row.enabled),
    description: row.description ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
  if (includeSecret) endpoint.secret = row.secret;
  return endpoint;
}

function deliveryFromRow(row: any): ExternalWebhookDelivery {
  return {
    id: row.id,
    endpointId: row.endpoint_id,
    organizationId: row.organization_id,
    eventId: row.event_id,
    eventType: row.event_type,
    url: row.url,
    status: row.status,
    statusCode: row.status_code ?? undefined,
    attempts: Number(row.attempts),
    error: row.error ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    completedAt: new Date(row.completed_at ?? row.created_at).toISOString(),
  };
}

export function isSupportedWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function buildWebhookSignature(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}

export function buildPropertyDiscoveredPayload(property: unknown, owner: unknown) {
  return { property, owner };
}

export function buildLeadEnrichedPayload(
  owner: unknown, lead: unknown, property: unknown, discoveredPhones: unknown[], discoveredEmails: unknown[],
) {
  return { owner, lead, property, discoveredPhones, discoveredEmails };
}

export class ExternalWebhookService {
  private readonly send: (url: string, init: RequestInit) => Promise<SendResult>;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: ExternalWebhookServiceOptions = {}) {
    this.send = options.send || this.defaultSend.bind(this);
    this.sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async listEndpoints(organizationId: string): Promise<ExternalWebhookEndpoint[]> {
    const { rows } = await requirePool().query(
      `SELECT id, organization_id, url, events, enabled, description, secret, created_at, updated_at
       FROM webhook_endpoints WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId],
    );
    return rows.map((row) => endpointFromRow(row));
  }

  private async getStoredEndpoint(organizationId: string, endpointId: string): Promise<ExternalWebhookEndpoint | null> {
    const { rows } = await requirePool().query(
      `SELECT id, organization_id, url, events, enabled, description, secret, created_at, updated_at
       FROM webhook_endpoints WHERE organization_id = $1 AND id = $2 LIMIT 1`,
      [organizationId, endpointId],
    );
    return rows[0] ? endpointFromRow(rows[0], true) : null;
  }

  async createEndpoint(input: {
    organizationId: string;
    url: string;
    events: ExternalWebhookEventType[];
    enabled?: boolean;
    description?: string;
  }): Promise<ExternalWebhookEndpoint> {
    this.validateEndpointInput(input.url, input.events);
    const now = new Date().toISOString();
    const endpoint: ExternalWebhookEndpoint = {
      id: `wh_${randomUUID()}`,
      organizationId: input.organizationId,
      url: input.url,
      events: [...new Set(input.events)],
      enabled: input.enabled !== false,
      description: input.description,
      createdAt: now,
      updatedAt: now,
      secret: randomBytes(32).toString('hex'),
    };
    const { rows } = await requirePool().query(
      `INSERT INTO webhook_endpoints
       (id, organization_id, url, events, enabled, description, secret, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $8)
       RETURNING id, organization_id, url, events, enabled, description, secret, created_at, updated_at`,
      [endpoint.id, endpoint.organizationId, endpoint.url, JSON.stringify(endpoint.events), endpoint.enabled, endpoint.description ?? null, endpoint.secret, now],
    );
    return endpointFromRow(rows[0], true);
  }

  async updateEndpoint(organizationId: string, endpointId: string, patch: {
    url?: string;
    events?: ExternalWebhookEventType[];
    enabled?: boolean;
    description?: string;
    rotateSecret?: boolean;
  }): Promise<ExternalWebhookEndpoint | null> {
    const existing = await this.getStoredEndpoint(organizationId, endpointId);
    if (!existing) return null;
    const nextUrl = patch.url ?? existing.url;
    const nextEvents = patch.events ?? existing.events;
    this.validateEndpointInput(nextUrl, nextEvents);
    const nextSecret = patch.rotateSecret ? randomBytes(32).toString('hex') : existing.secret;
    const now = new Date().toISOString();
    const { rows } = await requirePool().query(
      `UPDATE webhook_endpoints
       SET url = $3, events = $4::jsonb, enabled = $5, description = $6, secret = $7, updated_at = $8
       WHERE organization_id = $1 AND id = $2
       RETURNING id, organization_id, url, events, enabled, description, secret, created_at, updated_at`,
      [organizationId, endpointId, nextUrl, JSON.stringify([...new Set(nextEvents)]), patch.enabled ?? existing.enabled, patch.description ?? existing.description ?? null, nextSecret, now],
    );
    return rows[0] ? endpointFromRow(rows[0], Boolean(patch.rotateSecret)) : null;
  }

  async deleteEndpoint(organizationId: string, endpointId: string): Promise<boolean> {
    const result = await requirePool().query(
      'DELETE FROM webhook_endpoints WHERE organization_id = $1 AND id = $2',
      [organizationId, endpointId],
    );
    return result.rowCount === 1;
  }

  async listDeliveries(organizationId: string, endpointId: string, limit = 50): Promise<ExternalWebhookDelivery[]> {
    const { rows } = await requirePool().query(
      `SELECT id, endpoint_id, organization_id, event_id, event_type, url, status,
              status_code, attempts, error, created_at, completed_at
       FROM webhook_deliveries
       WHERE organization_id = $1 AND endpoint_id = $2
       ORDER BY created_at DESC LIMIT $3`,
      [organizationId, endpointId, Math.min(Math.max(limit, 1), 200)],
    );
    return rows.map(deliveryFromRow);
  }

  async publish<T>(organizationId: string, type: ExternalWebhookEventType, data: T): Promise<ExternalWebhookDelivery[]> {
    if (process.env.VORTEX_ONE_ENABLE_EXTERNAL_WEBHOOKS !== '1') return [];
    const { rows } = await requirePool().query(
      `SELECT id, organization_id, url, events, enabled, description, secret, created_at, updated_at
       FROM webhook_endpoints
       WHERE organization_id = $1 AND enabled = true`,
      [organizationId],
    );
    const endpoints = rows
      .map((row) => endpointFromRow(row, true))
      .filter((endpoint) => Boolean(endpoint.secret) && endpoint.events.includes(type));
    if (endpoints.length === 0) return [];

    const event: ExternalWebhookEvent<T> = {
      id: `evt_${randomUUID()}`,
      type,
      version: '1',
      occurredAt: new Date().toISOString(),
      organizationId,
      data,
    };
    return Promise.all(endpoints.map((endpoint) => this.deliver(endpoint, event)));
  }

  async testEndpoint(endpoint: ExternalWebhookEndpoint): Promise<ExternalWebhookDelivery> {
    if (!endpoint.secret) throw new Error('Webhook secret is unavailable; rotate the endpoint secret.');
    const event: ExternalWebhookEvent = {
      id: `evt_test_${randomUUID()}`,
      type: endpoint.events[0] || 'lead.enriched',
      version: '1',
      occurredAt: new Date().toISOString(),
      organizationId: endpoint.organizationId,
      data: { test: true, source: 'Vortex One webhook configuration test' },
    };
    return this.deliver(endpoint, event);
  }

  async testEndpointById(organizationId: string, endpointId: string): Promise<ExternalWebhookDelivery | null> {
    const endpoint = await this.getStoredEndpoint(organizationId, endpointId);
    if (!endpoint) return null;
    return this.testEndpoint(endpoint);
  }

  async deliverForTest(input: DeliveryTestInput): Promise<{ success: boolean; attempts: number }> {
    const endpoint: ExternalWebhookEndpoint = {
      id: input.endpointId,
      organizationId: input.organizationId,
      url: input.url,
      events: [input.eventType],
      enabled: true,
      createdAt: '',
      updatedAt: '',
      secret: input.secret,
    };
    const event: ExternalWebhookEvent = {
      id: input.eventId,
      type: input.eventType,
      version: '1',
      occurredAt: new Date().toISOString(),
      organizationId: input.organizationId,
      data: input.payload,
    };
    const result = await this.deliver(endpoint, event, false);
    return { success: result.status === 'delivered', attempts: result.attempts };
  }

  private async deliver(endpoint: ExternalWebhookEndpoint, event: ExternalWebhookEvent, persist = true): Promise<ExternalWebhookDelivery> {
    const body = JSON.stringify(event);
    const timestamp = event.occurredAt;
    const signature = buildWebhookSignature(endpoint.secret || '', timestamp, body);
    let attempts = 0;
    let statusCode: number | undefined;
    let error: string | undefined;
    let delivered = false;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      attempts = attempt;
      try {
        const result = await this.send(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Vortex-One-Webhook/1.0',
            'X-Vortex-One-Event': event.type,
            'X-Vortex-One-Event-Id': event.id,
            'X-Vortex-One-Timestamp': timestamp,
            'X-Vortex-One-Signature': `sha256=${signature}`,
          },
          body,
        });
        statusCode = result.status;
        if (result.ok) {
          delivered = true;
          break;
        }
        error = `HTTP ${result.status}${result.body ? `: ${result.body.slice(0, 500)}` : ''}`;
        if (!this.shouldRetry(result.status)) break;
      } catch (err: any) {
        error = err?.message || 'Webhook request failed';
      }
      if (attempt < MAX_ATTEMPTS) await this.sleep(RETRY_DELAYS_MS[attempt - 1]);
    }

    const now = new Date().toISOString();
    const delivery: ExternalWebhookDelivery = {
      id: `delivery_${randomUUID()}`,
      endpointId: endpoint.id,
      organizationId: endpoint.organizationId,
      eventId: event.id,
      eventType: event.type,
      url: endpoint.url,
      status: delivered ? 'delivered' : 'failed',
      statusCode,
      attempts,
      error: delivered ? undefined : error,
      createdAt: event.occurredAt,
      completedAt: now,
    };

    if (persist) {
      await requirePool().query(
        `INSERT INTO webhook_deliveries
         (id, endpoint_id, organization_id, event_id, event_type, url, status, status_code, attempts, error, created_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [delivery.id, delivery.endpointId, delivery.organizationId, delivery.eventId, delivery.eventType, delivery.url,
          delivery.status, delivery.statusCode ?? null, delivery.attempts, delivery.error ?? null, delivery.createdAt, delivery.completedAt],
      );
    }
    return delivery;
  }

  private shouldRetry(status: number): boolean {
    return status === 408 || status === 425 || status === 429 || status >= 500;
  }

  private async defaultSend(url: string, init: RequestInit): Promise<SendResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      return { ok: response.ok, status: response.status, body: await response.text() };
    } finally {
      clearTimeout(timeout);
    }
  }

  private validateEndpointInput(url: string, events: ExternalWebhookEventType[]) {
    if (!isSupportedWebhookUrl(url)) throw new Error('Webhook URL must use http:// or https://.');
    if (!Array.isArray(events) || events.length === 0) throw new Error('At least one webhook event is required.');
    const allowed = new Set<ExternalWebhookEventType>(['property.discovered', 'lead.enriched']);
    if (events.some((event) => !allowed.has(event))) throw new Error('Unsupported webhook event type.');
  }

  private publicEndpoint(endpoint: ExternalWebhookEndpoint, includeSecret = false): ExternalWebhookEndpoint {
    if (includeSecret) return { ...endpoint };
    const { secret: _secret, ...safe } = endpoint;
    return safe;
  }
}

export const externalWebhookService = new ExternalWebhookService();
