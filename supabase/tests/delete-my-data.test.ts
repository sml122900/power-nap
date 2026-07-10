/**
 * @jest-environment node
 */
// delete-my-data Edge Function 통합 테스트 — 배포된 실제 함수를 HTTPS로 호출한다
// (analyze.test.ts와 동일한 패턴). Claude 호출이 없어 비용은 안 든다.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const hasCredentials = Boolean(URL && PUBLISHABLE_KEY && SECRET_KEY);

if (!hasCredentials) {
  console.warn('[delete-my-data.test] .env에 Supabase 자격증명이 없어 통합 테스트를 skip한다.');
}

const describeIfConfigured = hasCredentials ? describe : describe.skip;
const functionUrl = `${URL}/functions/v1/delete-my-data`;

let admin: SupabaseClient;

async function createAnonUser(): Promise<{ jwt: string; userId: string }> {
  const client = createClient(URL!, PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.session) throw error ?? new Error('anon sign-in 실패');
  return { jwt: data.session.access_token, userId: data.session.user.id };
}

async function deleteTestUser(userId: string | undefined) {
  if (!userId) return;
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) console.warn(`[delete-my-data.test] 테스트 유저 정리 실패(${userId}):`, error.message);
}

function callDelete(jwt: string | null) {
  return fetch(functionUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: PUBLISHABLE_KEY!,
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: '{}',
  });
}

async function countRows(table: string, userId: string): Promise<number> {
  const { count } = await admin.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
  return count ?? 0;
}

describeIfConfigured('delete-my-data Edge Function — 실 배포 통합 테스트', () => {
  beforeAll(() => {
    admin = createClient(URL!, SECRET_KEY!, { auth: { persistSession: false } });
  });

  it('인증 헤더 없이 호출하면 401', async () => {
    const res = await callDelete(null);
    expect(res.status).toBe(401);
  });

  it('삭제 성공 후: analyses/credit_events/credits/users/auth 유저가 전부 사라진다', async () => {
    const { jwt, userId } = await createAnonUser();

    const creditEvent = await admin
      .from('credit_events')
      .insert({ user_id: userId, delta: 1, reason: 'purchase', external_id: `delete-test-${userId}` });
    expect(creditEvent.error).toBeNull();

    // analyses는 RLS상 insert 정책이 없어 service_role(admin)만 직접 넣을 수 있다 —
    // 여기서는 Claude를 호출하지 않고 형태만 갖춘 더미 행으로 삭제 대상을 만든다.
    const analysisInsert = await admin
      .from('analyses')
      .insert({ user_id: userId, records_snapshot: [], report: { summary: 'test' } });
    expect(analysisInsert.error).toBeNull();

    const res = await callDelete(jwt);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);

    expect(await countRows('analyses', userId)).toBe(0);
    expect(await countRows('credit_events', userId)).toBe(0);

    const { data: creditsRow } = await admin.from('credits').select('user_id').eq('user_id', userId).maybeSingle();
    expect(creditsRow).toBeNull();

    const { data: usersRow } = await admin.from('users').select('id').eq('id', userId).maybeSingle();
    expect(usersRow).toBeNull();

    // getUserById는 존재하지 않는 유저에 대해 구현/버전에 따라 data.user=null 또는
    // error를 돌려줄 수 있어 둘 중 하나만 확인한다(둘 다 "유저가 없다"는 같은 의미).
    const { data: authData, error: authError } = await admin.auth.admin.getUserById(userId);
    expect(authError !== null || !authData?.user).toBe(true);
  }, 30_000);

  it('삭제해도 다른 유저의 데이터는 그대로 남는다(격리 확인)', async () => {
    const userA = await createAnonUser();
    const userB = await createAnonUser();
    try {
      const insertB = await admin
        .from('credit_events')
        .insert({ user_id: userB.userId, delta: 1, reason: 'purchase', external_id: `isolation-${userB.userId}` });
      expect(insertB.error).toBeNull();

      const res = await callDelete(userA.jwt);
      expect(res.status).toBe(200);

      expect(await countRows('credit_events', userB.userId)).toBe(1); // A 삭제가 B에 영향 없음
    } finally {
      await deleteTestUser(userB.userId); // userA는 이미 삭제됐으니 별도 정리 불필요
    }
  }, 30_000);

  it('삭제된 유저의 JWT로 재호출하면 401 — 별도 idempotency 처리 없이도 안전한 재시도', async () => {
    const { jwt } = await createAnonUser();
    const first = await callDelete(jwt);
    expect(first.status).toBe(200);

    const second = await callDelete(jwt);
    expect(second.status).toBe(401);
  }, 30_000);
});
