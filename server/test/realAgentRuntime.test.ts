import assert from 'node:assert/strict';
import { inferAgentProvider } from '../agents/providers';

assert.equal(inferAgentProvider('gpt-6-luna'), 'openai');
assert.equal(inferAgentProvider('claude-sonnet-4-5'), 'anthropic');
assert.equal(inferAgentProvider('gemini-3.1-flash-lite'), 'gemini');
assert.equal(inferAgentProvider('custom-model', 'anthropic'), 'anthropic');

console.log('realAgentRuntime.test.ts: passed');
