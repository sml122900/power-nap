// 정식 출시 직전 false로. 릴리즈 빌드에서도 단축 낮잠 테스트를 위해 노출.
export const SHOW_TEST_BUTTONS = true;

// RevenueCat 결제 검증 스토어 — Play Console 계정(DUNS) 발급 전까지는 'test'
// (RevenueCat Test Store)로 전체 구매 파이프라인을 검증하고, 실제 Play 결제로 전환할
// 때 이 값만 'play'로 바꾼다(src/purchases.ts가 여기 값으로 EXPO_PUBLIC_REVENUECAT_KEY_TEST/
// PLAY 중 하나를 고른다). 'test'인 채로 초기화되면 콘솔에 경고를 남긴다 — 정식 출시
// 직전 'play'로 바꿨는지 SHOW_TEST_BUTTONS와 함께 확인할 것(릴리즈 체크리스트).
export const REVENUECAT_STORE: 'test' | 'play' = 'test';

export const PRIVACY_POLICY_URL = 'https://lifebookapplication.com/privacy/powernap';
