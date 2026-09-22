import assert from 'node:assert/strict';
import { ManualDialService, ManualDialNotFoundError, ManualDialSuppressedError } from '../dialer/manualDialService';

function harness(options: { existing?: any; suppression?: any; campaignMissing?: boolean; provider?: any } = {}) {
  const calls:any[]=[]; const queries:string[]=[]; let callSeq=0;
  const client:any={
    query: async (text:string, values:any[]) => { queries.push(text); if(text==='BEGIN'||text==='COMMIT'||text==='ROLLBACK') return {rowCount:0,rows:[]};
      if(text.includes('SELECT id,status,telephony_call_id')) return {rowCount:options.existing?1:0,rows:options.existing?[options.existing]:[]};
      if(text.includes('SELECT id, status FROM call')) return {rowCount:1,rows:[{id:values[0],status:'queued'}]};
      if(text.includes('SELECT id FROM campaign')) return {rowCount:options.campaignMissing?0:1,rows:options.campaignMissing?[]:[{id:values[0]}]};
      if(text.includes('SELECT id FROM leads')||text.includes('SELECT id FROM contacts')) return {rowCount:1,rows:[{id:values[0]}]};
      if(text.includes('suppression_record')) return {rowCount:options.suppression?1:0,rows:options.suppression?[options.suppression]:[]};
      if(text.includes('INSERT INTO call')) { calls.push({id:values[0],status:'queued'}); return {rowCount:1,rows:[]}; }
      if(text.includes('SELECT 1 FROM call_event')) return {rowCount:0,rows:[]};
      if(text.includes('INSERT INTO call_event')) return {rowCount:1,rows:[]};
      if(text.includes('UPDATE call')) return {rowCount:1,rows:[]};
      return {rowCount:0,rows:[]}; }, release(){}
  };
  const pool:any={connect:async()=>client,query:async(text:string,values:any[])=>{queries.push(text);return {rowCount:0,rows:[]}}};
  const adapter:any={providerName:'ringcentral',initiateCall:async()=>options.provider||{success:true,telephonyCallId:'rc-1',ringcentralRingoutId:'ro-1',status:'initiated',provider:'ringcentral'},terminateCall:async()=>true,normalizeWebhookPayload(){throw new Error('unused')}};
  return {pool,adapter,calls,queries};
}

{
 const h=harness({provider:{success:true,telephonyCallId:'rc-1',ringcentralRingoutId:'ro-1',status:'initiated',provider:'ringcentral'}});
 const r=await ManualDialService.dial(h.pool,h.adapter,{organizationId:'org-a',idempotencyKey:'k1',contactName:'Owner',phoneNumber:'+1 (949) 555-0100',campaignId:'camp-a'});
 assert.equal(r.status,'initiated'); assert.equal(r.telephonyCallId,'rc-1'); assert.match(h.queries.join('\n'),/organization_id=\$1/);
}
{
 const h=harness({existing:{id:'call-old',telephony_call_id:'rc-old',ringcentral_ringout_id:'ro-old'}});
 const r=await ManualDialService.dial(h.pool,h.adapter,{organizationId:'org-a',idempotencyKey:'k1',contactName:'Owner',phoneNumber:'9495550100'});
 assert.equal(r.status,'duplicate_ignored'); assert.equal(r.callId,'call-old');
}
{
 const h=harness({suppression:{reason:'DNC'}});
 await assert.rejects(()=>ManualDialService.dial(h.pool,h.adapter,{organizationId:'org-a',idempotencyKey:'k1',contactName:'Owner',phoneNumber:'9495550100'}),ManualDialSuppressedError);
}
{
 const h=harness({campaignMissing:true});
 await assert.rejects(()=>ManualDialService.dial(h.pool,h.adapter,{organizationId:'org-a',idempotencyKey:'k1',contactName:'Owner',phoneNumber:'9495550100',campaignId:'camp-b'}),ManualDialNotFoundError);
}
{
 const h=harness({provider:{success:false,telephonyCallId:'',status:'failed',provider:'ringcentral',error:'rejected'}});
 const r=await ManualDialService.dial(h.pool,h.adapter,{organizationId:'org-a',idempotencyKey:'k1',contactName:'Owner',phoneNumber:'9495550100'});
 assert.equal(r.status,'failed'); assert.match(h.queries.join('\n'),/status='failed'/);
}
console.log('manual dial service tests passed');
