import fs from 'node:fs/promises';
import path from 'node:path';

export type OpenAIAgentSessionState = {
  stateDir: string;
  conversationIdPath: string;
};

export function createSessionState(root: string): OpenAIAgentSessionState {
  const stateDir = path.join(root, '.openai');
  return {
    stateDir,
    conversationIdPath: path.join(stateDir, 'conversation-id'),
  };
}

export async function loadConversationId(state: OpenAIAgentSessionState): Promise<string | undefined> {
  try {
    const value = (await fs.readFile(state.conversationIdPath, 'utf8')).trim();
    return value || undefined;
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (code === 'ENOENT') return undefined;
    throw error;
  }
}

export async function persistConversationId(
  state: OpenAIAgentSessionState,
  conversationId: string,
): Promise<void> {
  await fs.mkdir(state.stateDir, { recursive: true, mode: 0o700 });
  await fs.writeFile(state.conversationIdPath, `${conversationId}\n`, {
    mode: 0o600,
  });
}

export function describeOpenAIProviderError(error: unknown): string {
  const candidate = error as {
    status?: number;
    code?: string;
    message?: string;
    error?: { code?: string; message?: string };
  };
  const status = candidate?.status ?? '';
  const code = candidate?.code ?? candidate?.error?.code ?? '';
  const message = candidate?.message ?? candidate?.error?.message ?? String(error);
  const providerDetails = [status && `HTTP ${status}`, code && `code=${code}`].filter(Boolean).join(', ');

  if (status === 404 || code === 'not_found') {
    return `OpenAI rejected the persisted conversation/session state (${providerDetails || 'not found'}). The stored conversation ID was preserved; inspect the provider response before changing or resetting it. Message: ${message}`;
  }

  return `OpenAI provider request failed${providerDetails ? ` (${providerDetails})` : ''}: ${message}`;
}
