import assert from 'node:assert/strict';
import { DialerCallStateMachine, DialerCallEventType } from '../dialer/callStateMachine';

const happyPath: Array<ReturnType<DialerCallStateMachine['transition']>['current']> = [
  'DIALING', 'RINGING', 'HUMAN', 'CONNECTED', 'IN_CALL', 'WRAP_UP', 'DISPOSITIONED', 'COMPLETED',
];
const fsm = new DialerCallStateMachine();
for (const state of happyPath) fsm.transition(state);
assert.equal(fsm.state, 'COMPLETED');
assert.throws(() => fsm.transition('RINGING'), /Invalid call transition/);

for (const terminal of ['VOICEMAIL', 'NO_ANSWER', 'BUSY', 'DISCONNECTED', 'FAILED'] as const) {
  const terminalFsm = new DialerCallStateMachine('DIALING');
  terminalFsm.transition(terminal);
  if (terminal === 'FAILED') {
    assert.throws(() => terminalFsm.transition('COMPLETED'), /Invalid call transition/);
  } else {
    terminalFsm.transition('COMPLETED');
    assert.equal(terminalFsm.state, 'COMPLETED');
  }
}

const eventType: DialerCallEventType = 'telephony.ringing';
assert.equal(eventType, 'telephony.ringing');

console.log('call state machine tests passed');
