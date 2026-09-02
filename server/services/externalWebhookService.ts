/**
 * Vortex One external webhook delivery service.
 * Sends signed property discovery and lead enrichment events to tenant endpoints.
 */
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps } from 'firebase-admin/app';

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

const COLLECTION = 'webhook_endpoints';
const DELIVERY_COLLECTION = 'webhook_deliveries';
const MAX_ATTEMPTS = 4;
const REQUEST_TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [250, 1_000, 4_000];

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
    const snapshot = await getFirestore()
      .collection('organizations').doc(organizationId).collection(COLLECTION).get();
    return snapshot.docs.map((doc) => this.publicEndpoint({ id: doc.id, ...doc.data() } as ExternalWebhookEndpoint));
  }

  private async getStoredEndpoint(organizationId: string, endpointId: string): Promise<ExternalWebhookEndpoint | null> {
    const doc = await getFirestore().collection('organizations').doc(organizationId)
      .collection(COLLECTION).doc(endpointId).get();
    return doc.exists ? ({ id: doc.id, ...doc.data() } as ExternalWebhookEndpoint) : null;
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
      id: randomUUID(),
      organizationId: input.organizationId,
      url: input.url,
      events: [...new Set(input.events)],
      enabled: input.enabled !== false,
      description: input.description,
      createdAt: now,
      updatedAt: now,
      secret: randomBytes(32).toString('hex'),
    };
    await getFirestore().collection('organizations').doc(input.organizationId)
      .collection(COLLECTION).doc(endpoint.id).set(endpoint);
    return this.publicEndpoint(endpoint, true);
  }

  async updateEndpoint(organizationId: string, endpointId: string, patch: {
    url?: string;
    events?: ExternalWebhookEventType[];
    enabled?: boolean;
    description?: string;
    rotateSecret?: boolean;
  }): Promise<ExternalWebhookEndpoint | null> {
    const ref = getFirestore().collection('organizations').doc(organizationId)
      .collection(COLLECTION).doc(endpointId);
    const doc = await ref.get();
    if (!doc.exists) return null;
    if (patch.url !== undefined || patch.events !== undefined) {
      this.validateEndpointInput(patch.url || String(doc.data()?.url || ''), patch.events || (doc.data()?.events as ExternalWebhookEventType[] || []));
    }
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (patch.url !== undefined) update.url = patch.url;
    if (patch.events !== undefined) update.events = [...new Set(patch.events)];
    if (patch.enabled !== undefined) update.enabled = patch.enabled;
    if (patch.description !== undefined) update.description = patch.description;
    if (patch.rotateSecret) update.secret = randomBytes(32).toString('hex');
    await ref.update(update);
    return this.publicEndpoint({ id: doc.id, ...doc.data(), ...update } as ExternalWebhookEndpoint, Boolean(patch.rotateSecret));
  }

  async deleteEndpoint(organizationId: string, endpointId: string): Promise<boolean> {
    const ref = getFirestore().collection('organizations').doc(organizationId)
      .collection(COLLECTION).doc(endpointId);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  }

  async listDeliveries(organizationId: string, endpointId: string, limit = 50): Promise<ExternalWebhookDelivery[]> {
    const snapshot = await getFirestore()
      .collection('organizations').doc(organizationId).collection(DELIVERY_COLLECTION)
      .where('endpointId', '==', endpointId).limit(Math.min(limit, 200)).get();
    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as ExternalWebhookDelivery))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async publish<T>(organizationId: string, type: ExternalWebhookEventType, data: T): Promise<ExternalWebhookDelivery[]> {
    if (getApps().length === 0) return [];
    const snapshot = await getFirestore()
      .collection('organizations').doc(organizationId).collection(COLLECTION).get();
    const endpoints = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as ExternalWebhookEndpoint))
      .filter((endpoint) => endpoint.enabled && endpoint.events.includes(type) && Boolean(endpoint.secret));
    if (endpoints.length === 0) return [];

    const event: ExternalWebhookEvent<T> = {
      id: `evt_${randomUUID()}`,
      type,
      version: '1',
      occurredAt: new Date().toISOString(),
      organizationId,
      data,
    };
    const results = await Promise.all(endpoints.map((endpoint) => this.deliver(endpoint, event)));
    return results;
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
      id: input.endpointId, organizationId: input.organizationId, url: input.url,
      events: [input.eventType], enabled: true, createdAt: '', updatedAt: '', secret: input.secret,
    };
    const event: ExternalWebhookEvent = {
      id: input.eventId, type: input.eventType, version: '1',
      occurredAt: new Date().toISOString(), organizationId: input.organizationId, data: input.payload,
    };
    const result = await this.deliver(endpoint, event, false);
    return { success: result.status === 'delivered', attempts: result.attempts };
  }

  private async deliver(
    endpoint: ExternalWebhookEndpoint,
    event: ExternalWebhookEvent,
    persist = true,
  ): Promise<ExternalWebhookDelivery> {
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
      await getFirestore().collection('organizations').doc(endpoint.organizationId)
        .collection(DELIVERY_COLLECTION).doc(delivery.id).set(delivery);
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
