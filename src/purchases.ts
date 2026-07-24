// RevenueCat 결제 클라이언트 — AI_ANALYSIS.md §7 Phase D. 추가 분석 1회 소모성 상품 1종만
// 다룬다. Android(Google Play Billing)만 지원 — iOS 결제는 범위 밖(AI_ANALYSIS.md §2
// "Google Play 인앱결제" 확정 사항).
import { Platform } from 'react-native';
import Purchases, { PRODUCT_CATEGORY, PURCHASES_ERROR_CODE } from 'react-native-purchases';

import { REVENUECAT_STORE } from './config';
import { ensureAnonymousSession } from './supabase';

// Play Console에 정확히 이 ID로 등록한다(소모성 상품, 1,000원).
export const PRODUCT_EXTRA_ANALYSIS = 'powernap_extra_analysis_1000';

let configured = false;

// REVENUECAT_STORE('test'|'play')에 맞는 키를 고른다 — Play Console 계정(DUNS) 발급
// 전까지는 RevenueCat Test Store 키로 전체 파이프라인을 검증하고, 실스토어 전환은
// config.ts의 상수 하나만 바꾸면 되게 만든다. 'test' 키로 뜬 경우 콘솔에 경고를 남겨
// 실수로 이 상태 그대로 출시 빌드가 나가는 걸 눈에 띄게 한다(하드 assert는 하지 않음 —
// 검증 목적 릴리즈 빌드도 의도적으로 'test' 키를 쓰기 때문).
//
// 지뢰: EXPO_PUBLIC_* 값은 babel-preset-expo의 인라인 플러그인이 `process.env.FOO`처럼
// **정적** 멤버 접근만 빌드 시점에 리터럴로 치환한다 — `process.env[변수명]`처럼 동적
// 접근을 쓰면 아무것도 치환되지 않고 런타임엔 항상 undefined다(실기기에서 "EXPO_PUBLIC_
// REVENUECAT_KEY_TEST가 .env에 없다" 에러가 반복된 근본 원인, .env 파일 자체는 항상
// 정상이었음 — src/supabase.ts의 정적 접근과 대조해 실증 확인). 두 키를 각각 정적으로
// 읽어와야 한다 — REVENUECAT_STORE 분기는 어느 값을 쓸지 고르는 데만 쓴다.
function resolveApiKey(): string {
  const testKey = process.env.EXPO_PUBLIC_REVENUECAT_KEY_TEST;
  const playKey = process.env.EXPO_PUBLIC_REVENUECAT_KEY_PLAY;
  const envVar = REVENUECAT_STORE === 'play' ? 'EXPO_PUBLIC_REVENUECAT_KEY_PLAY' : 'EXPO_PUBLIC_REVENUECAT_KEY_TEST';
  const apiKey = REVENUECAT_STORE === 'play' ? playKey : testKey;
  if (!apiKey) {
    throw new Error(`${envVar}가 .env에 없다.`);
  }
  if (REVENUECAT_STORE === 'test') {
    // RevenueCat Test Store 키는 릴리즈(서명) 빌드에서 SDK 자체가 거부하고 앱을 강제
    // 종료시킨다(공식 문서에 명시된 의도된 동작, CLAUDE.md 지뢰 목록 참고) — __DEV__는
    // 디버그(Metro 연결) 빌드에서만 true라 SDK가 보는 것과 같은 신호로 먼저 걸러서,
    // 저 크래시보다 훨씬 명확한 에러를 여기서 먼저 낸다.
    if (!__DEV__) {
      throw new Error(
        'REVENUECAT_STORE가 "test"인 채로 릴리즈 빌드가 실행됐다 — RevenueCat SDK가 이 키를 거부하고 앱을 강제 종료시킨다. src/config.ts의 REVENUECAT_STORE를 "play"로 바꿀 것.',
      );
    }
    console.warn(
      '[purchases] RevenueCat TEST 키로 초기화됨 — 실스토어 출시 전 src/config.ts의 REVENUECAT_STORE를 "play"로 바꿀 것.',
    );
  }
  return apiKey;
}

