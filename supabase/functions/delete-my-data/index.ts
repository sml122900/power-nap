// 개인정보처리방침 "서버 데이터 삭제" 대응 Edge Function. AI_ANALYSIS.md §6 참고.
// auth.users 행을 삭제하면 public.users/credits/credit_events/analyses가 전부 FK
// on delete cascade로 함께 정리된다(migrations/0001_ai_analysis_init.sql의 스키마 —
// public.users.id가 auth.users(id)를 on delete cascade로 참조하고, credits/
// credit_events/analyses가 다시 public.users(id)를 on delete cascade로 참조).
// credit-ledger.test.ts/analyze.test.ts의 테스트 유저 정리(deleteTestUser)가 이미
// 같은 전제로 동작 중인 검증된 메커니즘 — 새로 만든 가정이 아니다. 그래서 이 함수는
// public 스키마 4테이블을 개별적으로 지우지 않는다: auth.users 삭제 한 번이 전부를
// 원자적으로(단일 Postgres 트랜잭션 내 cascade) 처리한다.
//
// 익명 auth 계정 자체를 지우는 이유(설계 시 별도로 판단한 지점): 이 앱은 이메일/비번
// 없는 순수 익명 계정이라 auth.users 행에는 재로그인에 쓸 자격증명이 전혀 없다 —
// 데이터만 지우고 신원을 남겨봐야 "빈 신원"으로 방치될 뿐 어떤 재사용 가치도 없고,
// 우발적으로 같은 uid에 새 데이터가 쌓일 경로도 계속 열려 있어야 하는 것도 아니다.
// 세션이 무효화돼 다음 사용 시 새 익명 계정이 자동 발급되는 것은 이 앱이 이미 받아들인
// 트레이드오프(AI_ANALYSIS.md §8, 기기 분실 시 크레딧 소실)와 같은 성격이라 부자연스럽지
// 않다고 판단했다.
//
// 재시도 안전성: auth.users를 지우면 그 유저의 JWT는 이후 admin.auth.getUser(jwt)에서
// "user not found"로 거부된다 — 즉 삭제 성공 후 같은 요청을 재시도하면 authenticate()
// 단계에서 자연스럽게 401이 난다. 별도의 idempotency 처리가 필요 없다.
import { createClient } from 'npm:@supabase/supabase-js@^2.110.1';

// 플랫폼이 자동 주입하는 이름이 신형 키 체계 롤아웃 단계에 따라 다르다 — analyze/index.ts와
// 동일한 이유로 셋 다 시도한다(함수당 배포 단위가 독립적이라 공유 모듈 없이 각자 보유).
function resolveSupabaseSecretKey(): string {
  const single = Deno.env.get('SUPABASE_SECRET_KEY');
  if (single) return single;

  const keyed = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keyed) {
    const parsed = JSON.parse(keyed) as Record<string, string>;
    const value = parsed.default ?? Object.values(parsed)[0];
    if (value) return value;
  }

  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;

  throw new Error('SUPABASE_SECRET_KEY(S)를 찾을 수 없다 — 플랫폼 자동 주입 확인 필요');
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseSecretKey = resolveSupabaseSecretKey();
const admin = createClient(supabaseUrl, supabaseSecretKey);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function authenticate(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!jwt) return jsonResponse(401, { error: 'unauthenticated', message: 'No auth token provided.' });

  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) {
    return jsonResponse(401, { error: 'unauthenticated', message: 'Invalid session.' });
  }
  return { userId: data.user.id };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' });

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;

  const { error } = await admin.auth.admin.deleteUser(auth.userId);
  if (error) {
    return jsonResponse(500, { error: 'server_error', message: error.message });
  }

  return jsonResponse(200, { deleted: true });
});
