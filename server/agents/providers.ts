import { generateAgentText } from '../gemini';

export type AgentProvider = 'gemini' | 'openai' | 'anthropic';

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
}

export interface AgentProviderRequest {
  provider: AgentProvider;
  model: string;
  systemInstruction: string;
  messages: AgentMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AgentProviderResult {
  provider: AgentProvider;
  model: string;
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  cached?: boolean;
  raw?: unknown;
}

function jsonText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function extractOpenAIText(body: any): string {
  if (typeof body?.output_text === 'string') return body.output_text;
  const parts: string[] = [];
  for (const item of body?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

async function callOpenAI(request: AgentProviderRequest): Promise<AgentProviderResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  const input = request.messages.map((m) => ({
    role: m.role === 'tool' ? 'user' : m.role,
    content: m.content,
  }));
  const response = await fetch(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: request.model,
      instructions: request.systemInstruction,
      input,
      temperature: request.temperature,
      max_output_tokens: request.maxTokens || 4096,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${jsonText(body?.error || body)}`);
  return {
    provider: 'openai',
    model: request.model,
    text: extractOpenAIText(body),
    inputTokens: body?.usage?.input_tokens,
    outputTokens: body?.usage?.output_tokens,
    raw: body,
  };
}

async function callAnthropic(request: AgentProviderRequest): Promise<AgentProviderResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
  const messages = request.messages
    .filter((m) => m.role !== 'tool')
    .map((m) => ({ role: m.role, content: m.content }));
  const response = await fetch(process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': process.env.ANTHROPIC_API_VERSION || '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: request.model,
      system: request.systemInstruction,
      messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens || 4096,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Anthropic ${response.status}: ${jsonText(body?.error || body)}`);
  const text = (body?.content || [])
    .filter((part: any) => part?.type === 'text')
    .map((part: any) => part.text)
    .join('\n')
    .trim();
  return {
    provider: 'anthropic',
    model: request.model,
    text,
    inputTokens: body?.usage?.input_tokens,
    outputTokens: body?.usage?.output_tokens,
    raw: body,
  };
}

export function inferAgentProvider(model: string, explicit?: string): AgentProvider {
  const requested = (explicit || process.env.AI_AGENT_PROVIDER || '').toLowerCase();
  if (requested === 'openai' || requested === 'anthropic' || requested === 'gemini') return requested;
  if (model.toLowerCase().startsWith('gpt-')) return 'openai';
  if (model.toLowerCase().startsWith('claude-')) return 'anthropic';
  return 'gemini';
}

export async function generateWithAgentProvider(request: AgentProviderRequest): Promise<AgentProviderResult> {
  if (request.provider === 'openai') return callOpenAI(request);
  if (request.provider === 'anthropic') return callAnthropic(request);
  const result = await generateAgentText(request.messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n'), {
    model: request.model,
    systemInstruction: request.systemInstruction,
    temperature: request.temperature,
    useThinking: true,
  });
  return { provider: 'gemini', model: request.model, text: result.text, cached: result.cached };
}
