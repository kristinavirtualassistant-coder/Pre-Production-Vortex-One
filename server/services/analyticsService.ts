import type { Pool } from 'pg';
import { requireOrganizationId } from './organizationContext';

export interface AnalyticsRange {
  organizationId: string;
  startDate?: string;
  endDate?: string;
  campaignId?: string;
  userId?: string;
}

function range(startDate?: string, endDate?: string) {
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86400000);
  const end = endDate ? new Date(endDate) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    throw new Error('Invalid analytics date range');
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

function n(value: unknown): number {
  return Number(value || 0);
}

export async function recordCostEvent(pool: Pool, input: {
  organizationId: string;
  id: string;
  userId?: string;
  campaignId?: string;
  category: string;
  provider?: string;
  quantity?: number;
  unitCostUsd?: number;
  totalCostUsd?: number;
  referenceType?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: Date | string;
}) {
  const organizationId = requireOrganizationId(input.organizationId);
  const quantity = input.quantity ?? 1;
  const unitCostUsd = input.unitCostUsd ?? 0;
  const totalCostUsd = input.totalCostUsd ?? quantity * unitCostUsd;
  await pool.query(
    `INSERT INTO analytics_cost_events
      (id, organization_id, user_id, campaign_id, category, provider, quantity, unit_cost_usd,
       total_cost_usd, reference_type, reference_id, metadata, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,COALESCE($13::timestamptz,NOW()))`,
    [
      input.id, organizationId, input.userId ?? null, input.campaignId ?? null, input.category,
      input.provider ?? null, quantity, unitCostUsd, totalCostUsd, input.referenceType ?? null,
      input.referenceId ?? null, JSON.stringify(input.metadata ?? {}), input.occurredAt ?? null,
    ],
  );
}

export function estimateAiCostUsd(input: {\n  model?: string;\n  inputTokens?: number;\n  outputTokens?: number;\n}): number | null {\n  // Google Gemini Developer API Standard pricing effective through 2026-12-31.\n  // Return null for unknown models so analytics never invents a cost.\n  const rates: Record<string, { input: number; output: number }> = {\n    'gemini-3.7-flash': { input: 0.75, output: 3.75 },\n    'gemini-3.8-flash': { input: 0.75, output: 3.75 },\n    'gemini-3.1-flash-lite': { input: 0.25, output: 1.50 },\n    'gemini-3.5-flash': { input: 1.50, output: 9.00 },\n  };\n  const rate = input.model ? rates[input.model] : undefined;\n  if (!rate) return null;\n  return ((input.inputTokens ?? 0) / 1_000_000) * rate.input\n    + ((input.outputTokens ?? 0) / 1_000_000) * rate.output;\n}\n\nexport async function recordAiUsage(pool: Pool, input: {
  organizationId: string;
  id: string;
  userId?: string;
  agentId?: string;
  workflowRunId?: string;
  provider: string;
  model?: string;
  operation: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  latencyMs?: number;
  success?: boolean;
  metadata?: Record<string, unknown>;
  occurredAt?: Date | string;
}) {
  const organizationId = requireOrganizationId(input.organizationId);
  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  const totalTokens = input.totalTokens ?? inputTokens + outputTokens;
  await pool.query(
    `INSERT INTO analytics_ai_usage
      (id, organization_id, user_id, agent_id, workflow_run_id, provider, model, operation,
       input_tokens, output_tokens, total_tokens, estimated_cost_usd, latency_ms, success, metadata, occurred_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,COALESCE($16::timestamptz,NOW()))`,
    [
      input.id, organizationId, input.userId ?? null, input.agentId ?? null, input.workflowRunId ?? null,
      input.provider, input.model ?? null, input.operation, inputTokens, outputTokens, totalTokens,
      input.estimatedCostUsd ?? 0, input.latencyMs ?? 0, input.success ?? true,
      JSON.stringify(input.metadata ?? {}), input.occurredAt ?? null,
    ],
  );
}

