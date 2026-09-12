import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import {
  Agent,
  OpenAIConversationsSession,
  run,
} from '@openai/agents';
import {
  createSessionState,
  describeOpenAIProviderError,
  loadConversationId,
  persistConversationId,
} from './openai-agent-session.js';

type AgentConfig = {
  name: string;
  model?: string;
  instructions?: string;
};

const root = path.resolve(import.meta.dirname, '..');
const configPath = path.join(root, 'config', 'openai-agent.json');
const project = process.env.OPENAI_PROJECT_ID || 'proj_mw8PSjcctbVnHmf5Ws7YEofK';

if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY is not set.');
  process.exit(1);
}

const config = JSON.parse(await fs.readFile(configPath, 'utf8')) as AgentConfig;
const state = createSessionState(root);
const conversationId = await loadConversationId(state);

const agent = new Agent({
  name: config.name,
  instructions:
    config.instructions ||
    'You are the Vortex One engineering agent. Verify facts before reporting status. Keep responses concise and execution-focused.',
  model: config.model,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  project,
});

const session = new OpenAIConversationsSession({
  conversationId,
  client: openai,
  project,
});

const initialMessage =
  'Connect to Vortex One and confirm that the OpenAI Agents SDK session is running. Respond with a concise status report.';

console.log(`Agent: ${config.name}`);
console.log(`Model: ${config.model || 'SDK default'}`);
console.log(`Project: ${project}`);
console.log(`Persisted conversation ID: ${conversationId ? 'present' : 'absent'}`);
console.log('Starting OpenAI Agents SDK session...');

try {
  const sessionResult = await run(agent, initialMessage, { session });

  console.log(sessionResult.finalOutput);
  const persistedConversationId = await session.getSessionId();
  if (!conversationId && persistedConversationId) {
    await persistConversationId(state, persistedConversationId);
  }

  console.log('\nOpenAI Agents SDK run complete.');
  console.log(`Session ID: ${persistedConversationId}`);
  console.log(`Response ID: ${sessionResult.lastResponseId || 'n/a'}`);
  console.log(`Project: ${project}`);
} catch (error) {
  console.error('\nOpenAI Agents SDK run failed.');
  console.error(describeOpenAIProviderError(error));
  process.exit(1);
}
