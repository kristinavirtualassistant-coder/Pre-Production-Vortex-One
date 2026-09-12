import fs from 'node:fs/promises';
import path from 'node:path';
import { Agent, OpenAIConversationsSession, run } from '@openai/agents';

type AgentConfig = {
  name: string;
  model?: string;
  instructions?: string;
};

const root = path.resolve(import.meta.dirname, '..');
const configPath = path.join(root, 'config', 'openai-agent.json');
const stateDir = path.join(root, '.openai');
const conversationIdPath = path.join(stateDir, 'conversation-id');
const project = 'proj_mw8PSjcctbVnHmf5Ws7YEofK';

if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY is not set.');
  process.exit(1);
}

const config = JSON.parse(await fs.readFile(configPath, 'utf8')) as AgentConfig;
const agent = new Agent({
  name: config.name,
  instructions:
    config.instructions ||
    'You are the Vortex One engineering agent. Respond concisely and report execution status accurately.',
  model: config.model,
});

await fs.mkdir(stateDir, { recursive: true, mode: 0o700 });

let conversationId: string | undefined;
try {
  conversationId = (await fs.readFile(conversationIdPath, 'utf8')).trim() || undefined;
} catch {
  // First run: OpenAIConversationsSession will create the conversation lazily.
}

const session = new OpenAIConversationsSession({
  conversationId,
  project,
});

const initialMessage =
  'Connect to Vortex One and confirm that the OpenAI Agents SDK session is running. Respond with a concise status report.';

console.log(`Agent: ${config.name}`);
console.log(`Model: ${config.model || 'SDK default'}`);
console.log('Starting OpenAI-managed conversation session...');

try {
  const result = await run(agent, initialMessage, {
    session,
    stream: true,
  });

  for await (const event of result) {
    if (event.type === 'raw_model_stream_event') {
      const data = event.data as { type?: string; delta?: string };
      if (data.type === 'response.output_text.delta' && data.delta) {
        process.stdout.write(data.delta);
      }
    }
  }

  await result.completed;
  const persistedConversationId = await session.getSessionId();
  if (!conversationId && persistedConversationId) {
    await fs.writeFile(conversationIdPath, `${persistedConversationId}\n`, {
      mode: 0o600,
    });
  }

  console.log('\n\nOpenAI Agents SDK run complete.');
  console.log(`Session ID: ${persistedConversationId}`);
  console.log(`Project: ${project}`);
} catch (error) {
  console.error('\nOpenAI Agents SDK run failed.');
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
}
