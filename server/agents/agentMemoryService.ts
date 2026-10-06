import { getPgPool } from '../db/db';

export async function listAgentMemories(organizationId: string, agentId: string, limit = 100): Promise<any[]> {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is required');
  const result = await pool.query(
    'SELECT id, agent_id, memory_key, content, importance, metadata, created_at, updated_at FROM agent_memories WHERE organization_id=$1 AND agent_id=$2 ORDER BY importance DESC, updated_at DESC LIMIT $3',
    [organizationId, agentId, Math.min(500, Math.max(1, limit))],
  );
  return result.rows;
}

export async function upsertAgentMemory(organizationId: string, agentId: string, input: { memoryKey:string; content:string; importance?:number; metadata?:Record<string,any> }): Promise<any> {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is required');
  const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const result = await pool.query(
    `INSERT INTO agent_memories (id, organization_id, agent_id, memory_key, content, importance, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
     ON CONFLICT (organization_id, agent_id, memory_key)
     DO UPDATE SET content=EXCLUDED.content, importance=EXCLUDED.importance, metadata=EXCLUDED.metadata, updated_at=CURRENT_TIMESTAMP
     RETURNING *`,
    [id, organizationId, agentId, input.memoryKey, input.content, Math.max(0, Math.min(1, input.importance ?? 0.5)), JSON.stringify(input.metadata || {})],
  );
  return result.rows[0];
}
