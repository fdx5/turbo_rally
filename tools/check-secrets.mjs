import { spawnSync } from 'node:child_process';
const result = spawnSync('git', ['grep', '-l', '-I', '-e', 'eyJhbGci', '-e', 'TURSO_AUTH_TOKEN=.', '--', '.', ':!tools/check-secrets.mjs', ':!TURBO_RALLY_DEV_SPEC.md'], { encoding: 'utf8' });
if (result.error || (result.status !== 0 && result.status !== 1)) {
  console.error('Secret scan failed:', result.error?.message ?? result.stderr);
  process.exit(1);
}
if (result.status === 0) { console.error('Possible secret in files:\n' + result.stdout); process.exit(1); }
console.log('no secrets found');
