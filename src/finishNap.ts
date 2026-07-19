// 알람 사운드를 끄고 낮잠을 최종 종료하는 공통 로직 — app/alarm.tsx(미션 꺼짐, 슬라이드/
// 롱프레스 직후)와 app/mission.tsx(미션 켜짐, 명언 통과 직후) 양쪽에서 쓴다. 두 호출부
// 모두 반드시 이 함수를 거쳐야 한다(CLAUDE.md 지뢰 목록 "예약/취소는 반드시 쌍으로" —
// 알림 취소 누락은 유령 알람으로 이어진다).
import { Platform } from 'react-native';
import { type AudioPlayer } from 'expo-audio';

import { cancelAlarmNotificationAsync, stopNativeAlarmSoundAsync } from './notifications';
import { clearActiveNap, savePendingFeedback, type ActiveNap } from './store';

export type FinishNapDestination = '/feedback' | '/wake-stretch';

// 라우팅 판정만 떼어낸 순수 함수 — 오디오/스토리지 없이 jest로 직접 검증한다(resolveNapRoute와
// 같은 패턴). 테스트 낮잠(isTest)·체험 낮잠(isPreview) 둘 다 이 함수에서는 전혀 안 보인다 —
// 의도적이다. 실제 알람과 완전히 동일한 경로를 태우는 게 두 기능 공통의 요구사항이라
// (isTest는 사용자 지시 "모든 기능이 테스트와 동일했으면", isPreview는 "전체 흐름은 동일하게
// 겪되"), 라우팅 단계에서 분기하면 그 요구사항이 깨진다. 데이터 오염 방지는 라우팅이 아니라
// 각 부작용 지점에서 막는다: app/feedback.tsx의 "직접 조정하기"는 isTest 또는 isPreview면
// applyManualAdjustment를 건너뛰고, appendNapRecord는 isPreview면 아예 호출되지 않으며
// (shouldRecordNap 가드) 그 외엔 isTest를 실어 보내 AI 분석(filterAnalyzableRecords)에서만
// 제외되게 한다. docs/decisions/preview-mode-isTest-vs-isPreview.md 참고.
export function resolveFinishNapDestination(wakeRoutineEnabled: boolean): FinishNapDestination {
  return wakeRoutineEnabled ? '/wake-stretch' : '/feedback';
}

// player(iOS expo-audio 정지)를 뺀 나머지 정리 로직 — src/useNapWatchdog.ts가 알림
// 스와이프로 고아가 된 알람(ActiveNap)을 정리할 때도 이 함수를 그대로 쓴다. 그 경로엔
// 화면에 마운트된 AudioPlayer가 없어(여러 화면이 공유하는 훅) player를 요구할 수 없다 —
// 어차피 이 문제 자체가 Android 전용(iOS는 이 경로가 없음)이라 player.pause() 없이도
// 안전하다.
export async function finalizeNapCleanup(
  active: ActiveNap | null,
  wakeRoutineEnabled: boolean
): Promise<FinishNapDestination> {
  // Android는 네이티브 알람(stopAlarm)이 소리를 전담하므로 그쪽을 멈춘다.
  // stopNativeAlarmSoundAsync/cancelAlarmNotificationAsync는 이미 꺼져/취소된 상태에
  // 다시 호출해도 안전한 no-op이라(src/notifications.ts) 중복 호출을 방어할 필요 없다.
  await stopNativeAlarmSoundAsync();
  await cancelAlarmNotificationAsync(active?.notificationId ?? null);

  const destination = resolveFinishNapDestination(wakeRoutineEnabled);

  if (!active) {
    await clearActiveNap();
    return destination;
  }

  // 커피냅은 "커피 마신 시각" 기준, 일반 낮잠은 "낮잠 시작" 기준으로 실제 사용된
  // 총 시간을 계산한다 — NapRecord.offsetMinutes에 쓰인다.
  const basisAt = active.mode === 'coffee' ? (active.coffeeDrankAt ?? active.startedAt) : active.startedAt;
  const offsetMinutes = Math.round((active.alarmAt - basisAt) / 60_000);

  // savePendingFeedback은 단일 키 덮어쓰기라 같은 active로 두 번 호출돼도(예: 정상 해제와
  // 겹친 watchdog tick) 안전 — clearActiveNap도 removeItem이라 마찬가지로 멱등이다.
  await savePendingFeedback({ mode: active.mode, offsetMinutes, isTest: active.isTest, isPreview: active.isPreview });
  // ActiveNap을 먼저 지워야 후기 화면에서 강제 종료돼도 재실행 시 알람으로
  // 되돌아가지 않는다(§6.4) — mode는 위에서 이미 pendingFeedback에 옮겨 담았다.
  await clearActiveNap();
  return destination;
}

export async function finishNap(
  player: AudioPlayer,
  active: ActiveNap | null,
  wakeRoutineEnabled: boolean
): Promise<FinishNapDestination> {
  // iOS는 이 화면의 expo-audio 재생을 직접 멈춘다 — Android는 finalizeNapCleanup 안의
  // stopNativeAlarmSoundAsync가 담당(그쪽은 no-op 안전 래퍼, src/notifications.ts 참고).
  if (Platform.OS === 'ios') {
    player.pause();
  }
  return finalizeNapCleanup(active, wakeRoutineEnabled);
}
