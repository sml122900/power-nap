/**
 * @jest-environment node
 */
// revenuecat-webhook Edge Function 통합 테스트 — 배포된 실제 함수를 HTTPS로 호출한다
// (analyze.test.ts/delete-my-data.test.ts와 동일한 패턴). RevenueCat 실제 이벤트가 아니라
// 같은 모양의 합성 페이로드로 검증한다 — Play Console/RevenueCat 프로젝트가 없어도 웹훅
// 로직 자체(인증/중복 방지/환불 거부)는 검증 가능하다.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET;
const hasCredentials = Boolean(URL && PUBLISHABLE_KEY && SECRET_KEY && WEBHOOK_SECRET);

if (!hasCredentials) {
  console.warn('[revenuecat-webhook.test] .env에 자격증명이 없어 통합 테스트를 skip한다.');
}

const describeIfConfigured = hasCredentials ? describe : describe.skip;
const functionUrl = `${URL}/functions/v1/revenuecat-webhook`;
const PRODUCT_ID = 'powernap_extra_analysis_1000';

let admin: SupabaseClient;
let txnCounter = 0;

function nextTransactionId(label: string): string {
  txnCounter += 1;
  return `test-${label}-${txnCounter}`;
}

// 익명 auth로 유저를 만든다(analyze.test.ts/delete-my-data.test.ts와 동일 패턴) —
// on_auth_user_created 트리거가 public.users/credits 행을 자동으로 만들어준다.
async function createUser(): Promise<string> {
  const client = createClient(URL!, PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.session) throw error ?? new Error('anon sign-in 실패');
  return data.session.user.id;
}

async function deleteTestUser(userId: string | undefined) {
  if (!userId) return;
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) console.warn(`[revenuecat-webhook.test] 테스트 유저 정리 실패(${userId}):`, error.message);
}

