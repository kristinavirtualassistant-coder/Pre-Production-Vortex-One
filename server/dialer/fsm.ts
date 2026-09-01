/**
 * Vortex One - Call Finite State Machine (FSM)
 * Enforces rigorous telephony lifecycle and transition validation
 */

import { CallStatus, CallDisposition } from './types';

export const VALID_FSM_TRANSITIONS: Record<CallStatus, CallStatus[]> = {
  queued: ['initiated', 'cancelled', 'failed'],
  initiated: ['ringing', 'failed', 'cancelled'],
  ringing: ['in-progress', 'connected', 'busy', 'no-answer', 'voicemail', 'failed', 'cancelled'],
  'in-progress': ['connected', 'completed', 'failed', 'transferred' as any],
  connected: ['completed', 'failed', 'transferred' as any],
  completed: [],
  failed: [],
  busy: [],
  'no-answer': [],
  voicemail: [],
  cancelled: [],
};

export class CallStateMachine {
  public currentStatus: CallStatus;
  public startedAt: Date;
  public answeredAt?: Date;
  public endedAt?: Date;

  constructor(initialStatus: CallStatus = 'queued') {
    this.currentStatus = initialStatus;
    this.startedAt = new Date();
  }

  public canTransitionTo(nextStatus: CallStatus): boolean {
    const allowed = VALID_FSM_TRANSITIONS[this.currentStatus] || [];
    return allowed.includes(nextStatus);
  }

  public transition(nextStatus: CallStatus): { success: boolean; previousStatus: CallStatus; currentStatus: CallStatus; error?: string } {
    if (!this.canTransitionTo(nextStatus)) {
      return {
        success: false,
        previousStatus: this.currentStatus,
        currentStatus: this.currentStatus,
        error: `Invalid FSM transition: Cannot move from '${this.currentStatus}' to '${nextStatus}'.`,
      };
    }

    const previousStatus = this.currentStatus;
    this.currentStatus = nextStatus;

    if ((nextStatus === 'connected' || nextStatus === 'in-progress') && !this.answeredAt) {
      this.answeredAt = new Date();
    }

    if (this.isTerminalState(nextStatus) && !this.endedAt) {
      this.endedAt = new Date();
    }

    return {
      success: true,
      previousStatus,
      currentStatus: nextStatus,
    };
  }

  public isTerminalState(status?: CallStatus): boolean {
    const s = status || this.currentStatus;
    return ['completed', 'failed', 'busy', 'no-answer', 'voicemail', 'cancelled'].includes(s);
  }

  public getDurationSeconds(): number {
    const end = this.endedAt || new Date();
    const start = this.answeredAt || this.startedAt;
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
  }
}