// RevenueCat 익명 ID와 이중화되지 않게 익명 Supabase uid를 appUserID로 그대로 넘긴다 —
// 우리 앱은 이미 uid 하나로 유저를 식별하고 있어(supabase.ts), RevenueCat이 별도
// 익명 ID를 새로 발급하게 두지 않는다. configure는 앱 생애주기당 한 번만 호출해야 하는
// SDK 제약이라 모듈 레벨 플래그로 가드한다(getSupabase()의 지연 초기화와 같은 이유로
// 첫 결제/복원 시도 시점까지 미룬다 — 동의 없이도 도달 가능한 화면 로드 시점에
// 조용히 네트워크 호출이 나가는 걸 막는다). 익명 세션을 먼저 확보한 뒤에만 configure를
// 호출해 appUserID가 항상 채워진 상태로 초기화되게 한다(순서 보장).
async function ensurePurchasesConfigured(): Promise<void> {
  if (configured) return;
  if (Platform.OS !== 'android') {
    throw new Error('Purchases are only supported on Android for now.');
  }
  const apiKey = resolveApiKey();
  const session = await ensureAnonymousSession();
  if (__DEV__) {
    console.log('[purchases] configuring with appUserID (Supabase anon uid):', session.userId);
  }
  Purchases.configure({ apiKey, appUserID: session.userId });
  configured = true;
}

export type PurchaseOutcome =
  | { status: 'success' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

function toErrorOutcome(err: unknown): PurchaseOutcome {
  const code = (err as { code?: PURCHASES_ERROR_CODE } | null)?.code;
  if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
    return { status: 'cancelled' };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { status: 'error', message };
}

// 402(무료 소진) 화면의 구매 버튼 → 이 함수. 실제 크레딧 적립은 webhook(→ Supabase)
// 경유라 여기서는 스토어 구매만 완료시킨다 — 호출부가 완료 후 폴링으로 잔액을 확인한다.
//
// Offerings/Package API 대신 getProducts + purchaseStoreProduct로 상품을 직접 조회·구매한다
// (사용자 지시로 전환 — "no Test Store products registered ... for your offerings" 에러의
// 원인이 Offering을 안 만들었기 때문이었는데, 상품이 1개뿐이라 Offering/Package라는
// 다상품 진열 추상화 자체가 필요 없다). 이 덕분에 RevenueCat 대시보드에서 필요한 설정이
// "Product Catalog에 상품 1개 등록"만 남는다 — Offering을 만들고 Current로 지정하고
// Package를 붙이는 절차가 통째로 없어진다(Play Console 실상품 전환 때도 마찬가지 —
// AI_ANALYSIS.md §7 참고).
//
// 지뢰: getProducts의 두 번째 인자(PRODUCT_CATEGORY)를 생략하면 기본값이
// SUBSCRIPTION이라 우리 상품 같은 소모성(NON_SUBSCRIPTION) 상품은 절대 안 잡힌다
// (빈 배열만 돌아옴, 에러도 안 남 — 조용히 실패한다). 반드시 명시할 것.
export async function purchaseExtraAnalysis(): Promise<PurchaseOutcome> {
  try {
    await ensurePurchasesConfigured();
    const products = await Purchases.getProducts([PRODUCT_EXTRA_ANALYSIS], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    console.log('[purchases] getProducts found:', products.map((p) => p.identifier));
    const product = products[0];
    if (!product) {
      console.warn('[purchases] product not found in Product Catalog:', PRODUCT_EXTRA_ANALYSIS);
      return { status: 'error', message: `Product not found: ${PRODUCT_EXTRA_ANALYSIS}` };
    }
    const result = await Purchases.purchaseStoreProduct(product);
    if (__DEV__) {
      console.log('[purchases] purchaseStoreProduct succeeded:', {
        productIdentifier: result.productIdentifier,
        appUserID: result.customerInfo.originalAppUserId,
        nonSubscriptionTransactions: result.customerInfo.nonSubscriptionTransactions,
      });
    }
    return { status: 'success' };
  } catch (err) {
    console.error('[purchases] purchaseStoreProduct failed:', err);
    return toErrorOutcome(err);
  }
}

// 설정 화면 "구매 복원" 링크. Offerings/getProducts 어느 쪽으로 상품을 조회했든 무관하다 —
// 스토어에 실제로 기록된 구매 이력(CustomerInfo)을 그대로 복원하는 API라 상품 조회 경로와
// 독립적이다(SDK 문서 확인, 코드 변경 불필요).
export async function restorePurchases(): Promise<PurchaseOutcome> {
  try {
    await ensurePurchasesConfigured();
    await Purchases.restorePurchases();
    return { status: 'success' };
  } catch (err) {
    return toErrorOutcome(err);
  }
}
