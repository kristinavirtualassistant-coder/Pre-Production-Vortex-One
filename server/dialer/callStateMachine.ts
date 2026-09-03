export type DialerCallState =
  | 'QUEUED' | 'DIALING' | 'RINGING' | 'HUMAN' | 'VOICEMAIL' | 'NO_ANSWER' | 'BUSY' | 'DISCONNECTED' | 'FAILED'
  | 'CONNECTED' | 'IN_CALL' | 'WRAP_UP' | 'DISPOSITIONED' | 'COMPLETED' | 'CANCELLED';

export type DialerCallEventType =
  | 'telephony.queued'
  | 'telephony.dialing'
  | 'telephony.ringing'
  | 'telephony.human'
  | 'telephony.voicemail'
  | 'telephony.no_answer'
  | 'telephony.busy'
  | 'telephony.disconnected'
  | 'telephony.failed'
  | 'telephony.connected'
  | 'telephony.in_call'
  | 'telephony.wrap_up'
  | 'telephony.dispositioned'
  | 'telephony.completed'
  | 'telephony.cancelled';

export function eventTypeForState(state: DialerCallState): DialerCallEventType {
  const key = state.toLowerCase();
  const normalized = key === 'no_answer' ? 'no_answer' : key;
  return `telephony.${normalized}` as DialerCallEventType;
}

export interface DialerCallEvent {
  eventId: string;
  organizationId: string;
  callId: string;
  type: DialerCallEventType;
  occurredAt: string;
  payload: Record<string, any>;
}

const transitions: Record<DialerCallState, readonly DialerCallState[]> = {
  QUEUED: ['DIALING', 'CANCELLED', 'FAILED'],
  DIALING: ['RINGING', 'HUMAN', 'VOICEMAIL', 'NO_ANSWER', 'BUSY', 'DISCONNECTED', 'FAILED', 'CANCELLED'],
  RINGING: ['HUMAN', 'VOICEMAIL', 'NO_ANSWER', 'BUSY', 'DISCONNECTED', 'FAILED', 'CANCELLED'],
  HUMAN: ['CONNECTED', 'IN_CALL', 'DISCONNECTED', 'FAILED', 'CANCELLED'],
  CONNECTED: ['IN_CALL', 'WRAP_UP', 'DISCONNECTED', 'FAILED'],
  IN_CALL: ['WRAP_UP', 'DISCONNECTED', 'FAILED'],
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
