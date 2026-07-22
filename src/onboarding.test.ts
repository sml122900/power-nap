import { shouldShowOnboarding } from './onboarding';

const BASE = { onboardingComplete: false, widgetMode: null, hasNapInProgress: false } as const;

describe('shouldShowOnboarding — 첫 실행 온보딩 노출 판정', () => {
  it('완료 안 했고, 위젯 진입도 아니고, 진행 중인 낮잠도 없으면 true(첫 실행)', () => {
    expect(shouldShowOnboarding(BASE)).toBe(true);
  });

  it('이미 완료했으면 그 외 조건과 무관하게 항상 false', () => {
    expect(shouldShowOnboarding({ ...BASE, onboardingComplete: true })).toBe(false);
  });

  it('위젯 딥링크로 열렸으면 미완료여도 false(위젯 액션이 우선)', () => {
    expect(shouldShowOnboarding({ ...BASE, widgetMode: 'fast' })).toBe(false);
    expect(shouldShowOnboarding({ ...BASE, widgetMode: 'slow' })).toBe(false);
    expect(shouldShowOnboarding({ ...BASE, widgetMode: 'coffee' })).toBe(false);
  });

  it('진행 중이던 낮잠/설문이 있으면 미완료여도 false(복귀가 우선)', () => {
    expect(shouldShowOnboarding({ ...BASE, hasNapInProgress: true })).toBe(false);
  });
});
