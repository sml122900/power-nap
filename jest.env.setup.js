// 통합 테스트(supabase/*.test.ts)가 .env의 Supabase 자격증명을 읽을 수 있게 한다.
// `jest` CLI는 expo CLI와 달리 .env를 자동으로 안 읽어서 별도 setupFiles로 주입한다.
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    if (!(key in process.env)) process.env[key] = trimmed.slice(eq + 1);
  }
}
