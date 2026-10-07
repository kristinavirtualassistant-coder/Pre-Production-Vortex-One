import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { requireOrganizationId } from './organizationContext';
import { enqueueJob, enqueueJobWithClient, claimNextJob, completeJob, failJob, recoverStaleJobs, type JobRecord } from './jobService';
import { sendEmail } from './emailService';
import { executeSubAgent } from '../agents/subAgents';
import { getTelephonyAdapter } from '../dialer/telephonyAdapter';
import { SuppressionService } from '../dialer/suppressionService';
import { validateWebhookTarget } from './safeWebhookService';

export const WORKFLOW_JOB_TYPE = 'workflow.execute';
export type WorkflowActionType = 'email'|'sms'|'phone'|'webhook'|'ai_agent'|'wait'|'noop';

function parseJson(value: unknown, fallback: any = {}) { if (value == null) return fallback; if (typeof value === 'string') { try { return JSON.parse(value); } catch { return fallback; } } return value; }
function cronFieldMatches(value:number, field:string, min:number, max:number){
  return field.split(',').some(part=>{ const bits=part.split('/'); const base=bits[0]; const step=Math.max(1,Number(bits[1]||1)); let start=min,end=max; if(base!=='*'){ if(base.includes('-')){const p=base.split('-').map(Number);start=p[0];end=p[1];}else{const n=Number(base);return value===n;} } if(value<start||value>end)return false; return (value-start)%step===0; });
}
function cronMatches(d:Date, expr:string){
  const f=expr.trim().split(/\s+/); if(f.length!==5) throw new Error('Cron expressions must use five fields');
  return cronFieldMatches(d.getUTCMinutes(),f[0],0,59)&&cronFieldMatches(d.getUTCHours(),f[1],0,23)&&cronFieldMatches(d.getUTCDate(),f[2],1,31)&&cronFieldMatches(d.getUTCMonth()+1,f[3],1,12)&&cronFieldMatches(d.getUTCDay(),f[4],0,6);
}
function nextCronRun(expr:string, from=new Date()){ const d=new Date(from); d.setUTCSeconds(0,0); d.setUTCMinutes(d.getUTCMinutes()+1); for(let i=0;i<60*24*366;i++){if(cronMatches(d,expr))return d; d.setUTCMinutes(d.getUTCMinutes()+1);} throw new Error('Could not find next cron occurrence within one year'); }
function render(value: any, context: Record<string, any>): any {
  if (typeof value === 'string') return value.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_, key) => String(key.split('.').reduce((v:any,k:string)=>v?.[k], context) ?? ''));
  if (Array.isArray(value)) return value.map(v=>render(v,context));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,render(v,context)]));
  return value;
}
function dateValue(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function evaluateCondition(condition: any, context: Record<string,any>): boolean {
  if (!condition) return true;
  if (condition.all) return condition.all.every((x:any)=>evaluateCondition(x,context));
  if (condition.any) return condition.any.some((x:any)=>evaluateCondition(x,context));
  if (condition.not) return !evaluateCondition(condition.not,context);
  const field=condition.field; const op=condition.operator || '==';
  if (!field) throw new Error('Workflow condition requires field');
  const left=field.split('.').reduce((v:any,k:string)=>v?.[k],context);
  let right=condition.value;
  if (typeof right==='string' && right === '$now') right=new Date();
  const leftDate=dateValue(left); const rightDate=dateValue(right);
  const l=leftDate!==null&&rightDate!==null?leftDate:(left instanceof Date?left.getTime():left);
  const r=leftDate!==null&&rightDate!==null?rightDate:(right instanceof Date?right.getTime():right);
  switch(op){case '==':return l===r;case '!=':return l!==r;case '>':case 'after':return Number(l)>Number(r);case '<':case 'before':return Number(l)<Number(r);case '>=':case 'on_or_after':return Number(l)>=Number(r);case '<=':case 'on_or_before':return Number(l)<=Number(r);case 'contains':return String(l??'').includes(String(r??''));default:throw new Error('Unsupported workflow condition operator');}
}
export async function logWorkflowEvent(pool:Pool, organizationId:string, input:{runId?:string;stepId?:string;level?:string;event:string;message:string;metadata?:any}) {
  const org=requireOrganizationId(organizationId);
  await pool.query("INSERT INTO workflow_execution_logs (id,organization_id,workflow_run_id,workflow_step_id,level,event,message,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)",["wlog_"+randomUUID(),org,input.runId||null,input.stepId||null,input.level||'info',input.event,input.message,JSON.stringify(input.metadata||{})]);
}
export async function createWorkflowVersion(pool:Pool,organizationId:string,workflowId:string,createdBy:string,publish=false){
  const org=requireOrganizationId(organizationId); const client=await pool.connect();
  try { await client.query('BEGIN'); const wf=await client.query('SELECT id,name,description,category,steps FROM workflows WHERE id=$1 AND organization_id=$2 FOR UPDATE',[workflowId,org]); if(!wf.rowCount) throw new Error('Workflow not found');
    const n=await client.query('SELECT COALESCE(MAX(version),0)+1 AS version FROM workflow_versions WHERE workflow_id=$1 AND organization_id=$2',[workflowId,org]); const version=Number(n.rows[0].version);
    if(publish) await client.query("UPDATE workflow_versions SET status='archived' WHERE workflow_id=$1 AND organization_id=$2 AND status='published'",[workflowId,org]);
    const result=await client.query("INSERT INTO workflow_versions (id,organization_id,workflow_id,version,definition,status,created_by,published_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,CASE WHEN $6='published' THEN CURRENT_TIMESTAMP ELSE NULL END) RETURNING *",['wfv_'+randomUUID(),org,workflowId,version,JSON.stringify({name:wf.rows[0].name,description:wf.rows[0].description,category:wf.rows[0].category,steps:wf.rows[0].steps}),publish?'published':'draft',createdBy]);
    await client.query('COMMIT'); return result.rows[0]; } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();}
}
export async function publishWorkflowVersion(pool:Pool,organizationId:string,workflowId:string,versionId:string){
  const org=requireOrganizationId(organizationId); const client=await pool.connect(); try{await client.query('BEGIN');
    const v=await client.query('SELECT * FROM workflow_versions WHERE id=$1 AND workflow_id=$2 AND organization_id=$3 FOR UPDATE',[versionId,workflowId,org]); if(!v.rowCount) throw new Error('Workflow version not found');
    await client.query("UPDATE workflow_versions SET status='archived' WHERE workflow_id=$1 AND organization_id=$2 AND status='published'",[workflowId,org]);
    const result=await client.query("UPDATE workflow_versions SET status='published',published_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *",[versionId]); await client.query('COMMIT'); return result.rows[0];
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export async function scheduleWorkflow(pool:Pool,organizationId:string,workflowId:string,createdBy:string,input:any){
  const org=requireOrganizationId(organizationId); if(input.schedule_type==='once'&&!input.run_at) throw new Error('run_at is required'); if(input.schedule_type==='interval'&&Number(input.interval_seconds)<60) throw new Error('interval_seconds must be at least 60'); if(input.schedule_type==='cron'&&!input.cron_expression) throw new Error('cron_expression is required'); if(input.schedule_type==='cron'&&input.timezone&&input.timezone!=='UTC') throw new Error('Cron scheduling currently requires UTC');
  const v=input.workflow_version_id ? await pool.query("SELECT id FROM workflow_versions WHERE id=$1 AND workflow_id=$2 AND organization_id=$3 AND status='published'",[input.workflow_version_id,workflowId,org]) : await pool.query("SELECT id FROM workflow_versions WHERE workflow_id=$1 AND organization_id=$2 AND status='published' ORDER BY version DESC LIMIT 1",[workflowId,org]);
  if(!v.rowCount) throw new Error('A published workflow version is required');
  const next=input.schedule_type==='once'?new Date(input.run_at):input.schedule_type==='cron'?nextCronRun(input.cron_expression):new Date(Date.now()+Number(input.interval_seconds||60)*1000);
  const result=await pool.query("INSERT INTO workflow_schedules (id,organization_id,workflow_id,workflow_version_id,name,schedule_type,run_at,interval_seconds,cron_expression,timezone,status,next_run_at,trigger_payload,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11,$12::jsonb,$13) RETURNING *",['wfs_'+randomUUID(),org,workflowId,v.rows[0].id,input.name,input.schedule_type,input.run_at||null,input.interval_seconds||null,input.cron_expression||null,input.timezone||'UTC',next,JSON.stringify(input.trigger_payload||{}),createdBy]);
  return result.rows[0];
}
export async function claimDueWorkflowSchedules(pool:Pool){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const result=await client.query("SELECT * FROM workflow_schedules WHERE status='active' AND next_run_at<=CURRENT_TIMESTAMP ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 25");
    const claimed=[];
    for(const row of result.rows){
      const runId='wfr_'+randomUUID();
      await enqueueJobWithClient(client,row.organization_id,WORKFLOW_JOB_TYPE,{scheduleId:row.id,workflowId:row.workflow_id,workflowVersionId:row.workflow_version_id,triggerPayload:row.trigger_payload,runId},3);
      let nextRun:null|Date=null;
      let status='active';
      if(row.schedule_type==='interval'){
        nextRun=new Date(Date.now()+Number(row.interval_seconds)*1000);
      }else if(row.schedule_type==='cron'){
        nextRun=nextCronRun(row.cron_expression,new Date());
      }else if(row.schedule_type==='once'){
        status='completed';
      }else{
        nextRun=new Date(Date.now()+Math.max(60,Number(row.interval_seconds||60))*1000);
      }
      const updated=await client.query("UPDATE workflow_schedules SET last_run_at=CURRENT_TIMESTAMP,next_run_at=$1,status=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$3 AND organization_id=$4 RETURNING *",[nextRun,status,row.id,row.organization_id]);
      claimed.push(updated.rows[0]);
    }
    await client.query('COMMIT');
    return claimed;
  }catch(error){ await client.query('ROLLBACK'); throw error; }
  finally{ client.release(); }
}

export async function updateWorkflowScheduleStatus(pool:Pool,organizationId:string,scheduleId:string,status:'active'|'paused'|'cancelled'){
  const org=requireOrganizationId(organizationId);
  if(status==='active'){
    const result=await pool.query("UPDATE workflow_schedules SET status='active',next_run_at=COALESCE(next_run_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$2 AND status IN ('paused','active') RETURNING *",[scheduleId,org]);
    if(!result.rowCount) throw new Error('Workflow schedule not found or cannot be resumed');
    return result.rows[0];
  }
  const result=await pool.query("UPDATE workflow_schedules SET status=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND organization_id=$3 AND status NOT IN ('completed','cancelled') RETURNING *",[status,scheduleId,org]);
  if(!result.rowCount) throw new Error('Workflow schedule not found or cannot be changed');
  return result.rows[0];
}

export async function runWorkflowScheduleNow(pool:Pool,organizationId:string,scheduleId:string){
  const org=requireOrganizationId(organizationId);
  const result=await pool.query("SELECT * FROM workflow_schedules WHERE id=$1 AND organization_id=$2",[scheduleId,org]);
  if(!result.rowCount) throw new Error('Workflow schedule not found');
  const schedule=result.rows[0];
  if(schedule.status==='cancelled') throw new Error('Cancelled workflow schedules cannot be run');
  const runId='wfr_'+randomUUID();
  await enqueueJob(pool,org,WORKFLOW_JOB_TYPE,{scheduleId:schedule.id,workflowId:schedule.workflow_id,workflowVersionId:schedule.workflow_version_id,triggerPayload:schedule.trigger_payload,runId},3);
  return {runId,scheduleId:schedule.id};
}

export async function retryWorkflowRun(pool:Pool,organizationId:string,runId:string){
  const org=requireOrganizationId(organizationId);
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const runResult=await client.query("SELECT * FROM workflow_runs WHERE id=$1 AND organization_id=$2 FOR UPDATE",[runId,org]);
    if(!runResult.rowCount) throw new Error('Workflow run not found');
    if(runResult.rows[0].status!=='failed') throw new Error('Only failed workflow runs can be retried');
    const jobResult=await client.query("SELECT * FROM jobs WHERE organization_id=$1 AND job_type=$2 AND status='failed' AND payload->>'runId'=$3 ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[org,WORKFLOW_JOB_TYPE,runId]);
    if(!jobResult.rowCount) throw new Error('No failed workflow job is available for retry');
    const source=jobResult.rows[0];
    const retryJobId=await enqueueJobWithClient(client,org,WORKFLOW_JOB_TYPE,source.payload,source.max_attempts);
    await client.query("UPDATE workflow_runs SET status='running',completed_at=NULL,final_summary='Retry queued',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$2",[runId,org]);
    await logWorkflowEvent(client as any,org,{runId,level:'warn',event:'workflow_retry_queued',message:'Workflow retry queued',metadata:{sourceJobId:source.id,retryJobId}});
    await client.query('COMMIT');
    return {runId,jobId:retryJobId};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}

async function reserveCommunication(pool:Pool,orgId:string,runId:string,stepId:string,channel:'email'|'sms'|'phone',destination:string,idempotencyKey:string,payload:any){
  const existing=await pool.query('SELECT * FROM workflow_communication_deliveries WHERE organization_id=$1 AND idempotency_key=$2 FOR UPDATE',[orgId,idempotencyKey]);
  if(existing.rowCount){const row=existing.rows[0]; if(row.status==='sent') return {state:'sent',row}; if(row.status==='sending'||row.status==='manual_review') return {state:'manual_review',row};}
  const result=await pool.query("INSERT INTO workflow_communication_deliveries (id,organization_id,workflow_run_id,workflow_step_id,channel,destination,idempotency_key,status,request_payload) VALUES ($1,$2,$3,$4,$5,$6,$7,'sending',$8::jsonb) ON CONFLICT (organization_id,idempotency_key) DO UPDATE SET status='sending',updated_at=CURRENT_TIMESTAMP,request_payload=EXCLUDED.request_payload RETURNING *",['wcd_'+randomUUID(),orgId,runId,stepId,channel,destination,idempotencyKey,JSON.stringify(payload)]);
  return {state:'send',row:result.rows[0]};
}
async function finishCommunication(pool:Pool,orgId:string,idempotencyKey:string,status:'sent'|'failed'|'manual_review',reference?:string,error?:string){ await pool.query('UPDATE workflow_communication_deliveries SET status=$1,provider_reference=$2,error=$3,updated_at=CURRENT_TIMESTAMP WHERE organization_id=$4 AND idempotency_key=$5',[status,reference||null,error||null,orgId,idempotencyKey]); }

async function executeAction(pool:Pool,orgId:string,step:any,context:any,runId:string,stepId:string){
  const action=(step.action_type||step.action||(step.type==='WAIT'?'wait':'noop')) as WorkflowActionType; const input=render(step.input_mapping||step.input||{},context);
  switch(action){
    case 'noop': return {ok:true};
    case 'wait': return {waiting:true,delay_seconds:Math.max(1,Number(step.delay_seconds||input.delay_seconds||60))};
    case 'email': { const to=String(input.to||'').trim().toLowerCase(); const subject=String(input.subject||''); const text=String(input.body||''); if(!/^\S+@\S+\.\S+$/.test(to)||!subject||!text) throw new Error('Email action requires to, subject, and body'); const suppression=await SuppressionService.isEmailSuppressed(orgId,to); if(suppression.isSuppressed) throw new Error('Email recipient is suppressed: '+(suppression.reason||'suppressed')); const delivery=await reserveCommunication(pool,orgId,runId,stepId,'email',to,runId+':'+stepId,input); if(delivery.state==='sent') return {ok:true,replayed:true,providerReference:delivery.row.provider_reference}; if(delivery.state==='manual_review') throw new Error('Email delivery is already in progress or requires manual reconciliation'); try { const r=await sendEmail({to,subject,text}); await finishCommunication(pool,orgId,runId+':'+stepId,'sent',r.messageId); return {ok:true,provider:'email',messageId:r.messageId}; } catch(error:any) { await finishCommunication(pool,orgId,runId+':'+stepId,'failed',undefined,String(error?.message||error)); throw error; } }
    case 'sms': { const to=String(input.to||''); const text=String(input.body||input.message||''); const from=String(input.from||process.env.RINGCENTRAL_FROM_NUMBER||''); const suppression=await SuppressionService.isSuppressed(orgId,to); if(suppression.isSuppressed) throw new Error('SMS recipient is suppressed: '+(suppression.reason||'DNC')); if(!to||!text||!from) throw new Error('SMS action requires to, body and RINGCENTRAL_FROM_NUMBER'); const delivery=await reserveCommunication(pool,orgId,runId,stepId,'sms',to,runId+':'+stepId,input); if(delivery.state==='sent') return {ok:true,replayed:true,providerReference:delivery.row.provider_reference}; if(delivery.state==='manual_review') throw new Error('SMS delivery is already in progress or requires manual reconciliation'); const {SDK}=await import('@ringcentral/sdk'); const sdk=new SDK({server:process.env.RINGCENTRAL_SERVER_URL||'https://platform.ringcentral.com',clientId:process.env.RINGCENTRAL_CLIENT_ID||'',clientSecret:process.env.RINGCENTRAL_CLIENT_SECRET||''}); const p=sdk.platform(); const jwt=process.env.RINGCENTRAL_JWT?.trim(); if(!jwt) throw new Error('RingCentral JWT is required for SMS actions'); if(!(await p.loggedIn())) await p.login({jwt}); const response=await p.post('/restapi/v1.0/account/~/extension/~/sms',{from:{phoneNumber:from},to:[{phoneNumber:to}],text}); const data=await response.json(); await finishCommunication(pool,orgId,runId+':'+stepId,'sent',data.id||undefined); return {ok:true,provider:'ringcentral',messageId:data.id||null}; }
    case 'phone': { const delivery=await reserveCommunication(pool,orgId,runId,stepId,'phone',String(input.to||''),runId+':'+stepId,input); if(delivery.state==='sent') return {ok:true,replayed:true,providerReference:delivery.row.provider_reference}; if(delivery.state==='manual_review') throw new Error('Phone delivery is already in progress or requires manual reconciliation'); const to=String(input.to||''); if(!to) throw new Error('Phone action requires to'); const suppression=await SuppressionService.isSuppressed(orgId,to); if(suppression.isSuppressed) throw new Error('Phone recipient is suppressed: '+(suppression.reason||'DNC')); const r=await getTelephonyAdapter('ringcentral').initiateCall({organizationId:orgId,toNumber:to,contactName:String(input.contact_name||'Workflow Contact'),fromNumber:input.from?String(input.from):undefined,callStrategyBrief:input.call_strategy_brief?String(input.call_strategy_brief):undefined}); if(!r.success) { await finishCommunication(pool,orgId,runId+':'+stepId,'failed',undefined,r.error||'Phone action failed'); throw new Error(r.error||'Phone action failed'); } await finishCommunication(pool,orgId,runId+':'+stepId,'sent',r.telephonyCallId); return {ok:true,provider:r.provider,telephonyCallId:r.telephonyCallId}; }
    case 'webhook': { const allowed=(process.env.WORKFLOW_WEBHOOK_ALLOWLIST||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean); const u=await validateWebhookTarget(String(input.url||''),allowed); const r=await fetch(u,{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify(input.body||{}),signal:AbortSignal.timeout(10000)}); if(!r.ok) throw new Error('Webhook returned HTTP '+r.status); return {ok:true,status:r.status}; }
    case 'ai_agent': { const task:any={task_id:'wf_task_'+randomUUID(),assigned_agent:String(input.agent_id||step.assigned_agent||'sub_agent_1'),objective:String(input.objective||step.objective||''),input,status:'queued',dependencies:[],priority:'medium',created_at:new Date().toISOString(),organization_id:orgId}; const result=await executeSubAgent(task.assigned_agent as any,task,{organizationId:orgId}); return {ok:true,result}; }
    default: throw new Error('Unsupported workflow action: '+action);
  }
}
export async function processWorkflowJob(pool:Pool,job:JobRecord,workerId:string){
  const org=requireOrganizationId(job.organization_id); const scheduleId=String(job.payload?.scheduleId||''); const schedule=(await pool.query('SELECT * FROM workflow_schedules WHERE id=$1 AND organization_id=$2',[scheduleId,org])).rows[0]; if(!schedule){await completeJob(pool,org,job.id,workerId);return;}
  const version=(await pool.query('SELECT * FROM workflow_versions WHERE id=$1 AND organization_id=$2',[schedule.workflow_version_id,org])).rows[0]; if(!version){await failJob(pool,org,job.id,workerId,'Workflow version not found',60);return;}
  const def=parseJson(version.definition,{}); const steps=Array.isArray(def.steps)?def.steps:[]; const runId=String(job.payload?.runId||'wfr_'+randomUUID()); const start=Number(job.payload?.resumeStepIndex||0);
  let savedStepOutputs:any={};
  if(!job.payload?.runId) {
    await pool.query("INSERT INTO workflow_runs (id,organization_id,workflow_id,name,status,total_steps,initiated_by) VALUES ($1,$2,$3,$4,'running',$5,'scheduler')",[runId,org,schedule.workflow_id,def.name||schedule.name,steps.length]);
  } else {
    const run=(await pool.query('SELECT step_outputs FROM workflow_runs WHERE id=$1 AND organization_id=$2',[runId,org])).rows[0];
    savedStepOutputs=parseJson(run?.step_outputs,{});
    await pool.query("UPDATE workflow_runs SET status='running',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$2",[runId,org]);
  }
  const context:any={trigger:parseJson(job.payload?.triggerPayload,{}),workflow:def,now:new Date().toISOString(),steps:{...savedStepOutputs}};
  const savedKeys=Object.keys(savedStepOutputs);
  context.last=savedKeys.length?savedStepOutputs[savedKeys[savedKeys.length-1]]:undefined;
  let activeStepId:string|undefined;
  try{
    for(let i=start;i<steps.length;i++){ const step=steps[i]; const stepId=String(step.step_id||'step_'+(i+1)); activeStepId=stepId; const idem=runId+':'+stepId;
      if(step.condition&&!evaluateCondition(step.condition,context)){ await pool.query("INSERT INTO workflow_execution_steps (id,organization_id,workflow_run_id,workflow_step_id,step_index,action_type,status,idempotency_key,input,completed_at) VALUES ($1,$2,$3,$4,$5,$6,'skipped',$7,$8::jsonb,CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING",['wfsx_'+randomUUID(),org,runId,stepId,i,String(step.action_type||step.action||step.type||'noop'),idem,JSON.stringify(step.input_mapping||{})]); continue; }
      const existing=await pool.query('SELECT status FROM workflow_execution_steps WHERE organization_id=$1 AND idempotency_key=$2',[org,idem]); if(existing.rowCount&&['completed','skipped'].includes(existing.rows[0].status)) continue;
      await pool.query("INSERT INTO workflow_execution_steps (id,organization_id,workflow_run_id,workflow_step_id,step_index,action_type,status,attempt,max_attempts,idempotency_key,input,started_at) VALUES ($1,$2,$3,$4,$5,$6,'running',1,$7,$8,$9::jsonb,CURRENT_TIMESTAMP) ON CONFLICT (organization_id,idempotency_key) DO UPDATE SET status='running',attempt=workflow_execution_steps.attempt+1,started_at=CURRENT_TIMESTAMP",['wfsx_'+randomUUID(),org,runId,stepId,i,String(step.action_type||step.action||step.type||'noop'),Number(step.retryCount||2)+1,idem,JSON.stringify(step.input_mapping||{})]);
      await logWorkflowEvent(pool,org,{runId,stepId,event:'step_started',message:'Started '+String(step.name||stepId)});
      const output=await executeAction(pool,org,step,context,runId,stepId);
      if(output.waiting){ const delay=Math.max(1,Number(output.delay_seconds||60)); await pool.query("UPDATE workflow_execution_steps SET status='waiting',scheduled_at=CURRENT_TIMESTAMP+($1*INTERVAL '1 second'),output=$2::jsonb,updated_at=CURRENT_TIMESTAMP WHERE organization_id=$3 AND idempotency_key=$4",[delay,JSON.stringify(output),org,idem]); await enqueueJob(pool,org,WORKFLOW_JOB_TYPE,{scheduleId,workflowId:schedule.workflow_id,workflowVersionId:schedule.workflow_version_id,triggerPayload:job.payload?.triggerPayload,runId,resumeStepIndex:i+1},Number(step.retryCount||2)+1,delay); await completeJob(pool,org,job.id,workerId); return; }
      context.steps[stepId]=output; context.last=output; await pool.query("UPDATE workflow_execution_steps SET status='completed',output=$1::jsonb,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE organization_id=$2 AND idempotency_key=$3",[JSON.stringify(output),org,idem]);
      await pool.query("UPDATE workflow_runs SET step_outputs=COALESCE(step_outputs,'{}'::jsonb)||$1::jsonb,completed_steps=$2,current_step_id=$3,current_step_name=$4,updated_at=CURRENT_TIMESTAMP WHERE id=$5 AND organization_id=$6",[JSON.stringify({[stepId]:output}),i+1,stepId,String(step.name||stepId),runId,org]); await logWorkflowEvent(pool,org,{runId,stepId,event:'step_succeeded',message:'Completed '+String(step.name||stepId),metadata:output});
    }
    await pool.query("UPDATE workflow_runs SET status='completed',completed_steps=$1,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,final_summary=$2 WHERE id=$3 AND organization_id=$4",[steps.length,'Completed '+steps.length+' workflow steps',runId,org]); await logWorkflowEvent(pool,org,{runId,event:'workflow_completed',message:'Workflow completed successfully'}); await completeJob(pool,org,job.id,workerId);
  }catch(e:any){ const msg=String(e?.message||e); if(activeStepId) await pool.query("UPDATE workflow_execution_steps SET status='failed',error=$1,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE organization_id=$2 AND idempotency_key=$3",[msg,org,runId+':'+activeStepId]); await pool.query("UPDATE workflow_runs SET status='failed',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,final_summary=$1 WHERE id=$2 AND organization_id=$3",[msg,runId,org]); await logWorkflowEvent(pool,org,{runId,stepId:activeStepId,level:'error',event:'workflow_failed',message:msg}); await failJob(pool,org,job.id,workerId,msg,Math.min(300,30*Math.max(1,job.attempts))); throw e; }
}
export async function runWorkflowWorkerOnce(pool:Pool){ let processed=0; const worker='workflow-worker-'+process.pid; const orgs=(await pool.query("SELECT DISTINCT organization_id FROM jobs WHERE job_type=$1 AND (status='queued' OR (status='processing' AND locked_at<CURRENT_TIMESTAMP-INTERVAL '5 minutes'))",[WORKFLOW_JOB_TYPE])).rows.map(r=>r.organization_id); for(const org of orgs){await recoverStaleJobs(pool,org,300); for(let i=0;i<10;i++){const job=await claimNextJob(pool,org,worker,[WORKFLOW_JOB_TYPE]); if(!job)break; processed++; try{await processWorkflowJob(pool,job,worker);}catch{}}} return processed; }