export async function getAnalytics(pool: Pool, input: AnalyticsRange) {
  const organizationId = requireOrganizationId(input.organizationId);
  const { start, end } = range(input.startDate, input.endDate);
  const campaignFilter = input.campaignId ? ' AND campaign_id = $4' : '';
  const userFilter = input.userId ? ' AND user_id = $4' : '';

  const [overview, funnel, trend, campaigns, agents, users, workflows, enrichment, ai, costs, values] =
    await Promise.all([
      pool.query(
        `SELECT
          (SELECT COUNT(*) FROM leads WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3) AS leads,
          (SELECT COUNT(*) FROM contacts WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3) AS contacts,
          (SELECT COUNT(*) FROM call WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3) AS calls,
          (SELECT COUNT(*) FROM call WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3 AND status IN ('connected','completed') AND duration_seconds > 0) AS connected_calls,
          (SELECT COUNT(*) FROM appointments WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3) AS appointments,
          (SELECT COUNT(*) FROM appointments WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3 AND status='completed') AS completed_appointments,
          (SELECT COUNT(*) FROM leads WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3 AND stage='won') AS won_leads,
          (SELECT COUNT(*) FROM leads WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3 AND stage='lost') AS lost_leads,
          (SELECT COUNT(*) FROM properties WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3) AS properties_added,
          (SELECT COUNT(*) FROM property_owners WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3) AS owners_added
        `,
        [organizationId, start, end],
      ),
      pool.query(
        `SELECT stage, COUNT(*)::int AS count
         FROM leads
         WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3
         GROUP BY stage ORDER BY count DESC`,
        [organizationId, start, end],
      ),
      pool.query(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                COUNT(*) FILTER (WHERE entity='lead')::int AS leads,
                COUNT(*) FILTER (WHERE entity='call')::int AS calls,
                COUNT(*) FILTER (WHERE entity='appointment')::int AS appointments,
                COUNT(*) FILTER (WHERE entity='won')::int AS won
         FROM (
           SELECT created_at, 'lead' AS entity FROM leads WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3
           UNION ALL
           SELECT created_at, 'call' FROM call WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3
           UNION ALL
           SELECT created_at, 'appointment' FROM appointments WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3
           UNION ALL
           SELECT created_at, 'won' FROM leads WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3 AND stage='won'
         ) x
         GROUP BY 1 ORDER BY 1`,
        [organizationId, start, end],
      ),
      pool.query(
        `SELECT c.id, c.name,
          c.status,
          c.total_contacts,
          c.dialed_count,
          c.connected_count,
          c.converted_count,
          COUNT(call.id)::int AS recorded_calls,
          COUNT(call.id) FILTER (WHERE call.status IN ('connected','completed') AND call.duration_seconds > 0)::int AS recorded_connections,
          COALESCE(SUM(call.duration_seconds),0)::int AS talk_seconds,
          COALESCE((SELECT SUM(total_cost_usd) FROM analytics_cost_events ace
            WHERE ace.organization_id=$1 AND ace.campaign_id=c.id AND ace.occurred_at >= $2 AND ace.occurred_at < $3),0)::numeric AS cost_usd
         FROM campaign c
         LEFT JOIN call ON call.organization_id=c.organization_id AND call.campaign_id=c.id
           AND call.created_at >= $2 AND call.created_at < $3
         WHERE c.organization_id=$1
         GROUP BY c.id ORDER BY cost_usd DESC, c.name`,
        [organizationId, start, end],
      ),
      pool.query(
        `SELECT COALESCE(ds.agent_user_id, l.assigned_agent) AS agent_id,
          COUNT(DISTINCT call.id)::int AS calls,
          COUNT(DISTINCT call.id) FILTER (WHERE call.status IN ('connected','completed') AND call.duration_seconds > 0)::int AS connected,
          COALESCE(SUM(call.duration_seconds),0)::int AS talk_seconds,
          COUNT(DISTINCT call.id) FILTER (WHERE call.disposition='interested')::int AS interested,
          COUNT(DISTINCT l.id) FILTER (WHERE l.stage='won')::int AS won_leads
         FROM call
         LEFT JOIN dialing_session ds ON ds.id=call.session_id AND ds.organization_id=call.organization_id
         LEFT JOIN leads l ON l.id=call.lead_id AND l.organization_id=call.organization_id
         WHERE call.organization_id=$1 AND call.created_at >= $2 AND call.created_at < $3
         GROUP BY COALESCE(ds.agent_user_id, l.assigned_agent)
         ORDER BY calls DESC`,
        [organizationId, start, end],
      ),
      pool.query(
        `SELECT u.id, u.name, u.email, u.role,
          COUNT(DISTINCT ds.id)::int AS sessions,
          COALESCE(SUM(ds.calls_placed),0)::int AS calls_placed,
          COALESCE(SUM(ds.contacts_reached),0)::int AS contacts_reached,
          COALESCE((
            SELECT SUM(ace.total_cost_usd) FROM analytics_cost_events ace
            WHERE ace.organization_id=u.organization_id AND ace.user_id=u.id
              AND ace.occurred_at >= $2 AND ace.occurred_at < $3
          ),0)::numeric AS cost_usd
         FROM users u
         LEFT JOIN dialing_session ds ON ds.organization_id=u.organization_id AND ds.agent_user_id=u.id
           AND ds.started_at >= $2 AND ds.started_at < $3
         WHERE u.organization_id=$1
         GROUP BY u.id ORDER BY calls_placed DESC, u.name`,
        [organizationId, start, end],
      ),
      pool.query(
        `SELECT status, COUNT(*)::int AS runs,
          COALESCE(SUM(execution_time_ms),0)::bigint AS execution_time_ms,
          COUNT(*) FILTER (WHERE status='completed')::int AS completed,
          COUNT(*) FILTER (WHERE status='failed')::int AS failed
         FROM workflow_runs
         WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3
         GROUP BY status ORDER BY runs DESC`,
        [organizationId, start, end],
      ),
      pool.query(
        `SELECT
          (SELECT COUNT(*) FROM property_owners WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3) AS owners_created,
          (SELECT COUNT(*) FROM contacts WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3) AS contacts_created,
          (SELECT COUNT(*) FROM contacts WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3 AND jsonb_array_length(phone_numbers) > 0) AS contacts_with_phone,
          (SELECT COUNT(*) FROM contacts WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3 AND jsonb_array_length(email_addresses) > 0) AS contacts_with_email
        `,
        [organizationId, start, end],
      ),
      pool.query(
        `SELECT provider, COALESCE(model,'unknown') AS model, operation,
          COUNT(*)::int AS requests, COALESCE(SUM(total_tokens),0)::bigint AS tokens,
          COALESCE(SUM(estimated_cost_usd),0)::numeric AS cost_usd,
          COALESCE(AVG(latency_ms),0)::numeric AS avg_latency_ms,
          COUNT(*) FILTER (WHERE success)::int AS successful,
          COUNT(*) FILTER (WHERE NOT success)::int AS failed
         FROM analytics_ai_usage
         WHERE organization_id=$1 AND occurred_at >= $2 AND occurred_at < $3
         GROUP BY provider, model, operation ORDER BY requests DESC`,
        [organizationId, start, end],
      ),
      pool.query(
        `SELECT category, provider, COUNT(*)::int AS events,
                COALESCE(SUM(total_cost_usd),0)::numeric AS cost_usd
         FROM analytics_cost_events
         WHERE organization_id=$1 AND occurred_at >= $2 AND occurred_at < $3
         GROUP BY category, provider ORDER BY cost_usd DESC`,
        [organizationId, start, end],
      ),
      pool.query(
        `SELECT event_type, COUNT(*)::int AS events,
                COALESCE(SUM(amount_usd),0)::numeric AS amount_usd
         FROM analytics_value_events
         WHERE organization_id=$1 AND occurred_at >= $2 AND occurred_at < $3
         GROUP BY event_type ORDER BY amount_usd DESC`,
        [organizationId, start, end],
      ),
    ]);

  const o = overview.rows[0] || {};
  const leads = n(o.leads);
  const calls = n(o.calls);
  const connected = n(o.connected_calls);
  const appointments = n(o.appointments);
  const won = n(o.won_leads);
  const cost = costs.rows.reduce((sum, r) => sum + n(r.cost_usd), 0);
  const revenue = values.rows.filter(r => r.event_type === 'revenue').reduce((sum, r) => sum + n(r.amount_usd), 0);

  return {
    range: { start, end },
    overview: {
      leads, contacts: n(o.contacts), calls, connectedCalls: connected, appointments,
      completedAppointments: n(o.completed_appointments), wonLeads: won, lostLeads: n(o.lost_leads),
      propertiesAdded: n(o.properties_added), ownersAdded: n(o.owners_added),
      contactRate: leads ? connected / leads * 100 : 0,
      appointmentRate: leads ? appointments / leads * 100 : 0,
      winRate: leads ? won / leads * 100 : 0,
      connectionRate: calls ? connected / calls * 100 : 0,
    },
    funnel: funnel.rows,
    trend: trend.rows,
    campaigns: campaigns.rows,
    agents: agents.rows,
    users: users.rows,
    workflows: workflows.rows,
    enrichment: enrichment.rows[0] || {},
    ai: ai.rows,
    costs: costs.rows,
    roi: {
      revenueUsd: revenue,
      costUsd: cost,
      roiPercent: cost > 0 ? ((revenue - cost) / cost) * 100 : null,
      status: cost > 0 ? 'measured' : 'no_recorded_costs',
      note: cost > 0 ? 'ROI uses recorded value and cost events only.' : 'Record provider and acquisition costs before interpreting ROI.',
    },
    value: values.rows,
  };
}
