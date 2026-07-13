// 화면 진입/포그라운드 복귀마다 ActiveNap.alarmAt(절대시각)과 Date.now()를 비교해
// 있어야 할 화면으로 강제 이동시킨다. 네 화면(홈/수면/알람/미션) 각각에서 자신의 경로를
// 넘겨 호출한다.
//
// 백그라운드에서는 JS 타이머(setInterval)가 멈춘다 — AppState가 'active'로 돌아오는
// 시점에 다시 판정하지 않으면 알람을 완전히 놓칠 수 있다. 이 훅이 그 재판정을 담당한다.
// (마운트 시점의 1회 체크는 강제 종료 후 재실행 시의 ActiveNap 복원(§5)도 함께 처리한다.)
//
// check()를 반환해 호출부(예: 수면 화면의 250ms tick)가 같은 판정 로직을 재사용할 수 있게
// 한다 — tick과 AppState 리스너가 동시에 판정해도 redirectedRef 가드 덕분에 router.replace가
// 두 번 호출되는 레이스가 생기지 않는다.

import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';

import { getActiveNap, getSettings, type ActiveNap } from './store';

export type NapRoute = '/' | '/sleep' | '/alarm' | '/mission';

// 라우팅 판정만 떼어낸 순수 함수 — React/AsyncStorage 없이 jest로 직접 검증한다.
// 미션(명언 타이핑)은 missionEnabled가 켜져 있고, 아직 이번 낮잠에서 통과하지 않았을
// 때 끼어든다. 테스트 낮잠(isTest)도 미션을 탄다(사용자 명시 지시로 변경 — 테스트
// 버튼으로 미션 화면 자체를 확인하려는 목적, BACKLOG.md "알람 해제 미션" 참고).
// 후기 화면은 이 변경과 무관하게 여전히 isTest를 건너뛴다(별도 로직).
export function resolveNapRoute(nap: ActiveNap | null, missionEnabled: boolean, nowMs: number): NapRoute {
  if (!nap) return '/';
  if (nap.alarmAt > nowMs) return '/sleep';
  if (missionEnabled && !nap.missionCompleted) return '/mission';
  return '/alarm';
}

export function useNapWatchdog(currentRoute: NapRoute): () => void {
  const router = useRouter();
  const routeRef = useRef(currentRoute);
  routeRef.current = currentRoute;
  const redirectedRef = useRef(false);

  const check = useCallback(async () => {
    if (redirectedRef.current) return;
    const [nap, settings] = await Promise.all([getActiveNap(), getSettings()]);
    if (redirectedRef.current) return;
    const target = resolveNapRoute(nap, settings.missionEnabled, Date.now());
    if (target !== routeRef.current) {
      redirectedRef.current = true;
      router.replace(target);
    }
  }, [router]);

  useEffect(() => {
    check();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') check();
    });
    return () => subscription.remove();
  }, [check]);

  return check;
}
