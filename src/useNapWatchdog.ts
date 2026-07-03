// 화면 진입/포그라운드 복귀마다 ActiveNap.alarmAt(절대시각)과 Date.now()를 비교해
// 있어야 할 화면으로 강제 이동시킨다. 세 화면(홈/수면/알람) 각각에서 자신의 경로를
// 넘겨 호출한다.
//
// 백그라운드에서는 JS 타이머(setInterval)가 멈춘다 — AppState가 'active'로 돌아오는
// 시점에 다시 판정하지 않으면 알람을 완전히 놓칠 수 있다. 이 훅이 그 재판정을 담당한다.
// (마운트 시점의 1회 체크는 강제 종료 후 재실행 시의 ActiveNap 복원(§5)도 함께 처리한다.)

import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';

import { getActiveNap } from './store';

export type NapRoute = '/' | '/sleep' | '/alarm';

export function useNapWatchdog(currentRoute: NapRoute): void {
  const router = useRouter();
  const routeRef = useRef(currentRoute);
  routeRef.current = currentRoute;

  const check = useCallback(async () => {
    const nap = await getActiveNap();
    const target: NapRoute = !nap ? '/' : nap.alarmAt > Date.now() ? '/sleep' : '/alarm';
    if (target !== routeRef.current) {
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
}
