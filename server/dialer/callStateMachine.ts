export type DialerCallState =
  | 'QUEUED' | 'DIALING' | 'RINGING' | 'HUMAN' | 'VOICEMAIL' | 'NO_ANSWER' | 'BUSY' | 'DISCONNECTED' | 'FAILED'
  | 'CONNECTED' | 'IN_CALL' | 'WRAP_UP' | 'DISPOSITIONED' | 'COMPLETED' | 'CANCELLED';

const transitions: Record<DialerCallState, readonly DialerCallState[]> = {
  QUEUED: ['DIALING', 'CANCELLED', 'FAILED'],
  DIALING: ['RINGING', 'HUMAN', 'VOICEMAIL', 'NO_ANSWER', 'BUSY', 'DISCONNECTED', 'FAILED', 'CANCELLED'],
  RINGING: ['HUMAN', 'VOICEMAIL', 'NO_ANSWER', 'BUSY', 'DISCONNECTED', 'FAILED', 'CANCELLED'],
  HUMAN: ['CONNECTED', 'IN_CALL', 'FAILED', 'CANCELLED'],
  CONNECTED: ['IN_CALL', 'WRAP_UP', 'FAILED'],
  IN_CALL: ['WRAP_UP', 'FAILED'],
  WRAP_UP: ['DISPOSITIONED', 'FAILED'],
  DISPOSITIONED: ['COMPLETED'],
  VOICEMAIL: ['COMPLETED'], NO_ANSWER: ['COMPLETED'], BUSY: ['COMPLETED'], DISCONNECTED: ['COMPLETED'], FAILED: [], COMPLETED: [], CANCELLED: [],
};

export class DialerCallStateMachine {
  constructor(public state: DialerCallState = 'QUEUED') {}
  canTransition(next: DialerCallState): boolean { return transitions[this.state].includes(next); }
  transition(next: DialerCallState): { previous: DialerCallState; current: DialerCallState } {
    if (!this.canTransition(next)) throw new Error(`Invalid call transition ${this.state} -> ${next}`);
    const previous = this.state; this.state = next; return { previous, current: next };
  }
}
