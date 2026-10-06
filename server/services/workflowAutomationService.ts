import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { requireOrganizationId } from './organizationContext';
import { enqueueJob, claimNextJob, completeJob, failJob, recoverStaleJobs, type JobRecord } from './jobService';
import { sendEmail } from './emailService';
import { executeSubAgent } from '../agents/subAgents';
import { getTelephonyAdapter } from '../dialer/telephonyAdapter';
import { SuppressionService } from '../dialer/suppressionService';

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
  const l=left instanceof Date?left.getTime():left; const r=right instanceof Date?right.getTime():right;
  switch(op){case '==':return l===r;case '!=':return l!==r;case '>':return Number(l)>Number(r);case '<':return Number(l)<Number(r);case '>=':return Number(l)>=Number(r);case '<=':return Number(l)<=Number(r);case 'contains':return String(l??'').includes(String(r??''));default:throw new Error('Unsupported workflow condition operator');}
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
  const result=await pool.query("WITH due AS (SELECT id FROM workflow_schedules WHERE status='active' AND next_run_at<=CURRENT_TIMESTAMP ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 25) UPDATE workflow_schedules s SET last_run_at=CURRENT_TIMESTAMP,next_run_at=CASE WHEN s.schedule_type='interval' THEN CURRENT_TIMESTAMP+(s.interval_seconds*INTERVAL '1 second') WHEN s.schedule_type='once' THEN NULL WHEN s.schedule_type='cron' THEN NULL ELSE CURRENT_TIMESTAMP+(s.interval_seconds*INTERVAL '1 second') END,status=CASE WHEN s.schedule_type='once' THEN 'completed' ELSE 'active' END,updated_at=CURRENT_TIMESTAMP FROM due WHERE s.id=due.id RETURNING s.*");
  for(const row of result.rows) await enqueueJob(pool,row.organization_id,WORKFLOW_JOB_TYPE,{scheduleId:row.id,workflowId:row.workflow_id,workflowVersionId:row.workflow_version_id,triggerPayload:row.trigger_payload,runId:'wfr_'+randomUUID()},3);
  for(const row of result.rows){ if(row.schedule_type==='cron'){ const next=nextCronRun(row.cron_expression,new Date()); await pool.query("UPDATE workflow_schedules SET next_run_at=$1 WHERE id=$2",[next,row.id]); row.next_run_at=next; } } return result.rows;
}
async function executeAction(pool:Pool,orgId:string,step:any,context:any){
  const action=(step.action_type||step.action||(step.type==='WAIT'?'wait':'noop')) as WorkflowActionType; const input=render(step.input_mapping||step.input||{},context);
  switch(action){
    case 'noop': return {ok:true};
    case 'wait': return {waiting:true,delay_seconds:Math.max(1,Number(step.delay_seconds||input.delay_seconds||60))};
    case 'email': { const to=String(input.to||'').trim().toLowerCase(); const subject=String(input.subject||''); const text=String(input.body||''); if(!/^\S+@\S+\.\S+$/.test(to)||!subject||!text) throw new Error('Email action requires to, subject, and body'); const suppression=await SuppressionService.isEmailSuppressed(orgId,to); if(suppression.isSuppressed) throw new Error('Email recipient is suppressed: '+(suppression.reason||'suppressed')); const r=await sendEmail({to,subject,text}); return {ok:true,provider:'email',messageId:r.messageId}; }
    case 'sms': { const to=String(input.to||''); const text=String(input.body||input.message||''); const from=String(input.from||process.env.RINGCENTRAL_FROM_NUMBER||''); const suppression=await SuppressionService.isSuppressed(orgId,to); if(suppression.isSuppressed) throw new Error('SMS recipient is suppressed: '+(suppression.reason||'DNC')); if(!to||!text||!from) throw new Error('SMS action requires to, body and RINGCENTRAL_FROM_NUMBER'); const {SDK}=await import('@ringcentral/sdk'); const sdk=new SDK({server:process.env.RINGCENTRAL_SERVER_URL||'https://platform.ringcentral.com',clientId:process.env.RINGCENTRAL_CLIENT_ID||'',clientSecret:process.env.RINGCENTRAL_CLIENT_SECRET||''}); const p=sdk.platform(); const jwt=process.env.RINGCENTRAL_JWT?.trim(); if(!jwt) throw new Error('RingCentral JWT is required for SMS actions'); if(!(await p.loggedIn())) await p.login({jwt}); const response=await p.post('/restapi/v1.0/account/~/extension/~/sms',{from:{phoneNumber:from},to:[{phoneNumber:to}],text}); const data=await response.json(); return {ok:true,provider:'ringcentral',messageId:data.id||null}; }
    case 'phone': { const to=String(input.to||''); if(!to) throw new Error('Phone action requires to'); const suppression=await SuppressionService.isSuppressed(orgId,to); if(suppression.isSuppressed) throw new Error('Phone recipient is suppressed: '+(suppression.reason||'DNC')); const r=await getTelephonyAdapter('ringcentral').initiateCall({organizationId:orgId,toNumber:to,contactName:String(input.contact_name||'Workflow Contact'),fromNumber:input.from?String(input.from):undefined,callStrategyBrief:input.call_strategy_brief?String(input.call_strategy_brief):undefined}); if(!r.success) throw new Error(r.error||'Phone action failed'); return {ok:true,provider:r.provider,telephonyCallId:r.telephonyCallId}; }
    case 'webhook': { const u=new URL(String(input.url||'')); if(u.protocol!=='https:'||u.username||u.password) throw new Error('Webhook must be HTTPS without credentials'); const allowed=(process.env.WORKFLOW_WEBHOOK_ALLOWLIST||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean); if(!allowed.includes(u.hostname.toLowerCase())) throw new Error('Webhook host is not allowlisted'); const r=await fetch(u,{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify(input.body||{}),signal:AbortSignal.timeout(10000)}); if(!r.ok) throw new Error('Webhook returned HTTP '+r.status); return {ok:true,status:r.status}; }
    case 'ai_agent': { const task:any={task_id:'wf_task_'+randomUUID(),assigned_agent:String(input.agent_id||step.assigned_agent||'sub_agent_1'),objective:String(input.objective||step.objective||''),input,status:'queued',dependencies:[],priority:'medium',created_at:new Date().toISOString(),organization_id:orgId}; const result=await executeSubAgent(task.assigned_agent as any,task,{organizationId:orgId}); return {ok:true,result}; }
    default: throw new Error('Unsupported workflow action: '+action);
  }
}
export async function processWorkflowJob(pool:Pool,job:JobRecord,workerId:string){
  const org=requireOrganizationId(job.organization_id); const scheduleId=String(job.payload?.scheduleId||''); const schedule=(await pool.query('SELECT * FROM workflow_schedules WHERE id=$1 AND organization_id=$2',[scheduleId,org])).rows[0]; if(!schedule){await completeJob(pool,org,job.id,workerId);return;}
  const version=(await pool.query('SELECT * FROM workflow_versions WHERE id=$1 AND organization_id=$2',[schedule.workflow_version_id,org])).rows[0]; if(!version){await failJob(pool,org,job.id,workerId,'Workflow version not found',60);return;}
  const def=parseJson(version.definition,{}); const steps=Array.isArray(def.steps)?def.steps:[]; const runId=String(job.payload?.runId||'wfr_'+randomUUID()); const start=Number(job.payload?.resumeStepIndex||0);
  if(!job.payload?.runId) await pool.query("INSERT INTO workflow_runs (id,organization_id,workflow_id,name,status,total_steps,initiated_by) VALUES ($1,$2,$3,$4,'running',$5,'scheduler')",[runId,org,schedule.workflow_id,def.name||schedule.name,steps.length]);
  const context:any={trigger:parseJson(job.payload?.triggerPayload,{}),workflow:def,now:new Date().toISOString(),steps:{}};
  try{
    for(let i=start;i<steps.length;i++){ const step=steps[i]; const stepId=String(step.step_id||'step_'+(i+1)); const idem=runId+':'+stepId;
      if(step.condition&&!evaluateCondition(step.condition,context)){ await pool.query("INSERT INTO workflow_execution_steps (id,organization_id,workflow_run_id,workflow_step_id,step_index,action_type,status,idempotency_key,input,completed_at) VALUES ($1,$2,$3,$4,$5,$6,'skipped',$7,$8::jsonb,CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING",['wfsx_'+randomUUID(),org,runId,stepId,i,String(step.action_type||step.action||step.type||'noop'),idem,JSON.stringify(step.input_mapping||{})]); continue; }
      const existing=await pool.query('SELECT status FROM workflow_execution_steps WHERE organization_id=$1 AND idempotency_key=$2',[org,idem]); if(existing.rowCount&&['completed','skipped'].includes(existing.rows[0].status)) continue;
      await pool.query("INSERT INTO workflow_execution_steps (id,organization_id,workflow_run_id,workflow_step_id,step_index,action_type,status,attempt,max_attempts,idempotency_key,input,started_at) VALUES ($1,$2,$3,$4,$5,$6,'running',1,$7,$8,$9::jsonb,CURRENT_TIMESTAMP) ON CONFLICT (organization_id,idempotency_key) DO UPDATE SET status='running',attempt=workflow_execution_steps.attempt+1,started_at=CURRENT_TIMESTAMP",['wfsx_'+randomUUID(),org,runId,stepId,i,String(step.action_type||step.action||step.type||'noop'),Number(step.retryCount||2)+1,idem,JSON.stringify(step.input_mapping||{})]);
      await logWorkflowEvent(pool,org,{runId,stepId,event:'step_started',message:'Started '+String(step.name||stepId)});
      const output=await executeAction(pool,org,step,context);
      if(output.waiting){ const delay=Math.max(1,Number(output.delay_seconds||60)); await pool.query("UPDATE workflow_execution_steps SET status='waiting',scheduled_at=CURRENT_TIMESTAMP+($1*INTERVAL '1 second'),output=$2::jsonb,updated_at=CURRENT_TIMESTAMP WHERE organization_id=$3 AND idempotency_key=$4",[delay,JSON.stringify(output),org,idem]); await enqueueJob(pool,org,WORKFLOW_JOB_TYPE,{scheduleId,workflowId:schedule.workflow_id,workflowVersionId:schedule.workflow_version_id,triggerPayload:job.payload?.triggerPayload,runId,resumeStepIndex:i+1},Number(step.retryCount||2)+1); await completeJob(pool,org,job.id,workerId); return; }
      context.steps[stepId]=output; context.last=output; await pool.query("UPDATE workflow_execution_steps SET status='completed',output=$1::jsonb,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE organization_id=$2 AND idempotency_key=$3",[JSON.stringify(output),org,idem]); await logWorkflowEvent(pool,org,{runId,stepId,event:'step_succeeded',message:'Completed '+String(step.name||stepId),metadata:output});
    }
    await pool.query("UPDATE workflow_runs SET status='completed',completed_steps=$1,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,final_summary=$2 WHERE id=$3 AND organization_id=$4",[steps.length,'Completed '+steps.length+' workflow steps',runId,org]); await logWorkflowEvent(pool,org,{runId,event:'workflow_completed',message:'Workflow completed successfully'}); await completeJob(pool,org,job.id,workerId);
  }catch(e:any){ const msg=String(e?.message||e); await pool.query("UPDATE workflow_runs SET status='failed',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,final_summary=$1 WHERE id=$2 AND organization_id=$3",[msg,runId,org]); await logWorkflowEvent(pool,org,{runId,level:'error',event:'workflow_failed',message:msg}); await failJob(pool,org,job.id,workerId,msg,Math.min(300,30*Math.max(1,job.attempts))); throw e; }
}
export async function runWorkflowWorkerOnce(pool:Pool){ let processed=0; const worker='workflow-worker-'+process.pid; const orgs=(await pool.query("SELECT DISTINCT organization_id FROM jobs WHERE job_type=$1 AND (status='queued' OR (status='processing' AND locked_at<CURRENT_TIMESTAMP-INTERVAL '5 minutes'))",[WORKFLOW_JOB_TYPE])).rows.map(r=>r.organization_id); for(const org of orgs){await recoverStaleJobs(pool,org,300); for(let i=0;i<10;i++){const job=await claimNextJob(pool,org,worker,[WORKFLOW_JOB_TYPE]); if(!job)break; processed++; try{await processWorkflowJob(pool,job,worker);}catch{}}} return processed; }
