import { execSync } from 'node:child_process';
const out = execSync('git grep -n -I -e "eyJhbGci" -e "TURSO_AUTH_TOKEN=." -- . ":!tools/check-secrets.mjs" ":!TURBO_RALLY_DEV_SPEC.md" || true').toString();
if (out.trim()) { console.error('Possible secret committed:\n' + out); process.exit(1); }
console.log('no secrets found');
