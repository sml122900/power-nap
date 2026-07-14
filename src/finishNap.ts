// 알람 사운드를 끄고 낮잠을 최종 종료하는 공통 로직 — app/alarm.tsx(미션 꺼짐, 슬라이드/
// 롱프레스 직후)와 app/mission.tsx(미션 켜짐, 명언 통과 직후) 양쪽에서 쓴다. 두 호출부
// 모두 반드시 이 함수를 거쳐야 한다(CLAUDE.md 지뢰 목록 "예약/취소는 반드시 쌍으로" —
// 알림 취소 누락은 유령 알람으로 이어진다).
import { Platform } from 'react-native';
import { type AudioPlayer } from 'expo-audio';

import { cancelAlarmNotificationAsync, stopNativeAlarmSoundAsync } from './notifications';
import { appendNapRecord, clearActiveNap, savePendingFeedback, type ActiveNap } from './store';

export type FinishNapDestination = '/' | '/feedback' | '/wake-stretch';

// 라우팅 판정만 떼어낸 순수 함수 — 오디오/스토리지 없이 jest로 직접 검증한다(resolveNapRoute와
// 같은 패턴). 테스트 낮잠은 wakeRoutineEnabled와 무관하게 항상 홈으로(학습/기상 루틴 모두
// 미반영). 그 외에는 기상 루틴이 켜져 있으면 /wake-stretch(→ light → water → feedback)를
// 먼저 거치고, 꺼져 있으면 곧장 /feedback으로.
export function resolveFinishNapDestination(active: ActiveNap | null, wakeRoutineEnabled: boolean): FinishNapDestination {
  if (active?.isTest) return '/';
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

  const destination = resolveFinishNapDestination(active, wakeRoutineEnabled);

  if (!active) {
    await clearActiveNap();
    return destination;
  }

  // 커피냅은 "커피 마신 시각" 기준, 일반 낮잠은 "낮잠 시작" 기준으로 실제 사용된
  // 총 시간을 계산한다 — NapRecord.offsetMinutes에 쓰인다.
  const basisAt = active.mode === 'coffee' ? (active.coffeeDrankAt ?? active.startedAt) : active.startedAt;
  const offsetMinutes = Math.round((active.alarmAt - basisAt) / 60_000);

  if (active.isTest) {
    // 테스트 낮잠(홈 화면 단축 버튼)은 후기를 받지 않는다 — 학습 반영 없이 기록만 남기고 홈으로.
    await appendNapRecord({
      completedAt: Date.now(),
      mode: active.mode,
      offsetMinutes,
      result: 'test',
      isTest: true,
    });
    await clearActiveNap();
    return destination;
  }

  await savePendingFeedback({ mode: active.mode, offsetMinutes });
  // ActiveNap을 먼저 지워야 후기 화면에서 강제 종료돼도 재실행 시 알람으로
  // 되돌아가지 않는다(§6.4) — mode는 위에서 이미 pendingFeedback에 옮겨 담았다.
  await clearActiveNap();
  return destination;
}
