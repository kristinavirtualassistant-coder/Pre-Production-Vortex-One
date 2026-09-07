import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const launcher = path.join(root, 'scripts', 'local-dev.sh');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

if (!fs.existsSync(launcher)) throw new Error('Expected scripts/local-dev.sh to exist');
const source = fs.readFileSync(launcher, 'utf8');

if (!source.includes('VORTEX_LOCAL_DEV_AUTH=true')) throw new Error('Local launcher must enable explicit local auth');
if (!source.includes('VORTEX_LOCAL_PGPORT:-5433')) throw new Error('Local launcher must default to the isolated PostgreSQL port 5433');
if (!source.includes('npm run dev')) throw new Error('Local launcher must start the Vortex One dev server');
if (packageJson.scripts['dev:local'] !== './scripts/local-dev.sh') throw new Error('package.json must expose npm run dev:local');
if (!source.includes('pg_ctl')) throw new Error('Local launcher must manage the isolated PostgreSQL cluster');
console.log('local development launcher checks passed');
