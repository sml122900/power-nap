/**
 * @jest-environment node
 */
// Phase B `analyze` Edge Function 통합 테스트 — 배포된 실제 함수를 HTTPS로 호출한다.
// 매 실행마다 진짜 Claude API 호출 2회(분석 1회 + 후속질문 1회)가 발생해 소액 비용이
// 든다(sonnet-5, max_tokens 캡 있음) — 리포트 텍스트 자체는 매번 달라지므로 값이 아니라
// 스키마/상태코드만 검증한다.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const hasCredentials = Boolean(URL && PUBLISHABLE_KEY && SECRET_KEY);

if (!hasCredentials) {
  console.warn('[analyze.test] .env에 Supabase 자격증명이 없어 통합 테스트를 skip한다.');
}

const describeIfConfigured = hasCredentials ? describe : describe.skip;
const functionUrl = `${URL}/functions/v1/analyze`;

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
  if (error) console.warn(`[analyze.test] 테스트 유저 정리 실패(${userId}):`, error.message);
}

function callAnalyze(jwt: string | null, body: unknown) {
  return fetch(functionUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: PUBLISHABLE_KEY!,
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function napRecords(count: number) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    completedAt: now - i * 24 * 60 * 60 * 1000,
    mode: i % 2 === 0 ? 'fast' : 'slow',
    offsetMinutes: 20 + (i % 3) * 5,
    survey: { posture: 'mid', noise: 'mid', light: 'mid', satisfaction: 'mid' },
  }));
}

const SETTINGS = { latency: { fast: 0, slow: 10 }, caffeineOnset: 25 };

describeIfConfigured('Phase B analyze Edge Function — 실 배포 통합 테스트', () => {
  beforeAll(() => {
    admin = createClient(URL!, SECRET_KEY!, { auth: { persistSession: false } });
  });

  it('인증 헤더 없이 호출하면 401', async () => {
    const res = await callAnalyze(null, { records: napRecords(5), settings: SETTINGS });
    expect(res.status).toBe(401);
  });

  it('낮잠 기록이 5개 미만이면 422', async () => {
    const { jwt, userId } = await createAnonUser();
    try {
      const res = await callAnalyze(jwt, { records: napRecords(3), settings: SETTINGS });
      expect(res.status).toBe(422);
    } finally {
      await deleteTestUser(userId);
    }
  });

  it('정상 요청 → 200, 스키마에 맞는 리포트 + 후속질문 + 같은 주 재요청은 402', async () => {
    const { jwt, userId } = await createAnonUser();
    try {
      const first = await callAnalyze(jwt, { records: napRecords(6), settings: SETTINGS });
      expect(first.status).toBe(200);
      const firstBody = await first.json();

      expect(typeof firstBody.analysisId).toBe('number');
      expect(firstBody.chargeReason).toBe('weekly_free');
      expect(typeof firstBody.report.summary).toBe('string');
      expect(Array.isArray(firstBody.report.advice)).toBe(true);
      expect(firstBody.report.advice.length).toBeGreaterThan(0);
      expect(['high', 'low']).toContain(firstBody.report.confidence);
      expect(firstBody.turnsRemaining).toBe(3);
      expect(firstBody.recordsUsed).toBe(6);

      const followup = await callAnalyze(jwt, {
        analysisId: firstBody.analysisId,
        question: '설정을 어떻게 바꾸는 게 좋을까요?',
      });
      expect(followup.status).toBe(200);
      const followupBody = await followup.json();
      expect(typeof followupBody.answer).toBe('string');
      expect(followupBody.answer.length).toBeGreaterThan(0);
      expect(followupBody.turnsUsed).toBe(1);
      expect(followupBody.turnsRemaining).toBe(2);

      const second = await callAnalyze(jwt, { records: napRecords(6), settings: SETTINGS });
      expect(second.status).toBe(402); // 이번 주 무료 이미 소진, 잔액 0
    } finally {
      await deleteTestUser(userId);
    }
  }, 60_000);

  it('60개를 보내도 서버가 최신순 50개로 컷한다(토큰 비용 방어선)', async () => {
    const { jwt, userId } = await createAnonUser();
    try {
      const res = await callAnalyze(jwt, { records: napRecords(60), settings: SETTINGS });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.recordsUsed).toBe(50);
    } finally {
      await deleteTestUser(userId);
    }
  }, 60_000);
});
