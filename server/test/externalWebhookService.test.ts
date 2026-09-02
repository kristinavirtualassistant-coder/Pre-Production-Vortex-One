import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  ExternalWebhookService,
  ExternalWebhookEventType,
  buildWebhookSignature,
  isSupportedWebhookUrl,
  buildPropertyDiscoveredPayload,
  buildLeadEnrichedPayload,
} from '../services/externalWebhookService';

function testUrlValidation() {
  assert.equal(isSupportedWebhookUrl('https://dialer.example.com/webhook'), true);
  assert.equal(isSupportedWebhookUrl('http://localhost:8080/hook'), true);
  assert.equal(isSupportedWebhookUrl('ftp://example.com/hook'), false);
  assert.equal(isSupportedWebhookUrl('javascript:alert(1)'), false);
}

function testSignature() {
  const secret = 'test-secret';
  const timestamp = '2026-09-02T18:00:00.000Z';
  const eventId = 'evt_123';
  const body = JSON.stringify({ hello: 'world' });
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  assert.equal(buildWebhookSignature(secret, timestamp, body), expected);
}

function testEventTypes() {
  const types: ExternalWebhookEventType[] = ['property.discovered', 'lead.enriched'];
  assert.deepEqual(types, ['property.discovered', 'lead.enriched']);
}

function testEventPayloads() {
  const property = { id: 'prop_1', apn: '123-456-78', address: '1 Main St' };
  const owner = { id: 'owner_1', name: 'Example Owner' };
  const lead = { id: 'lead_1', status: 'new' };
  assert.deepEqual(buildPropertyDiscoveredPayload(property, owner), { property, owner });
  assert.deepEqual(buildLeadEnrichedPayload(owner, lead, property, [{ number: '9495550100' }], [{ email: 'owner@example.com' }]), {
    owner, lead, property, discoveredPhones: [{ number: '9495550100' }], discoveredEmails: [{ email: 'owner@example.com' }],
  });
}

async function testDeliveryHeaders() {
  let captured: RequestInit | undefined;
  const service = new ExternalWebhookService({
    send: async (_url, init) => {
      captured = init;
      return { ok: true, status: 204, body: '' };
    },
    sleep: async () => undefined,
  });

  await service.deliverForTest({
    endpointId: 'wh_headers',
    url: 'https://dialer.example.com/webhook',
    secret: 'test-secret',
    organizationId: 'org_test',
    eventType: 'property.discovered',
    eventId: 'evt_headers',
    payload: { propertyId: 'prop_1' },
  });

  assert.equal(captured?.method, 'POST');
  assert.equal((captured?.headers as Record<string, string>)['X-Vortex-One-Event'], 'property.discovered');
  assert.equal((captured?.headers as Record<string, string>)['X-Vortex-One-Event-Id'], 'evt_headers');
  assert.match((captured?.headers as Record<string, string>)['X-Vortex-One-Signature'], /^sha256=[0-9a-f]{64}$/);
  assert.equal((captured?.headers as Record<string, string>)['Content-Type'], 'application/json');
}

async function testRetryPolicy() {
  let attempts = 0;
  const service = new ExternalWebhookService({
    send: async () => {
      attempts += 1;
      if (attempts < 3) return { ok: false, status: 503, body: 'unavailable' };
      return { ok: true, status: 200, body: 'ok' };
    },
    sleep: async () => undefined,
  });

  const noRetryService = new ExternalWebhookService({
    send: async () => {
      attempts += 1;
      return { ok: false, status: 400, body: 'bad request' };
    },
    sleep: async () => undefined,
  });

  const result = await service.deliverForTest({
    endpointId: 'wh_test',
    url: 'https://dialer.example.com/webhook',
    secret: 'test-secret',
    organizationId: 'org_test',
    eventType: 'lead.enriched',
    eventId: 'evt_test',
    payload: { leadId: 'lead_1' },
  });

  assert.equal(result.success, true);
  assert.equal(result.attempts, 3);

  const failed = await noRetryService.deliverForTest({
    endpointId: 'wh_test',
    url: 'https://dialer.example.com/webhook',
    secret: 'test-secret',
    organizationId: 'org_test',
    eventType: 'lead.enriched',
    eventId: 'evt_400',
    payload: { leadId: 'lead_1' },
  });
  assert.equal(failed.success, false);
  assert.equal(failed.attempts, 1);
}

async function main() {
  testUrlValidation();
  testSignature();
  testEventTypes();
  testEventPayloads();
  await testDeliveryHeaders();
  await testRetryPolicy();
  console.log('External webhook service tests passed.');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
