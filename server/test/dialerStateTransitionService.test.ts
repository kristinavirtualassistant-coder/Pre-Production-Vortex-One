import assert from 'node:assert/strict';
import { DialerStateTransitionService } from '../dialer/dialerStateTransitionService';
import { eventTypeForState } from '../dialer/callStateMachine';

const base = {
  organizationId: 'org_1',
  callId: 'call_1',
  eventId: 'evt_1',
  eventType: 'telephony.ringing' as const,
  nextState: 'RINGING' as const,
  payload: { provider: 'ringcentral' },
  occurredAt: '2026-09-03T00:00:00.000Z',
};

const sql = DialerStateTransitionService.buildTransitionSql(base);
assert.match(sql.text, /UPDATE call/);
assert.match(sql.text, /organization_id = \$2/);
assert.match(sql.text, /INSERT INTO call_event/);
assert.match(sql.text, /ON CONFLICT/);
assert.match(sql.text, /FOR UPDATE/);
assert.equal(sql.values[6], 'ringing');

const terminal = DialerStateTransitionService.buildTransitionSql({ ...base, eventId: 'evt_2', eventType: 'telephony.completed', nextState: 'COMPLETED' });
assert.match(terminal.text, /ended_at/);
assert.equal(terminal.values[6], 'completed');

assert.equal(DialerStateTransitionService.normalizeProviderStatus('Answered'), 'HUMAN');
assert.equal(DialerStateTransitionService.normalizeProviderStatus('Ringing'), 'RINGING');
assert.equal(DialerStateTransitionService.normalizeProviderStatus('Busy'), 'BUSY');
assert.equal(DialerStateTransitionService.normalizeProviderStatus('NoAnswer'), 'NO_ANSWER');
assert.equal(DialerStateTransitionService.normalizeProviderStatus('Voicemail'), 'VOICEMAIL');
assert.equal(DialerStateTransitionService.normalizeProviderStatus('Disconnected'), 'DISCONNECTED');
assert.equal(DialerStateTransitionService.normalizeProviderStatus('unknown'), 'FAILED');
assert.equal(eventTypeForState('NO_ANSWER'), 'telephony.no_answer');
assert.equal(eventTypeForState('RINGING'), 'telephony.ringing');

class FakeClient {
  calls: string[] = [];
  duplicate = false;
  currentStatus = 'initiated';
  async query(text: string) {
    this.calls.push(text);
    if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rowCount: 0, rows: [] };
    if (text.includes('SELECT 1 FROM call_event')) return { rowCount: this.duplicate ? 1 : 0, rows: [] };
    if (text.includes('SELECT id, status FROM call')) return { rowCount: 1, rows: [{ id: 'call_1', status: this.currentStatus }] };
    if (text.includes('INSERT INTO call_event')) return { rowCount: 1, rows: [] };
    if (text.includes('UPDATE call')) return { rowCount: 1, rows: [] };
    throw new Error(`Unexpected query: ${text}`);
  }
  release() { this.calls.push('RELEASE'); }
}

const client = new FakeClient();
const fakePool = { connect: async () => client } as any;
const transitioned = await DialerStateTransitionService.transition(fakePool, base);
assert.equal(transitioned.status, 'transitioned');
assert.equal(transitioned.previousState, 'DIALING');
assert.equal(transitioned.currentState, 'RINGING');
assert.ok(client.calls.includes('COMMIT'));

client.duplicate = true;
const duplicate = await DialerStateTransitionService.transition(fakePool, { ...base, eventId: 'evt_1' });
assert.equal(duplicate.status, 'duplicate_ignored');
assert.ok(client.calls.includes('ROLLBACK'));

client.duplicate = false;
client.currentStatus = 'completed';
await assert.rejects(
  () => DialerStateTransitionService.transition(fakePool, { ...base, eventId: 'evt_3' }),
  /Invalid call transition COMPLETED -> RINGING/,
);
assert.ok(client.calls.filter((c) => c === 'ROLLBACK').length >= 2);

console.log('dialer state transition service tests passed');
