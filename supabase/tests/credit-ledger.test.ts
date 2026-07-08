/**
 * @jest-environment node
 */
// Phase A 크레딧 원장 통합 테스트 — 실제 Supabase 클라우드 프로젝트에 대해 돈다(로컬 mock 아님).
// .env(EXPO_PUBLIC_SUPABASE_URL/PUBLISHABLE_KEY, SUPABASE_SECRET_KEY)가 없는 환경(CI 등)에서는
// 통째로 skip — 이 레포는 클라우드 프로젝트 직접 사용 방식을 택했다(로컬 Docker 미사용).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const hasCredentials = Boolean(URL && PUBLISHABLE_KEY && SECRET_KEY);

if (!hasCredentials) {
  console.warn('[credit-ledger.test] .env에 Supabase 자격증명이 없어 통합 테스트를 skip한다.');
}

const describeIfConfigured = hasCredentials ? describe : describe.skip;

let admin: SupabaseClient;

async function createAnonUser(): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createClient(URL!, PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.session) throw error ?? new Error('anon sign-in 실패');
  return { client, userId: data.session.user.id };
}

// auth.users 삭제 → public.users/credits/credit_events/analyses는 FK cascade로 함께 정리된다.
// 실패해도 테스트 판정에 영향 주지 않게 warn만 하고 삼킨다(테스트 프로젝트에 유저 하나
// 남는 정도는 무해 — 판정 자체를 흐리는 게 더 나쁘다).
async function deleteTestUser(userId: string | undefined) {
  if (!userId) return;
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) console.warn(`[credit-ledger.test] 테스트 유저 정리 실패(${userId}):`, error.message);
}

async function getBalance(userId: string): Promise<number> {
  const { data, error } = await admin.from('credits').select('balance').eq('user_id', userId).single();
  if (error) throw error;
  return data!.balance as number;
}

// KST(UTC+9, DST 없음)는 고정 오프셋 — DB의 week_start_kst()와 별개로 "이번 주 월요일
// 00:00 KST"를 JS에서 독립 계산해야 UTC로 새는 버그를 잡아낼 수 있다(자기 참조 검증 방지).
function mondayKstBoundaryUtc(now: Date): Date {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay(); // 0=Sun..6=Sat — kst가 이미 +9h shift된 시각이라 UTC getter로 읽어도 KST 벽시계 값
  const diffToMonday = day === 0 ? 6 : day - 1;
  const kstMidnightFields = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - diffToMonday, 0, 0, 0, 0);
  return new Date(kstMidnightFields - 9 * 60 * 60 * 1000);
}

describeIfConfigured('Phase A 크레딧 원장 — 실 Supabase 프로젝트 통합 테스트', () => {
  beforeAll(() => {
    admin = createClient(URL!, SECRET_KEY!, { auth: { persistSession: false } });
  });

  describe('해피 패스', () => {
    let userId: string | undefined;
    afterAll(() => deleteTestUser(userId));

    it('purchase(+1) → balance 1 → analysis(-1) → balance 0', async () => {
      ({ userId } = await createAnonUser());

      const purchase = await admin
        .from('credit_events')
        .insert({ user_id: userId, delta: 1, reason: 'purchase', external_id: `happy-path-${userId}` });
      expect(purchase.error).toBeNull();
      expect(await getBalance(userId)).toBe(1);

      const analysis = await admin.from('credit_events').insert({ user_id: userId, delta: -1, reason: 'analysis' });
      expect(analysis.error).toBeNull();
      expect(await getBalance(userId)).toBe(0);
    });
  });

  describe('초과 소비 차단', () => {
    let userId: string | undefined;
    afterAll(() => deleteTestUser(userId));

    it('balance 0에서 analysis(-1) insert가 거부되고 balance/행 모두 그대로', async () => {
      ({ userId } = await createAnonUser());
      expect(await getBalance(userId)).toBe(0);

      const { error } = await admin.from('credit_events').insert({ user_id: userId, delta: -1, reason: 'analysis' });
      expect(error).not.toBeNull(); // balance check(>= 0) 위반 — 존재 이유인 실패

      expect(await getBalance(userId)).toBe(0);
      const { count } = await admin
        .from('credit_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      expect(count).toBe(0); // 트리거 실패 시 credit_events insert 자체도 롤백
    });
  });

  describe('중복 적립 방지', () => {
    let userId: string | undefined;
    afterAll(() => deleteTestUser(userId));

    it('같은 external_id로 두 번째 purchase insert는 unique 제약으로 거부', async () => {
      ({ userId } = await createAnonUser());
      const externalId = `dup-${userId}`;

      const first = await admin
        .from('credit_events')
        .insert({ user_id: userId, delta: 1, reason: 'purchase', external_id: externalId });
      expect(first.error).toBeNull();
      expect(await getBalance(userId)).toBe(1);

      const second = await admin
        .from('credit_events')
        .insert({ user_id: userId, delta: 1, reason: 'purchase', external_id: externalId });
      expect(second.error).not.toBeNull(); // unique(external_id) 위반 — RevenueCat webhook 재전송 대비

      expect(await getBalance(userId)).toBe(1); // 두 번째 적립 미반영
    });
  });

  describe('주간 무료 판정 — KST 경계', () => {
    let userId: string | undefined;
    afterAll(() => deleteTestUser(userId));

    it('월요일 00:00 KST 경계 전/후로 has_weekly_free()가 뒤집힌다', async () => {
      ({ userId } = await createAnonUser());
      const boundary = mondayKstBoundaryUtc(new Date());

      // 경계 1분 전(지난주 일요일 23:59 KST) — 이번 주 무료 판정엔 영향 없어야 한다.
      const before = new Date(boundary.getTime() - 60_000);
      const beforeInsert = await admin
        .from('credit_events')
        .insert({ user_id: userId, delta: 0, reason: 'weekly_free', created_at: before.toISOString() });
      expect(beforeInsert.error).toBeNull();

      const stillFree = await admin.rpc('has_weekly_free', { p_user_id: userId });
      expect(stillFree.error).toBeNull();
      expect(stillFree.data).toBe(true); // 지난주 이벤트는 이번 주 무료를 소진시키지 않는다

      // 경계 1분 후(이번 주 월요일 00:01 KST) — 이번 주 무료 소진으로 잡혀야 한다.
      const after = new Date(boundary.getTime() + 60_000);
      const afterInsert = await admin
        .from('credit_events')
        .insert({ user_id: userId, delta: 0, reason: 'weekly_free', created_at: after.toISOString() });
      expect(afterInsert.error).toBeNull();

      const usedFree = await admin.rpc('has_weekly_free', { p_user_id: userId });
      expect(usedFree.error).toBeNull();
      expect(usedFree.data).toBe(false); // UTC로 새면 이 경계가 9시간 어긋나 여기서 틀어진다
    });
  });

  describe('RLS 음성 케이스', () => {
    let userId: string | undefined;
    afterAll(() => deleteTestUser(userId));

    it('anon 세션으로 credit_events 직접 insert는 거부된다', async () => {
      const created = await createAnonUser();
      userId = created.userId;

      const { error } = await created.client
        .from('credit_events')
        .insert({ user_id: userId, delta: 999, reason: 'purchase', external_id: `attack-${userId}` });
      expect(error).not.toBeNull(); // insert 정책이 없어 RLS가 막아야 한다 — 클라이언트 직접 적립 공격 차단

      expect(await getBalance(userId)).toBe(0);
    });
  });
});
