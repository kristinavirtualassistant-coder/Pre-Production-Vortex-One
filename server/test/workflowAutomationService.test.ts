import assert from 'node:assert/strict';
import { evaluateCondition } from '../services/workflowAutomationService';

const context={lead:{score:75,status:'qualified'},now:'2026-10-06T12:00:00Z'};
assert.equal(evaluateCondition({field:'lead.score',operator:'>=',value:70},context),true);
assert.equal(evaluateCondition({all:[{field:'lead.score',operator:'>=',value:70},{field:'lead.status',operator:'==',value:'qualified'}]},context),true);
assert.equal(evaluateCondition({any:[{field:'lead.score',operator:'<',value:10},{field:'lead.status',operator:'==',value:'qualified'}]},context),true);
assert.equal(evaluateCondition({not:{field:'lead.status',operator:'==',value:'closed'}},context),true);
assert.equal(evaluateCondition({field:'lead.status',operator:'contains',value:'qual'},context),true);
console.log('Workflow automation condition tests passed.');

assert.equal(evaluateCondition({field:'lead.createdAt',operator:'before',value:'2026-10-07T00:00:00Z'}, {...context,lead:{...context.lead,createdAt:'2026-10-06T12:00:00Z'}}),true);
assert.equal(evaluateCondition({field:'lead.createdAt',operator:'on_or_after',value:'$now'}, {...context,lead:{...context.lead,createdAt:new Date(Date.now()+60_000).toISOString()}}),true);


import { claimDueWorkflowSchedules, reconcileStaleCommunicationDeliveries } from '../services/workflowAutomationService';

{
  const calls:string[]=[];
  const client:any={
    query: async (sql:string) => {
      calls.push(sql);
      if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK') return {rows:[]};
      if(sql.startsWith('SELECT * FROM workflow_schedules')) return {rows:[{
        id:'wfs_test',organization_id:'org_test',workflow_id:'wf_test',workflow_version_id:'wfv_test',
        trigger_payload:{source:'test'},schedule_type:'once',status:'active',next_run_at:new Date()
      }]};
      if(sql.startsWith('INSERT INTO jobs')) throw new Error('simulated enqueue failure');
      return {rows:[]};
    },
    release:()=>{},
  };
  const pool:any={connect:async()=>client};
  await assert.rejects(() => claimDueWorkflowSchedules(pool), /simulated enqueue failure/);
  assert.equal(calls.at(-1),'ROLLBACK');
  assert.equal(calls.includes('COMMIT'),false);
}


{
  const calls:string[]=[];
  const pool:any={
    query: async (sql:string) => {
      calls.push(sql);
      if(sql.startsWith('UPDATE workflow_communication_deliveries')) return {rows:[{
        id:'wcd_test',workflow_run_id:'wfr_test',workflow_step_id:'step_1',
        channel:'webhook',destination:'hook',idempotency_key:'wfr_test:step_1'
      }]};
      if(sql.startsWith('INSERT INTO workflow_execution_logs')) return {rows:[]};
      throw new Error('unexpected reconciliation query');
    }
  };
  const rows=await reconcileStaleCommunicationDeliveries(pool,'org_test',600);
  assert.equal(rows.length,1);
  assert.match(calls[0],/status='sending'/);
  assert.match(calls[0],/status='manual_review'/);
}
