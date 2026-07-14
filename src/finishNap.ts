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
// 같은 패턴). 테스트 낮잠도 실제 알람과 완전히 동일한 경로를 탄다(사용자 지시 — "모든 기능이
// 테스트와 동일했으면"). 학습값 오염/AI 분석 데이터 오염은 라우팅이 아니라 각 지점에서 막는다:
// app/feedback.tsx의 "직접 조정하기"는 isTest면 applyManualAdjustment를 건너뛰고 사용자에게
// "반영되지 않았다"고 알린다, appendNapRecord는 항상 isTest를 실어 보내 AI 분석
// (filterAnalyzableRecords)에서 제외되게 한다.
export function resolveFinishNapDestination(wakeRoutineEnabled: boolean): FinishNapDestination {
  return wakeRoutineEnabled ? '/wake-stretch' : '/feedback';
}

export async function finishNap(
  player: AudioPlayer,
  active: ActiveNap | null,
  wakeRoutineEnabled: boolean
): Promise<FinishNapDestination> {
  // Android는 네이티브 알람(stopAlarm)이 소리를 전담하므로 그쪽을 멈추고, iOS는 이
  // 화면의 expo-audio 재생을 직접 멈춘다 — stopNativeAlarmSoundAsync는 Android에서만
  // 동작하는 no-op 안전 래퍼다(src/notifications.ts 참고).
  if (Platform.OS === 'ios') {
    player.pause();
  }
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

  await savePendingFeedback({ mode: active.mode, offsetMinutes, isTest: active.isTest });
  // ActiveNap을 먼저 지워야 후기 화면에서 강제 종료돼도 재실행 시 알람으로
  // 되돌아가지 않는다(§6.4) — mode는 위에서 이미 pendingFeedback에 옮겨 담았다.
  await clearActiveNap();
  return destination;
}
