import assert from 'node:assert/strict';
import { generateWithAgentProvider } from '../agents/providers';

const originalFetch = globalThis.fetch;
const originalOpenAI = process.env.OPENAI_API_KEY;
const originalAnthropic = process.env.ANTHROPIC_API_KEY;

try {
  process.env.OPENAI_API_KEY = 'test-openai-key';
  let openAIToolsSeen = false;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    openAIToolsSeen = Array.isArray(body.tools) && body.tools[0]?.name === 'search_property';
    return new Response(JSON.stringify({
      id: 'resp_test',
      output_text: 'OpenAI mocked response',
      output: [{ type: 'function_call', call_id: 'call_1', name: 'search_property', arguments: '{"address":"123 Main St"}' }],
      usage: { input_tokens: 12, output_tokens: 7 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  const openAI = await generateWithAgentProvider({
    provider: 'openai',
    model: 'gpt-test',
    systemInstruction: 'test',
    messages: [{ role: 'user', content: 'find it' }],
    tools: [{ name: 'search_property', description: 'Search property', parameters: { type: 'object', properties: { address: { type: 'string' } } } }],
  });
  assert.equal(openAI.toolCalls?.[0]?.name, 'search_property');
  assert.equal(openAI.toolCalls?.[0]?.args.address, '123 Main St');
  assert.equal(openAI.inputTokens, 12);
  assert.equal(openAIToolsSeen, true);

  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    assert.equal(body.tools[0].name, 'search_property');
    return new Response(JSON.stringify({
      content: [
        { type: 'text', text: 'Anthropic mocked response' },
        { type: 'tool_use', id: 'tool_1', name: 'search_property', input: { address: '456 Oak Ave' } },
      ],
      usage: { input_tokens: 10, output_tokens: 5 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  const anthropic = await generateWithAgentProvider({
    provider: 'anthropic',
    model: 'claude-test',
    systemInstruction: 'test',
    messages: [{ role: 'user', content: 'find it' }],
    tools: [{ name: 'search_property', description: 'Search property', parameters: { type: 'object', properties: { address: { type: 'string' } } } }],
  });
  assert.equal(anthropic.toolCalls?.[0]?.name, 'search_property');
  assert.equal(anthropic.toolCalls?.[0]?.args.address, '456 Oak Ave');
  assert.equal(anthropic.outputTokens, 5);

  console.log('agentProviderMock.test.ts: passed');
} finally {
  globalThis.fetch = originalFetch;
  if (originalOpenAI === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalOpenAI;
  if (originalAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = originalAnthropic;
}
