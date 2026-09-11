import { Pool } from 'pg';
import { TelephonyAdapter } from './telephonyAdapter';
import { normalizePhoneNumber } from './suppressionService';
import { DialerStateTransitionService } from './dialerStateTransitionService';

export interface ManualDialInput {
  organizationId: string; idempotencyKey: string; contactName: string; phoneNumber: string;
  propertyAddress?: string; callStrategyBrief?: string; campaignId?: string; leadId?: string; contactId?: string;
}
export interface ManualDialResult {
  status: 'initiated' | 'failed' | 'duplicate_ignored'; callId: string; telephonyCallId?: string; ringcentralRingoutId?: string; error?: string;
}
export class ManualDialService {
  public static async dial(pool: Pool, adapter: TelephonyAdapter, input: ManualDialInput): Promise<ManualDialResult> {
    const cleanPhone=normalizePhoneNumber(input.phoneNumber);
    if(cleanPhone.length!==10) throw new Error('A valid 10-digit US phone number is required');
    if(!input.idempotencyKey || input.idempotencyKey.length>128) throw new Error('idempotencyKey is required and must be 128 characters or fewer');
    const client=await pool.connect(); let callId='';
    try {
      await client.query('BEGIN');
      const existing=await client.query(`SELECT id,status,telephony_call_id,ringcentral_ringout_id FROM call WHERE organization_id=$1 AND idempotency_key=$2 FOR UPDATE`,[input.organizationId,input.idempotencyKey]);
      if(existing.rowCount){await client.query('COMMIT');const r=existing.rows[0];return {status:'duplicate_ignored',callId:r.id,telephonyCallId:r.telephony_call_id||undefined,ringcentralRingoutId:r.ringcentral_ringout_id||undefined};}
      if(input.campaignId) await this.assertTenantRow(client,'campaign',input.campaignId,input.organizationId);
      if(input.leadId) await this.assertTenantRow(client,'leads',input.leadId,input.organizationId);
      if(input.contactId) await this.assertTenantRow(client,'contacts',input.contactId,input.organizationId);
      const suppression=await this.authoritativeSuppressionCheck(client,input.organizationId,cleanPhone);
      if(suppression.isSuppressed) throw new ManualDialSuppressedError(suppression.reason||'Phone number is suppressed');
      callId=`call_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
      await client.query(`INSERT INTO call (id,organization_id,campaign_id,lead_id,contact_name,phone_number,direction,status,duration_seconds,call_strategy_brief,created_at,idempotency_key) VALUES ($1,$2,$3,$4,$5,$6,'outbound','queued',0,$7,NOW(),$8)`,[callId,input.organizationId,input.campaignId||null,input.leadId||null,input.contactName||'Property Owner',cleanPhone,input.callStrategyBrief||null,input.idempotencyKey]);
      await client.query('COMMIT');
    } catch(error){try{await client.query('ROLLBACK')}catch{};if((error as any)?.code==='23505'){const r=await pool.query(`SELECT id,telephony_call_id,ringcentral_ringout_id FROM call WHERE organization_id=$1 AND idempotency_key=$2`,[input.organizationId,input.idempotencyKey]);if(r.rowCount)return {status:'duplicate_ignored',callId:r.rows[0].id,telephonyCallId:r.rows[0].telephony_call_id||undefined,ringcentralRingoutId:r.rows[0].ringcentral_ringout_id||undefined};}throw error;}finally{client.release();}
    let providerResult;
    try{providerResult=await adapter.initiateCall({organizationId:input.organizationId,campaignId:input.campaignId,toNumber:cleanPhone,contactName:input.contactName||'Property Owner',callStrategyBrief:input.callStrategyBrief});}
    catch(error:any){await this.markFailed(pool,input.organizationId,callId,error?.message||'Telephony provider rejected call');return {status:'failed',callId,error:error?.message||'Telephony provider rejected call'};}
    if(!providerResult.success||!providerResult.telephonyCallId){const error=providerResult.error||'Telephony provider rejected call';await this.markFailed(pool,input.organizationId,callId,error);return {status:'failed',callId,error};}
    try{
      const transition=await DialerStateTransitionService.transition(pool,{organizationId:input.organizationId,callId,eventId:`dial:${callId}`,eventType:'telephony.dialing',nextState:'DIALING',payload:{provider:providerResult.provider,telephonyCallId:providerResult.telephonyCallId},occurredAt:new Date().toISOString(),telephonySessionId:providerResult.telephonySessionId,ringcentralPartyId:providerResult.ringcentralPartyId,ringcentralRingoutId:providerResult.ringcentralRingoutId});
      if(transition.status==='duplicate_ignored') throw new Error('Manual dial initiation event already exists');
      await pool.query(`UPDATE call SET telephony_call_id=$1,ringcentral_ringout_id=$2 WHERE id=$3 AND organization_id=$4`,[providerResult.telephonyCallId,providerResult.ringcentralRingoutId||null,callId,input.organizationId]);
      return {status:'initiated',callId,telephonyCallId:providerResult.telephonyCallId,ringcentralRingoutId:providerResult.ringcentralRingoutId};
    }catch(error:any){await adapter.terminateCall(providerResult.telephonyCallId,providerResult.ringcentralPartyId,providerResult.ringcentralRingoutId);await this.markFailed(pool,input.organizationId,callId,error?.message||'Failed to persist provider call state');return {status:'failed',callId,error:error?.message||'Failed to persist provider call state'};}
  }
  private static async assertTenantRow(client:any,table:'campaign'|'leads'|'contacts',id:string,organizationId:string){const r=await client.query(`SELECT id FROM ${table} WHERE id=$1 AND organization_id=$2`,[id,organizationId]);if(!r.rowCount)throw new ManualDialNotFoundError(`${table} not found for organization`);}
  private static async authoritativeSuppressionCheck(client:any,organizationId:string,cleanPhone:string){const r=await client.query(`SELECT reason,suppressed_at,expires_at FROM suppression_record WHERE organization_id=$1 AND regexp_replace(phone_number,'[^0-9]','','g')=$2 LIMIT 1`,[organizationId,cleanPhone]);if(!r.rowCount)return {isSuppressed:false};const row=r.rows[0];if(row.expires_at&&new Date(row.expires_at)<new Date())return {isSuppressed:false};return {isSuppressed:true,reason:row.reason,suppressedAt:row.suppressed_at};}
  private static async markFailed(pool:Pool,organizationId:string,callId:string,error:string){await pool.query(`UPDATE call SET status='failed',notes=$1,ended_at=COALESCE(ended_at,NOW()) WHERE id=$2 AND organization_id=$3`,[error,callId,organizationId]);}
}
export class ManualDialSuppressedError extends Error {readonly code='CALL_SUPPRESSED';constructor(message:string){super(message);this.name='ManualDialSuppressedError';}}
export class ManualDialNotFoundError extends Error {readonly code='CALL_REFERENCE_NOT_FOUND';constructor(message:string){super(message);this.name='ManualDialNotFoundError';}}
