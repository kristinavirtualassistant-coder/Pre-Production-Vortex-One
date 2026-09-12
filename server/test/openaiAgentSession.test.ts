import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createSessionState,
  describeOpenAIProviderError,
  loadConversationId,
  persistConversationId,
} from '../../scripts/openai-agent-session.js';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'vortex-openai-session-'));
const state = createSessionState(tempRoot);

try {
  assert.equal(await loadConversationId(state), undefined);

  const staleConversationId = 'conv_stale_123';
  await persistConversationId(state, staleConversationId);
  assert.equal(await loadConversationId(state), staleConversationId);

  const message = describeOpenAIProviderError({
    status: 404,
    code: 'not_found',
    message: "message with id 'msg_stale_123' not found",
  });

  assert.match(message, /HTTP 404/);
  assert.match(message, /persisted conversation\/session state/);
  assert.match(message, /stored conversation ID was preserved/);
  assert.equal(await loadConversationId(state), staleConversationId);

  await persistConversationId(state, 'conv_replacement_456');
  assert.equal(await loadConversationId(state), 'conv_replacement_456');

  console.log('openaiAgentSession.test.ts: PASS');
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
