import assert from 'node:assert/strict';
import type {
  InitiateCallParams,
  TelephonyAdapter,
  TelephonyCallResult,
} from '../dialer/telephonyAdapter';
import type { NormalizedCallEvent } from '../dialer/types';

class FakeTelephonyProvider implements TelephonyAdapter {
  providerName = 'fake' as const;

  async initiateCall(params: InitiateCallParams): Promise<TelephonyCallResult> {
    return {
      success: true,
      telephonyCallId: `fake-${params.toNumber}`,
      status: 'initiated',
      provider: this.providerName,
    };
  }

  async terminateCall(_telephonyCallId: string, _partyId?: string, _ringoutId?: string): Promise<boolean> {
    return true;
  }

  normalizeWebhookPayload(rawPayload: any): NormalizedCallEvent {
    return {
      eventId: rawPayload.eventId,
      telephonyCallId: rawPayload.telephonyCallId,
      eventType: 'fake.call.initiated',
      status: 'initiated',
      timestamp: rawPayload.timestamp,
      rawPayload,
    };
  }
}

const provider = new FakeTelephonyProvider();
const result = await provider.initiateCall({
  organizationId: 'org_test',
  toNumber: '5555551212',
  contactName: 'Test Owner',
});

assert.equal(result.success, true);
assert.equal(result.provider, 'fake');
assert.equal(result.telephonyCallId, 'fake-5555551212');

const event = provider.normalizeWebhookPayload({
  eventId: 'evt_fake_1',
  telephonyCallId: result.telephonyCallId,
  timestamp: '2026-09-12T00:00:00.000Z',
});
assert.equal(event.eventId, 'evt_fake_1');
assert.equal(event.telephonyCallId, result.telephonyCallId);
assert.equal(await provider.terminateCall(result.telephonyCallId), true);

console.log('telephonyProviderContract.test.ts: PASS');
