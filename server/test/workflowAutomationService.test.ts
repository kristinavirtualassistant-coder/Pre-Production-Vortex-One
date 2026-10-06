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
