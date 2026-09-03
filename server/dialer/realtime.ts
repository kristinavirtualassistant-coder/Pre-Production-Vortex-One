import { EventEmitter } from 'node:events';

export interface DialerRealtimeEvent {
  organizationId: string;
  callId: string;
  type: string;
  payload: Record<string, any>;
  occurredAt: string;
}

const emitter = new EventEmitter();
emitter.setMaxListeners(1000);

export function publishDialerEvent(event: DialerRealtimeEvent): void {
  emitter.emit(`org:${event.organizationId}`, event);
}

export function subscribeDialerEvents(
  organizationId: string,
  listener: (event: DialerRealtimeEvent) => void,
): () => void {
  const channel = `org:${organizationId}`;
  emitter.on(channel, listener);
  return () => emitter.off(channel, listener);
}
