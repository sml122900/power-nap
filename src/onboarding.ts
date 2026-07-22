// 첫 실행 온보딩(전체화면 튜토리얼 4장) 노출 판정 — 순수 함수만, 라우팅/스토리지는
// app/index.tsx(진입 시 1회) + src/store.ts(getOnboardingComplete/setOnboardingComplete)
// 쪽에서 담당한다(resolveNapRoute/resolveWidgetModeAction과 같은 패턴).
//
// 위젯 딥링크로 앱이 열렸거나 이미 진행 중이던 낮잠/설문(ActiveNap·PendingFeedback)이
// 있으면 온보딩보다 그쪽이 우선이다 — 둘 다 사용자의 명시적 의도(위젯 탭) 또는 이미
// 시작된 흐름이라, 온보딩 미완료 플래그만 보고 가로막으면 안 된다(예: 구버전에서
// 낮잠을 걸어둔 채로 이 기능이 추가된 업데이트를 받은 경우). 이 경우 온보딩은 그냥
// 다음 기회(다시 '/'에 진입했을 때, 활성 낮잠이 없는 시점)로 미뤄진다.
import type { WidgetMode } from './store';

export function shouldShowOnboarding(params: {
  onboardingComplete: boolean;
  widgetMode: WidgetMode | null;
  hasNapInProgress: boolean;
}): boolean {
  if (params.onboardingComplete) return false;
  if (params.widgetMode) return false;
  if (params.hasNapInProgress) return false;
  return true;
}
