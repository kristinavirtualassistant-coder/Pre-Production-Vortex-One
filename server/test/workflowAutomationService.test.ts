import assert from 'node:assert/strict';
import { evaluateCondition } from '../services/workflowAutomationService';

process.env.WORKFLOW_WEBHOOK_ALLOWLIST='example.com';

test('workflow conditions support nested comparisons',()=>{
  const context={lead:{score:75,status:'qualified'},now:'2026-10-06T12:00:00Z'};
  assert.equal(evaluateCondition({field:'lead.score',operator:'>=',value:70},context),true);
  assert.equal(evaluateCondition({all:[{field:'lead.score',operator:'>=',value:70},{field:'lead.status',operator:'==',value:'qualified'}]},context),true);
  assert.equal(evaluateCondition({any:[{field:'lead.score',operator:'<',value:10},{field:'lead.status',operator:'==',value:'qualified'}]},context),true);
  assert.equal(evaluateCondition({not:{field:'lead.status',operator:'==',value:'closed'}},context),true);
});

test('workflow conditions support contains',()=>{
  assert.equal(evaluateCondition({field:'lead.status',operator:'contains',value:'qual'}, {lead:{status:'qualified'}}),true);
});

console.log('Workflow automation unit tests loaded.');
