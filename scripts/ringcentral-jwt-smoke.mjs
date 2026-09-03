import { SDK } from '@ringcentral/sdk';

const required = ['RINGCENTRAL_CLIENT_ID','RINGCENTRAL_CLIENT_SECRET','RINGCENTRAL_JWT'];
for (const key of required) {
  if (!process.env[key]?.trim()) throw new Error(`Missing required environment variable: ${key}`);
}

const sdk = new SDK({
  server: process.env.RINGCENTRAL_SERVER_URL || SDK.server.production,
  clientId: process.env.RINGCENTRAL_CLIENT_ID,
  clientSecret: process.env.RINGCENTRAL_CLIENT_SECRET,
});

const platform = sdk.platform();
await platform.login({ jwt: process.env.RINGCENTRAL_JWT });
const response = await platform.get('/restapi/v1.0/account/~/extension/~');
if (response.status < 200 || response.status >= 300) throw new Error(`RingCentral API request failed: HTTP ${response.status}`);
const account = await response.json();
console.log('RINGCENTRAL JWT AUTH: SUCCESS');
console.log(`HTTP: ${response.status}`);
console.log(`Extension ID: ${account.id}`);
console.log(`Extension: ${[account.name?.firstName, account.name?.lastName].filter(Boolean).join(' ') || '(name not returned)'}`);
