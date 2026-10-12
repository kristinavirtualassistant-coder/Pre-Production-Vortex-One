/** Email pipeline against real PostgreSQL with a mock SMTP transport: persistence, retries, suppression, no duplicates. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeDatabase, getPgPool } from '../db/db';
import { sendEmail, setEmailTransport, type EmailTransport } from '../services/emailService';
import { processEmailJob } from '../services/emailWorker';
import { EMAIL_JOB_TYPE } from '../services/emailOutreachService';
import { enqueueJob } from '../services/jobService';

process.env.SMTP_FROM = 'sender@example.invalid';
const sent: any[] = [];
let behavior: 'ok' | 'reject' | 'timeout' = 'ok';
const transport: EmailTransport = {
  async sendMail(message) {
    if (behavior === 'reject') { const e: any = new Error('550 mailbox unavailable password=hunter2'); e.code = 'EENVELOPE'; throw e; }
    if (behavior === 'timeout') { const e: any = new Error('Connection timeout'); e.code = 'ETIMEDOUT'; throw e; }
    sent.push(message);
    return { messageId: `<mock-${sent.length}@example.invalid>` };
  },
};
setEmailTransport(transport);

// --- transport-level behaviour
assert.deepEqual(await sendEmail({ to: 'a@example.com', subject: 'Hi\r\nBcc: evil@example.com', text: 'x' }).then((r) => ({ id: r.messageId })), { id: '<mock-1@example.invalid>' });
assert.ok(!/[\r\n]/.test(sent[0].subject), 'CR/LF is stripped from header values (header injection)');
await assert.rejects(sendEmail({ to: 'not-an-email', subject: 's', text: 't' }), /Invalid recipient email/);
await assert.rejects(sendEmail({ to: 'a@b.c,evil@x.com', subject: 's', text: 't' }), /Invalid recipient email/, 'multiple recipients in one address are rejected');
behavior = 'reject';
await assert.rejects(sendEmail({ to: 'a@example.com', subject: 's', text: 't' }), (e: Error) => !/hunter2|password/.test(e.message) && /Email delivery failed/.test(e.message), 'provider error text (which may echo credentials) is not propagated');
behavior = 'ok';
sent.length = 0;
console.log('  ✓ email transport: header injection, recipient validation, error redaction');

// --- worker against PostgreSQL
await initializeDatabase();
const pool = getPgPool();
if (!pool) { console.log('  - PostgreSQL not configured; worker tests skipped'); process.exit(0); }
const run = randomUUID().slice(0, 8);
const orgA = `org_email_a_${run}`;
const orgB = `org_email_b_${run}`;
for (const id of [orgA, orgB]) await pool.query('INSERT INTO organizations (id,name,slug) VALUES ($1,$2,$3)', [id, id, id]);
await pool.query("INSERT INTO leads (id, organization_id) VALUES ($1,$2)", [`lead_${run}`, orgA]);

async function queueOutreach(org: string, to: string, key: string) {
  const id = `eo_${randomUUID().slice(0, 12)}`;
  await pool!.query(
    `INSERT INTO email_outreach (id, organization_id, lead_id, idempotency_key, recipient_email, subject, body) VALUES ($1,$2,$3,$4,$5,'Subject','Body')`,
    [id, org, `lead_${run}`, key, to],
  );
  await enqueueJob(pool!, org, EMAIL_JOB_TYPE, { outreachId: id });
  return id;
}
const status = async (id: string) => (await pool!.query('SELECT status, provider_message_id, attempts, provider_attempted_at, last_error FROM email_outreach WHERE id=$1', [id])).rows[0];

try {
  // success persists a provider id and sends exactly once
  const ok = await queueOutreach(orgA, 'lead@example.com', `k1-${run}`);
  assert.equal(await processEmailJob(pool, orgA, 'w1'), true);
  let row = await status(ok);
  assert.equal(row.status, 'sent');
  assert.match(row.provider_message_id, /mock-/);
  assert.equal(sent.length, 1);
  assert.equal(await processEmailJob(pool, orgA, 'w1'), false, 'the completed job is not claimed again');
  assert.equal(sent.length, 1);
  console.log('  ✓ success is persisted with the provider id and sent once');

  // tenant isolation: worker for org B never touches org A's rows
  const other = await queueOutreach(orgA, 'tenant@example.com', `k2-${run}`);
  assert.equal(await processEmailJob(pool, orgB, 'w2'), false, "another tenant's worker claims nothing");
  assert.equal((await status(other)).status, 'queued');
  assert.equal(await processEmailJob(pool, orgA, 'w1'), true);
  assert.equal((await status(other)).status, 'sent');
  console.log('  ✓ tenant preserved');

  // suppressed recipients are skipped at send time
  await pool.query("INSERT INTO communication_suppression (id, organization_id, channel, destination, reason) VALUES ($1,$2,'email',$3,'unsubscribed')", [`sup_${run}`, orgA, 'optout@example.com']);
  const before = sent.length;
  const sup = await queueOutreach(orgA, 'OptOut@example.com', `k3-${run}`);
  await processEmailJob(pool, orgA, 'w1');
  assert.equal((await status(sup)).status, 'suppressed');
  assert.equal(sent.length, before, 'no email was sent to a suppressed recipient');
  console.log('  ✓ suppressed recipient skipped');

  // definite provider failure: persisted, marker cleared, retry allowed, then succeeds without duplicates
  behavior = 'reject';
  const fail = await queueOutreach(orgA, 'retry@example.com', `k4-${run}`);
  await processEmailJob(pool, orgA, 'w1');
  row = await status(fail);
  assert.equal(row.status, 'queued', 'a failed attempt is queued for retry');
  assert.equal(row.provider_attempted_at, null);
  assert.match(row.last_error, /Email delivery failed/);
  assert.ok(!/hunter2/.test(row.last_error), 'credentials from the provider error are not stored');
  behavior = 'ok';
  await pool.query("UPDATE jobs SET available_at = CURRENT_TIMESTAMP WHERE organization_id=$1 AND status='queued'", [orgA]);
  const count = sent.length;
  await processEmailJob(pool, orgA, 'w1');
  assert.equal((await status(fail)).status, 'sent');
  assert.equal(sent.length, count + 1, 'exactly one successful send after the retry');
  console.log('  ✓ failure persisted, retried, no duplicate');

  // ambiguous outcome (timeout) and crash-after-marker both go to manual review and are NEVER re-sent
  behavior = 'timeout';
  const amb = await queueOutreach(orgA, 'timeout@example.com', `k5-${run}`);
  await processEmailJob(pool, orgA, 'w1');
  assert.equal((await status(amb)).status, 'manual_review');
  behavior = 'ok';
  const afterAmb = sent.length;
  await pool.query("UPDATE jobs SET available_at = CURRENT_TIMESTAMP WHERE organization_id=$1 AND status='queued'", [orgA]);
  await processEmailJob(pool, orgA, 'w1');
  assert.equal(sent.length, afterAmb, 'an ambiguous send is not repeated');

  const crashed = await queueOutreach(orgA, 'crash@example.com', `k6-${run}`);
  await pool.query("UPDATE email_outreach SET status='processing', provider_attempted_at=CURRENT_TIMESTAMP WHERE id=$1", [crashed]);
  await processEmailJob(pool, orgA, 'w1');
  assert.equal((await status(crashed)).status, 'manual_review');
  assert.equal(sent.length, afterAmb, 'crash after the pre-send marker never causes a second send');
  console.log('  ✓ ambiguous/crashed sends require manual review and are never duplicated');

  // credentials never reach logs
  assert.ok(!JSON.stringify(sent).includes('hunter2'));
  console.log('Email pipeline tests passed.');
} finally {
  await pool.query('DELETE FROM email_outreach WHERE organization_id = ANY($1)', [[orgA, orgB]]).catch(() => {});
  await pool.query('DELETE FROM jobs WHERE organization_id = ANY($1)', [[orgA, orgB]]).catch(() => {});
  await pool.query('DELETE FROM organizations WHERE id = ANY($1)', [[orgA, orgB]]).catch(() => {});
  setEmailTransport(null);
  await pool.end().catch(() => {});
}
