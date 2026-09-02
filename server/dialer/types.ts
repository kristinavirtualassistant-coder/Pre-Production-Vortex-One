/**
 * Vortex One - Telephony & Dialer Core Types
 */

export type CallDirection = 'outbound' | 'inbound';

export type CallStatus =
  | 'queued'
  | 'initiated'
  | 'ringing'
  | 'in-progress'
  | 'connected'
  | 'completed'
  | 'busy'
  | 'no-answer'
  | 'voicemail'
  | 'failed'
  | 'cancelled';

export type CallDisposition =
  | 'interested'
  | 'not_interested'
  | 'call_back_later'
  | 'wrong_number'
  | 'do_not_call'
  | 'left_voicemail'
  | 'no_answer'
  | 'busy'
  | 'gatekeeper_block'
  | 'transferred';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived' | 'scheduled';

export type ContactDialStatus =
  | 'queued'
  | 'dialing'
  | 'connected'
  | 'completed'
  | 'busy'
  | 'no_answer'
  | 'suppressed'
  | 'failed';

export interface CampaignRecord {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  target_market: string;
  telephony_provider: 'ringcentral';
  total_contacts: number;
  dialed_count: number;
  connected_count: number;
  converted_count: number;
  scheduled_at?: string;
  scheduled_by?: string;
  timezone?: string;
  concurrency_limit?: number;
  retry_limit?: number;
  calling_hours_start?: string;
  calling_hours_end?: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignContactRecord {
  id: string;
  organization_id: string;
  campaign_id: string;
  lead_id?: string;
  contact_name: string;
  phone_number: string;
  property_address?: string;
  dial_status: ContactDialStatus;
  attempts: number;
  last_dialed_at?: string;
  priority: number;
  created_at: string;
}

export interface DialingSessionRecord {
  id: string;
  organization_id: string;
  campaign_id: string;
  agent_user_id: string;
  status: 'active' | 'paused' | 'ended';
  started_at: string;
  ended_at?: string;
  calls_placed: number;
  contacts_reached: number;
}

export interface CallTableRecord {
  id: string;
  organization_id: string;
  session_id?: string;
  campaign_id?: string;
  lead_id?: string;
  telephony_call_id?: string;
  contact_name: string;
  phone_number: string;
  direction: CallDirection;
  status: CallStatus;
  disposition?: CallDisposition;
  duration_seconds: number;
  call_strategy_brief?: string;
  recording_url?: string;
  notes?: string;
  created_at: string;
  ended_at?: string;
}

export interface CallEventRecord {
  id: string;
  organization_id: string;
  call_id: string;
  event_type: string;
  payload: Record<string, any>;
  occurred_at: string;
}

export interface CallNoteRecord {
  id: string;
  organization_id: string;
  call_id: string;
  author_id: string;
  note_content: string;
  created_at: string;
}

export interface SuppressionTableRecord {
  id: string;
  organization_id: string;
  phone_number: string;
  reason: string;
  source: string;
  suppressed_at: string;
  expires_at?: string;
}

export interface NormalizedCallEvent {
  eventId: string;
  telephonyCallId: string;
  eventType: string;
  status: CallStatus;
  disposition?: CallDisposition;
  durationSeconds?: number;
  recordingUrl?: string;
  timestamp: string;
  rawPayload: Record<string, any>;
}
