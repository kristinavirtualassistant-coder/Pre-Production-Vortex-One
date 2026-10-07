import { getGeminiClient } from '../gemini';

export type AgentProvider = 'gemini' | 'openai' | 'anthropic';

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface AgentProviderRequest {
  provider: AgentProvider;
  model: string;
  systemInstruction: string;
  messages: AgentMessage[];
  tools?: AgentToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  previousResponseId?: string;
}

export interface AgentToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface AgentProviderResult {
  provider: AgentProvider;
  model: string;
  text: string;
  toolCalls?: AgentToolCall[];
  inputTokens?: number;
  outputTokens?: number;
  cached?: boolean;
  responseId?: string;
  raw?: unknown;
}

function jsonText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function openAITools(tools: AgentToolDefinition[] = []) {
  return tools.map((tool) => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: false,
  }));
}

function anthropicTools(tools: AgentToolDefinition[] = []) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}

function extractOpenAIToolCalls(body: any): AgentToolCall[] {
  return (body?.output || [])
    .filter((item: any) => item?.type === 'function_call' && item?.name)
    .map((item: any) => ({
      id: item.call_id || item.id || `call_${Date.now()}`,
      name: item.name,
      args: typeof item.arguments === 'string' ? JSON.parse(item.arguments || '{}') : (item.arguments || {}),
    }));
}

function extractAnthropicToolCalls(body: any): AgentToolCall[] {
  return (body?.content || [])
    .filter((part: any) => part?.type === 'tool_use' && part?.name)
    .map((part: any) => ({
      id: part.id || `call_${Date.now()}`,
      name: part.name,
      args: part.input || {},
    }));
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
  const input = request.messages.map((m) => {
    if (m.role === 'tool') return { type: 'function_call_output', call_id: m.toolCallId, output: m.content };
    return { role: m.role, content: m.content };
  });
  const response = await fetch(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: request.model,
      instructions: request.systemInstruction,
      input,
      tools: request.tools?.length ? openAITools(request.tools) : undefined,
      temperature: request.temperature,
      max_output_tokens: request.maxTokens || 4096,
      ...(request.previousResponseId ? { previous_response_id: request.previousResponseId } : {}),
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${jsonText(body?.error || body)}`);
  return {
    provider: 'openai',
    model: request.model,
    text: extractOpenAIText(body),
    toolCalls: extractOpenAIToolCalls(body),
    inputTokens: body?.usage?.input_tokens,
    outputTokens: body?.usage?.output_tokens,
    responseId: body?.id,
    raw: body,
  };
}

async function callAnthropic(request: AgentProviderRequest): Promise<AgentProviderResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
  const messages = request.messages.map((m) => {
    if (m.role === 'tool') return { role: 'user', content: `Tool ${m.name || 'result'} result:\n${m.content}` };
    return { role: m.role, content: m.content };
  });
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
      tools: request.tools?.length ? anthropicTools(request.tools) : undefined,
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
    toolCalls: extractAnthropicToolCalls(body),
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
  const ai = getGeminiClient();
  if (!ai) throw new Error('GEMINI_API_KEY is not configured');
  const contents = request.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.role === 'tool' ? `Tool ${m.name || 'result'} result:\n${m.content}` : m.content }],
  }));
  const config: any = {
    systemInstruction: request.systemInstruction,
    temperature: request.temperature,
    maxOutputTokens: request.maxTokens || 4096,
  };
  if (request.tools?.length) {
    config.tools = [{
      functionDeclarations: request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parametersJsonSchema: tool.parameters,
      })),
    }];
  }
  const response = await ai.models.generateContent({ model: request.model, contents, config });
  const parts = (response.candidates?.[0] as any)?.content?.parts || [];
  const toolCalls = parts.filter((part: any) => part?.functionCall?.name).map((part: any, index: number) => ({
    id: part.functionCall.id || `gemini_call_${Date.now()}_${index}`,
    name: part.functionCall.name,
    args: part.functionCall.args || {},
  }));
  const text = parts.filter((part: any) => typeof part?.text === 'string').map((part: any) => part.text).join('\n').trim();
  const usage = (response as any).usageMetadata || {};
  return {
    provider: 'gemini',
    model: request.model,
    text,
    toolCalls,
    inputTokens: Number(usage.promptTokenCount || usage.inputTokenCount || 0),
    outputTokens: Number(usage.candidatesTokenCount || usage.outputTokenCount || 0),
    raw: response,
  };
}
