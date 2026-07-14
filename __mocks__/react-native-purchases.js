// jest 수동 모킹 — react-native-purchases의 실제 dist가 하위 의존성
// @revenuecat/purchases-js-hybrid-mappings(ESM 전용)를 끌어와 jest-expo 기본
// transformIgnorePatterns로는 파싱이 깨진다(직접 재현 확인). 화면 렌더/로직 테스트는
// 네이티브 결제 SDK를 실제로 태울 필요가 없어 최소 스텁으로 대체한다.
module.exports = {
  __esModule: true,
  default: {
    configure: jest.fn(),
    getOfferings: jest.fn(() => Promise.resolve({ current: null })),
    purchasePackage: jest.fn(() => Promise.resolve({})),
    restorePurchases: jest.fn(() => Promise.resolve({})),
  },
  PURCHASES_ERROR_CODE: {
    PURCHASE_CANCELLED_ERROR: 'PURCHASE_CANCELLED_ERROR',
  },
};
