// RevenueCat 결제 webhook — 구매/환불 이벤트를 credit_events에 반영한다. AI_ANALYSIS.md §7
// Phase D. 크레딧 잔액 갱신 자체는 이 함수가 아니라 credit_events insert 트리거
// (apply_credit_event, migrations/0001_ai_analysis_init.sql)가 담당 — 여기서는
// delta/reason/external_id만 정확히 insert한다.
//
// 인증: RevenueCat 대시보드 webhook 설정의 "Authorization header" 값을 그대로 비교한다
// (RevenueCat 표준 방식 — HMAC 서명이 아니라 고정 시크릿 문자열 대조). 값은
// REVENUECAT_WEBHOOK_SECRET(Edge Function secrets)로만 보관, 미검증 요청은 401.
//
// 중복 적립 방지: RevenueCat은 배달 실패 시 같은 이벤트를 재전송한다 — event.transaction_id를
// credit_events.external_id로 써서 migrations/0001의 unique 제약이 재전송을 자동으로
// 막는다(23505 유니크 위반은 이미 처리된 이벤트라 에러가 아니라 200으로 조용히 ack).
// 단, 같은 transaction_id로 구매 이벤트와 그 환불 이벤트가 둘 다 올 수 있어(같은 거래의
// 두 생애주기 단계) transaction_id를 그대로 쓰면 환불 insert가 구매 insert와 유니크
// 충돌을 일으켜 "중복"으로 오인되고 실제로는 차감이 누락된다 — `${transaction_id}:${reason}`
// 형태로 이벤트 종류별 네임스페이스를 나눠 이 충돌을 피한다(같은 이벤트의 재전송만 걸러내고,
// 서로 다른 reason끼리는 겹치지 않게).
//
// 환불/취소가 이미 소진한 크레딧을 되돌리려 하면(잔액이 0 미만이 되는 경우)
// credits.balance의 check(>=0) 제약이 insert 자체를 롤백시킨다(Phase B의 "성공 후 차감"과
// 같은 메커니즘). 이 케이스는 0으로 클램프하지 않고 이벤트를 거부한 채 로그만 남긴다
// (사용자 확정: 이미 소진한 크레딧의 환불 처리는 "정책 판단 필요 사항"으로 표시만 하고
// 자동으로 처리하지 않는다) — 23514(check violation)를 감지해 200으로 ack하되 응답
// 바디에 refund_rejected_insufficient_balance로 표시해 RevenueCat의 무한 재시도는
// 막으면서 운영자가 로그로 알 수 있게 한다.
//
// app_user_id가 우리 유저 테이블에 없는 경우(23503 FK 위반 — 이론상 익명 세션이 항상
// 먼저 유저를 만들어두므로 발생하지 않아야 하지만, RevenueCat 대시보드 테스트 이벤트 등
// 실제 유저와 무관한 호출이 올 수 있다): 500으로 답하면 RevenueCat이 계속 재시도하므로,
// 로그만 남기고 202(Accepted — 받았지만 처리 안 함)로 재시도를 유도하지 않는다.
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

function resolveWebhookSecret(): string {
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret) throw new Error('REVENUECAT_WEBHOOK_SECRET가 없다 — Edge Function secrets 등록 확인 필요');
  return secret;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(supabaseUrl, resolveSupabaseSecretKey());
const webhookSecret = resolveWebhookSecret();

// src/purchases.ts의 PRODUCT_EXTRA_ANALYSIS와 반드시 같은 값으로 유지 — Deno(서버)와
// RN(앱) 런타임이 분리돼 있어 상수를 공유 import할 수 없다(함수별 독립 배포 단위).
const PRODUCT_EXTRA_ANALYSIS = 'powernap_extra_analysis_1000';

// 소모성 상품 1종만 다루므로 구독 관련 이벤트(RENEWAL/BILLING_ISSUE 등)는 전부 무시
// 대상 — 아래 두 집합 밖 타입은 200으로 ack만 한다.
const PURCHASE_EVENT_TYPES = new Set(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE']);
const REFUND_EVENT_TYPES = new Set(['REFUND', 'CANCELLATION']);

interface RevenueCatEvent {
  transaction_id: string;
  type: string;
  app_user_id: string;
  product_id?: string;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function authenticate(req: Request): Response | null {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    return jsonResponse(401, { error: 'unauthenticated' });
  }
  return null;
}

async function insertCreditEvent(userId: string, delta: number, reason: 'purchase' | 'refund', externalId: string) {
  const { error } = await admin.from('credit_events').insert({
    user_id: userId,
    delta,
    reason,
    external_id: externalId,
  });
  return error;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' });

  const authError = authenticate(req);
  if (authError) return authError;

  const body = await req.json().catch(() => null);
  const event: RevenueCatEvent | undefined = body?.event;
  if (!event?.transaction_id || !event?.type || !event?.app_user_id) {
    return jsonResponse(400, { error: 'invalid_payload' });
  }

  const isPurchase = PURCHASE_EVENT_TYPES.has(event.type);
  const isRefund = REFUND_EVENT_TYPES.has(event.type);
  if (!isPurchase && !isRefund) {
    return jsonResponse(200, { status: 'ignored' });
  }
  if (isPurchase && event.product_id !== PRODUCT_EXTRA_ANALYSIS) {
    // 지금은 상품이 하나뿐이라 실무에서 걸릴 일은 없지만, 다른 상품이 추가돼도 이 함수가
    // 조용히 잘못 적립하지 않도록 방어한다.
    return jsonResponse(200, { status: 'ignored_unknown_product' });
  }

  const reason: 'purchase' | 'refund' = isPurchase ? 'purchase' : 'refund';
  const delta = isPurchase ? 1 : -1;
  const externalId = `${event.transaction_id}:${reason}`; // 위 파일 상단 주석 참고 — reason별 네임스페이스.

  const error = await insertCreditEvent(event.app_user_id, delta, reason, externalId);
  if (!error) {
    return jsonResponse(200, { status: isPurchase ? 'credited' : 'refunded' });
  }

  if (error.code === '23505') return jsonResponse(200, { status: 'duplicate_ignored' });
  if (error.code === '23503') {
    console.error('revenuecat-webhook: unknown app_user_id, not crediting', event.app_user_id, event.transaction_id);
    return jsonResponse(202, { status: 'unknown_user_ignored' });
  }
  if (reason === 'refund' && error.code === '23514') {
    console.error(
      'revenuecat-webhook refund rejected — balance would go negative (credit already spent)',
      event.transaction_id,
    );
    return jsonResponse(200, { status: 'refund_rejected_insufficient_balance' });
  }

  console.error('revenuecat-webhook insert failed', event.transaction_id, error);
  return jsonResponse(500, { error: 'server_error' });
});
