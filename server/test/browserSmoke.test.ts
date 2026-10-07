import { spawn, type ChildProcess } from 'node:child_process';
import process from 'node:process';
import puppeteer from 'puppeteer';

const port = Number(process.env.E2E_PORT || 4173);
const baseUrl = `http://127.0.0.1:${port}`;
let server: ChildProcess | undefined;

async function waitFor(url: string, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

async function main() {
  server = spawn('npm', ['run', 'dev'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
    },
    stdio: 'inherit',
  });

  server.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`Vortex One dev server exited with code ${code}`);
    }
  });

  try {
    await waitFor(`${baseUrl}/api/health`);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 30_000 });

      const title = await page.title();
      if (!title.includes('Vortex One')) {
        throw new Error(`Unexpected page title: ${title}`);
      }

      const rootExists = await page.$('#root') !== null;
      if (!rootExists) {
        throw new Error('React application root element was not rendered');
      }

      const healthResponse = await page.goto(`${baseUrl}/api/ready`, {
        waitUntil: 'networkidle0',
        timeout: 30_000,
      });
      if (!healthResponse || healthResponse.status() !== 200) {
        throw new Error(`Health endpoint returned ${healthResponse?.status() ?? 'no response'}`);
      }

      const health = await page.evaluate(() => JSON.parse(document.body.innerText));
      if (health.status !== 'ready' || health.database !== 'postgresql') {
        throw new Error(`Unexpected readiness payload: ${JSON.stringify(health)}`);
      }

      console.log('E2E smoke: PASS — browser, SPA, and PostgreSQL readiness verified.');
    } finally {
      await browser.close();
    }
  } finally {
    server?.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error('E2E smoke failed:', error);
  server?.kill('SIGTERM');
  process.exitCode = 1;
});
