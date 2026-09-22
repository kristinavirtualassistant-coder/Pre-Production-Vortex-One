import net from 'node:net';
import tls from 'node:tls';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  from?: string;
}

export interface EmailSendResult {
  messageId: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Email provider is not configured: missing ${name}`);
  return value;
}

function parseAddress(value: string): { host: string; port: number; secure: boolean } {
  const host = value.trim();
  const port = Number(process.env.SMTP_PORT || (host === 'localhost' ? 25 : 587));
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) throw new Error('Invalid SMTP configuration');
  return { host, port, secure };
}

function encodeHeader(value: string): string { return value.replace(/[\r\n]/g, ' ').trim(); }

function dotStuff(value: string): string {
  return value.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
}

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  if (!/^\\S+@\\S+\\.\\S+$/.test(message.to)) throw new Error('Invalid recipient email');
  const from = message.from?.trim() || required('SMTP_FROM');
  const smtp = parseAddress(required('SMTP_HOST'));
  const username = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const socket = await connect(smtp.host, smtp.port, smtp.secure);
  const client = new SmtpClient(socket);
  await client.expect(220);
  await client.command('EHLO vortex-one');
  if (username && password) {
    await client.command('AUTH LOGIN');
    await client.expect(334);
    await client.command(Buffer.from(username).toString('base64'));
    await client.expect(334);
    await client.command(Buffer.from(password).toString('base64'));
    await client.expect(235);
  }
  await client.command(`MAIL FROM:<${encodeHeader(from)}>`);
  await client.expect(250);
  await client.command(`RCPT TO:<${encodeHeader(message.to)}>`);
  await client.expect(250);
  await client.command('DATA');
  await client.expect(354);
  const body = [
    `From: ${encodeHeader(from)}`,
    `To: ${encodeHeader(message.to)}`,
    `Subject: ${encodeHeader(message.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    message.text,
    '',
    '.',
  ].join('\r\n');
  await client.raw(`${dotStuff(body)}\r\n`);
  const response = await client.readResponse();
  if (response.code !== 250) throw new Error(`SMTP DATA rejected: ${response.text}`);
  await client.command('QUIT').catch(() => undefined);
  socket.destroy();
  const messageId = `smtp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return { messageId };
}

function connect(host: string, port: number, secure: boolean): Promise<net.Socket | tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = secure ? tls.connect({ host, port, servername: host }) : net.createConnection({ host, port });
    const onError = (error: Error) => { socket.destroy(); reject(error); };
    socket.once('error', onError);
    socket.once('connect', () => { socket.removeListener('error', onError); resolve(socket); });
    if (secure) (socket as tls.TLSSocket).once('secureConnect', () => { socket.removeListener('error', onError); resolve(socket); });
  });
}

class SmtpClient {
  private buffer = '';
  private pending: Array<(value: string) => void> = [];
  private error: Error | null = null;
  constructor(private readonly socket: net.Socket | tls.TLSSocket) {
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => { this.buffer += chunk; this.flush(); });
    socket.on('error', (error) => { this.error = error; for (const resolve of this.pending.splice(0)) resolve(''); });
  }
  private flush(): void { while (this.pending.length && (this.buffer.includes('\\n') || this.error)) this.pending.shift()!(this.buffer); }
  private readLine(): Promise<string> {
    if (this.error) return Promise.reject(this.error);
    const idx = this.buffer.indexOf('\\n');
    if (idx >= 0) { const line = this.buffer.slice(0, idx + 1); this.buffer = this.buffer.slice(idx + 1); return Promise.resolve(line); }
    return new Promise((resolve) => this.pending.push(resolve));
  }
  async readResponse(): Promise<{ code: number; text: string }> {
    const line = await this.readLine();
    const code = Number(line.slice(0, 3));
    const text = line.slice(4).trim();
    if (!Number.isFinite(code)) throw new Error(`Invalid SMTP response: ${line}`);
    return { code, text };
  }
  async expect(expected: number): Promise<void> {
    const response = await this.readResponse();
    if (response.code !== expected) throw new Error(`SMTP error ${response.code}: ${response.text}`);
  }
  async command(command: string): Promise<void> { this.socket.write(`${command}\r\n`); }
  async raw(data: string): Promise<void> { this.socket.write(data); }
}
