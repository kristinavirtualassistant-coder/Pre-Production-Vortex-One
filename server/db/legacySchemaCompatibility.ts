export interface SchemaColumn {
  column_name: string;
  is_nullable: string;
  column_default: string | null;
}

export interface CallPersistencePlan {
  ready: boolean;
  columns: string[];
  missingRequiredColumns: string[];
}

const CALL_COLUMN_VALUES = new Set([
  'id',
  'started_at',
  'ended_at',
  'duration_seconds',
  'connection_status',
  'disposition',
  'notes',
  'next_action',
  'follow_up_at',
  'provider',
  'provider_call_id',
  'created_at',
]);

export function buildCallPersistencePlan(columns: SchemaColumn[]): CallPersistencePlan {
  const available = new Set(columns.map((column) => column.column_name));
  const missingRequiredColumns = columns
    .filter((column) => column.is_nullable === 'NO' && !column.column_default && !CALL_COLUMN_VALUES.has(column.column_name))
    .map((column) => column.column_name);

  const columnsToWrite = [...CALL_COLUMN_VALUES].filter((column) => available.has(column));
  return {
    ready: missingRequiredColumns.length === 0 && available.has('id'),
    columns: columnsToWrite,
    missingRequiredColumns,
  };
}

export async function persistLegacyCall(
  client: { query: (text: string, values?: unknown[]) => Promise<unknown> },
  call: {
    id: string;
    telephonyCallId: string;
    status: string;
    durationSeconds: number;
    disposition?: string;
    notes?: string;
    createdAt: string;
  },
): Promise<void> {
  const result = await client.query(
    `SELECT column_name, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'calls'
      ORDER BY ordinal_position`,
  ) as { rows: SchemaColumn[] };

  const plan = buildCallPersistencePlan(result.rows);
  if (!plan.ready) {
    throw new Error(`Legacy calls table cannot safely persist outbound calls; missing required columns: ${plan.missingRequiredColumns.join(', ')}`);
  }

  const valuesByColumn: Record<string, unknown> = {
    id: call.id,
    started_at: call.createdAt,
    duration_seconds: call.durationSeconds,
    connection_status: call.status,
    disposition: call.disposition ?? null,
    notes: call.notes ?? null,
    provider: 'ringcentral',
    provider_call_id: call.telephonyCallId,
    created_at: call.createdAt,
  };
  const values = plan.columns.map((column) => valuesByColumn[column]);
  const placeholders = plan.columns.map((_, index) => `$${index + 1}`).join(', ');

  await client.query(
    `INSERT INTO calls (${plan.columns.join(', ')}) VALUES (${placeholders})`,
    values,
  );
}
