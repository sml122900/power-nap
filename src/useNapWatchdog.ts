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
import { AppState, Platform } from 'react-native';
import { useRouter } from 'expo-router';

import { finalizeNapCleanup, resolveWakeRoute } from './finishNap';
import { isNativeAlarmActiveAsync } from './notifications';
import { getActiveNap, getPendingFeedback, getSettings, type ActiveNap } from './store';

export type NapRoute = '/' | '/sleep' | '/alarm' | '/mission';

// 라우팅 판정만 떼어낸 순수 함수 — React/AsyncStorage 없이 jest로 직접 검증한다.
// 순서: 슬라이드/롱프레스 해제(/alarm)가 항상 먼저다. 그 다음 missionEnabled가 켜져
// 있으면 /mission으로 — 알람음/진동은 이 전환과 무관하게 계속 울린다(실제 정지·기록
// 저장은 미션 통과 시점, src/finishNap.ts). 테스트 낮잠(isTest)·체험 낮잠(isPreview) 둘 다
// 이 라우팅은 동일하게 탄다 — ActiveNap.isTest/isPreview를 이 함수는 아예 들여다보지
// 않는다(사용자 명시 지시 — 테스트 버튼으로 미션 화면 자체를 확인하려는 목적,
// BACKLOG.md "알람 해제 미션" 참고; 체험 낮잠도 같은 이유로 전체 흐름을 동일하게 겪어야
// 한다, docs/decisions/preview-mode-isTest-vs-isPreview.md). 후기 화면 스킵은 이 라우팅과
// 무관한 별도 로직.
export function resolveNapRoute(nap: ActiveNap | null, missionEnabled: boolean, nowMs: number): NapRoute {
  if (!nap) return '/';
  if (nap.alarmAt > nowMs) return '/sleep';
  if (!nap.alarmDismissed) return '/alarm';
  return missionEnabled ? '/mission' : '/alarm';
}

// 알림 스와이프(setDeleteIntent, PROJECT.md §4)로 네이티브 알람만 꺼지고 ActiveNap은
// JS에 그대로 남는 경로를 감지한다 — 알람이 발화했는데(alarmAt<=nowMs) 네이티브가 이미
// 죽어있으면 무조건 orphan이다. alarmDismissed(=미션 대기 중, 명언 미완)는 더 이상
// 예외로 두지 않는다 — 슬라이드로 알람 관문은 이미 통과했고 남은 건 명언 관문뿐인데,
// 그 상태에서 네이티브가 죽었다는 건 "미션 화면까지 와서 알림을 스와이프했다"는
// 뜻이라 똑같이 orphan 취급해 정리한다(명언은 건너뛰고 기상 루틴부터 재개 —
// docs/decisions/swipe-ends-alarm-only.md). alarmDismissed:true인데 nap이 여전히
// 존재하는 경우는 오직 이 미션-대기 상태뿐이다(미션을 실제로 통과하면 finishNap이
// ActiveNap 자체를 지우므로 nap이 곧장 null이 된다) — 그래서 "이미 해제된 낮잠을
// 잘못 정리"할 위험이 없다. nap이 아예 없으면(이미 clearActiveNap된 정상 해제 직후)
// 여전히 항상 false.
export function shouldTreatAsOrphaned(nap: ActiveNap | null, nativeActive: boolean, nowMs: number): boolean {
  if (!nap) return false;
  if (nap.alarmAt > nowMs) return false;
  return !nativeActive;
}

export function useNapWatchdog(currentRoute: NapRoute): () => void {
  const router = useRouter();
  const routeRef = useRef(currentRoute);
  routeRef.current = currentRoute;
  const redirectedRef = useRef(false);

  const check = useCallback(async () => {
    if (redirectedRef.current) return;
    const [nap, pending, settings] = await Promise.all([getActiveNap(), getPendingFeedback(), getSettings()]);
    if (redirectedRef.current) return;

    // ActiveNap이 없는데 PendingFeedback만 남아있으면(기상 루틴·설문 도중 프로세스가
    // 죽은 뒤 재실행) 그 지점으로 복귀시킨다 — 콜드 스타트는 항상 '/'에서 시작하므로
    // 이 분기는 사실상 홈 화면에서만 의미 있게 발동한다. /sleep·/alarm·/mission이
    // 마운트돼 있다는 건 이미 nap이 있다는 뜻이라 여기 안 걸리고, /wake-stretch~
    // /feedback은 애초에 이 훅을 안 써서(자체 마운트 가드만 있음) 정상 진행 중엔
    // 이 코드가 실행될 일이 없다(docs/decisions/wake-routine-cold-start-resume.md).
    if (!nap && pending) {
      // routeRef.current(NapRoute: '/'|'/sleep'|'/alarm'|'/mission')는 wakeTarget과
      // 타입상 겹칠 수 없다 — 이 훅을 호출하는 4개 화면 중 어디서 왔든 항상 리다이렉트.
      redirectedRef.current = true;
      router.replace(resolveWakeRoute(pending, settings.wakeRoutineEnabled));
      return;
    }

    const target = resolveNapRoute(nap, settings.missionEnabled, Date.now());

    // '/alarm' 또는 '/mission'으로 가려는 경우에만(대부분의 tick은 여기 안 걸림) 네이티브가
    // 실제로 아직 울리는지 확인한다 — getAlarmState()는 Android IPC 왕복이라 매 tick
    // 무조건 부르지 않는다. '/mission'도 포함하는 이유: 슬라이드로 알람 관문은 통과했지만
    // 명언은 아직인 상태에서 알림을 스와이프하면 네이티브만 죽고 ActiveNap은 그대로라,
    // 이 경우도 감지해서 명언을 건너뛰고 기상 루틴으로 보내야 한다(설계 논의 —
    // docs/decisions/swipe-ends-alarm-only.md). nap은 target==='/alarm'|'/mission'이면
    // resolveNapRoute 정의상 항상 non-null.
    if ((target === '/alarm' || target === '/mission') && Platform.OS === 'android' && nap) {
      const nativeActive = await isNativeAlarmActiveAsync();
      // 이 await 도중 다른 tick(또는 정상 해제 경로)이 먼저 처리했을 수 있다 —
      // 재확인 후 바로(await 없이) 플래그를 세워야 두 tick이 동시에 finalizeNapCleanup을
      // 부르지 않는다. finalizeNapCleanup 자체도 멱등이라 이 가드가 없어도 상태 손상은
      // 없지만, 중복 네이티브 호출/router.replace 중복 호출을 막기 위해 둔다.
      if (redirectedRef.current) return;
      if (shouldTreatAsOrphaned(nap, nativeActive, Date.now())) {
        redirectedRef.current = true;
        const destination = await finalizeNapCleanup(nap, settings.wakeRoutineEnabled);
        router.replace(destination);
        return;
      }
    }

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