function callWebhook(authHeader: string | null, body: unknown) {
  return fetch(functionUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function getBalance(userId: string): Promise<number> {
  const { data } = await admin.from('credits').select('balance').eq('user_id', userId).maybeSingle();
  return data?.balance ?? 0;
}

function purchaseEvent(transactionId: string, appUserId: string, productId = PRODUCT_ID, type = 'INITIAL_PURCHASE') {
  return { event: { transaction_id: transactionId, type, app_user_id: appUserId, product_id: productId } };
}

function refundEvent(transactionId: string, appUserId: string, type = 'REFUND') {
  return { event: { transaction_id: transactionId, type, app_user_id: appUserId, product_id: PRODUCT_ID } };
}

describeIfConfigured('revenuecat-webhook Edge Function — 실 배포 통합 테스트', () => {
  beforeAll(() => {
    admin = createClient(URL!, SECRET_KEY!, { auth: { persistSession: false } });
  });

  it('Authorization 헤더 없이 호출하면 401', async () => {
    const res = await callWebhook(null, purchaseEvent(nextTransactionId('noauth'), 'irrelevant'));
    expect(res.status).toBe(401);
  });

  it('잘못된 Authorization 값이면 401', async () => {
    const res = await callWebhook('Bearer wrong-secret', purchaseEvent(nextTransactionId('badauth'), 'irrelevant'));
    expect(res.status).toBe(401);
  });

  it('구매 이벤트(INITIAL_PURCHASE) → 크레딧 +1, 같은 이벤트 재전송은 중복 무시되고 잔액도 그대로', async () => {
    const userId = await createUser();
    try {
      const event = purchaseEvent(nextTransactionId('purchase'), userId);
      const first = await callWebhook(`Bearer ${WEBHOOK_SECRET}`, event);
      expect(first.status).toBe(200);
      expect((await first.json()).status).toBe('credited');
      expect(await getBalance(userId)).toBe(1);

      const second = await callWebhook(`Bearer ${WEBHOOK_SECRET}`, event); // 같은 transaction_id 재전송
      expect(second.status).toBe(200);
      expect((await second.json()).status).toBe('duplicate_ignored');
      expect(await getBalance(userId)).toBe(1); // 중복 적립 안 됨
    } finally {
      await deleteTestUser(userId);
    }
  }, 30_000);

  it('구매 이벤트인데 상품 ID가 다르면 무시되고 잔액에 영향 없음', async () => {
    const userId = await createUser();
    try {
      const res = await callWebhook(
        `Bearer ${WEBHOOK_SECRET}`,
        purchaseEvent(nextTransactionId('wrong-product'), userId, 'some_other_product'),
      );
      expect(res.status).toBe(200);
      expect((await res.json()).status).toBe('ignored_unknown_product');
      expect(await getBalance(userId)).toBe(0);
    } finally {
      await deleteTestUser(userId);
    }
  }, 30_000);

  it('환불 이벤트(REFUND) → 잔액이 있으면 -1', async () => {
    const userId = await createUser();
    try {
      await callWebhook(`Bearer ${WEBHOOK_SECRET}`, purchaseEvent(nextTransactionId('refund-purchase'), userId));
      expect(await getBalance(userId)).toBe(1);

      const res = await callWebhook(`Bearer ${WEBHOOK_SECRET}`, refundEvent(nextTransactionId('refund'), userId));
      expect(res.status).toBe(200);
      expect((await res.json()).status).toBe('refunded');
      expect(await getBalance(userId)).toBe(0);
    } finally {
      await deleteTestUser(userId);
    }
  }, 30_000);

  it('같은 transaction_id로 구매 후 그 거래의 환불이 와도(현실적인 생애주기) 둘 다 정상 반영된다', async () => {
    // reason별로 external_id 네임스페이스를 나눠뒀는지 확인하는 회귀 테스트 —
    // 안 나눴다면 환불 insert가 구매 insert와 유니크 충돌해 "중복 무시"로 잘못 처리된다.
    const userId = await createUser();
    try {
      const sharedTxnId = nextTransactionId('shared');
      const purchaseRes = await callWebhook(`Bearer ${WEBHOOK_SECRET}`, purchaseEvent(sharedTxnId, userId));
      expect((await purchaseRes.json()).status).toBe('credited');
      expect(await getBalance(userId)).toBe(1);

      const refundRes = await callWebhook(`Bearer ${WEBHOOK_SECRET}`, refundEvent(sharedTxnId, userId));
      expect((await refundRes.json()).status).toBe('refunded');
      expect(await getBalance(userId)).toBe(0);
    } finally {
      await deleteTestUser(userId);
    }
  }, 30_000);

  it('이미 소진해 잔액이 0인 상태의 환불(CANCELLATION)은 거부되고 잔액은 0에서 안 깎인다', async () => {
    const userId = await createUser();
    try {
      // 잔액 0인 상태에서 곧바로 환불 이벤트 — check(balance >= 0) 제약에 걸려 거부돼야 한다.
      const res = await callWebhook(
        `Bearer ${WEBHOOK_SECRET}`,
        refundEvent(nextTransactionId('reject'), userId, 'CANCELLATION'),
      );
      expect(res.status).toBe(200);
      expect((await res.json()).status).toBe('refund_rejected_insufficient_balance');
      expect(await getBalance(userId)).toBe(0);
    } finally {
      await deleteTestUser(userId);
    }
  }, 30_000);

  it('존재하지 않는 app_user_id는 202로 ack하고 크레딧을 만들지 않는다(재시도 유도 안 함)', async () => {
    const fakeUserId = '00000000-0000-0000-0000-000000000000';
    const res = await callWebhook(`Bearer ${WEBHOOK_SECRET}`, purchaseEvent(nextTransactionId('unknown-user'), fakeUserId));
    expect(res.status).toBe(202);
    expect((await res.json()).status).toBe('unknown_user_ignored');
  }, 30_000);

  it('구독/무관 이벤트 타입은 무시되고 잔액에 영향 없음', async () => {
    const userId = await createUser();
    try {
      const res = await callWebhook(`Bearer ${WEBHOOK_SECRET}`, {
        event: { transaction_id: nextTransactionId('ignored'), type: 'BILLING_ISSUE', app_user_id: userId },
      });
      expect(res.status).toBe(200);
      expect((await res.json()).status).toBe('ignored');
      expect(await getBalance(userId)).toBe(0);
    } finally {
      await deleteTestUser(userId);
    }
  }, 30_000);
});
