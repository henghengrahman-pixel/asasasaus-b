import { spawnSync } from 'node:child_process';

const INITIAL_MIGRATION = '202609220001_init';

function run(args, { capture = false } = {}) {
  const result = spawnSync('npx', ['prisma', ...args], {
    env: process.env,
    encoding: 'utf8',
    stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
  });
  if (capture) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  return result;
}

if (!process.env.DATABASE_URL) {
  console.error('Missing required runtime environment variable: DATABASE_URL');
  process.exit(1);
}

console.log('[migration] Running prisma migrate deploy...');
let deploy = run(['migrate', 'deploy'], { capture: true });
if (deploy.status === 0) process.exit(0);

const output = `${deploy.stdout ?? ''}\n${deploy.stderr ?? ''}`;
if (!output.includes('P3005') && !output.includes('database schema is not empty')) {
  console.error('[migration] migrate deploy failed for a reason other than P3005; refusing automatic baseline.');
  process.exit(deploy.status ?? 1);
}

console.log(`[migration] Existing non-empty database detected with no Prisma migration history. Baseline ${INITIAL_MIGRATION} as already applied.`);
const baseline = run(['migrate', 'resolve', '--applied', INITIAL_MIGRATION]);
if (baseline.status !== 0) {
  console.error('[migration] Failed to baseline existing database. No reset/drop was attempted.');
  process.exit(baseline.status ?? 1);
}

console.log('[migration] Baseline recorded. Applying remaining forward migrations...');
deploy = run(['migrate', 'deploy']);
if (deploy.status !== 0) process.exit(deploy.status ?? 1);
console.log('[migration] Database migrations are up to date.');
