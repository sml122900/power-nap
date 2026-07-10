// 알람음(iOS) + 진동 반복을 시작하는 로직 — app/alarm.tsx와 app/mission.tsx(미션 토글 ON일 때
// 알람 화면보다 먼저 뜨는 화면, PROJECT.md/BACKLOG.md "알람 해제 미션" 참고) 양쪽에서 쓴다.
// alarmPlaybackActive 모듈 레벨 가드가 두 화면에 걸쳐 공유돼야 미션 완료 후 알람 화면으로
// 넘어갈 때 소리가 겹치지 않는다 — 각 화면에 따로 선언하면 서로 다른 모듈 스코프 변수가
// 되어 가드가 무력화된다(원래 alarm.tsx에만 있던 로직을 그대로 옮긴 것 — 동작 변경 없음).
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import { configureAlarmAudioModeAsync } from './audio';

const HAPTICS_INTERVAL_MS = 1200;

let alarmPlaybackActive = false;

export function useAlarmPlayback(player: AudioPlayer): void {
  useEffect(() => {
    let stopped = false;
    let ownsPlayback = false;
    let hapticsInterval: ReturnType<typeof setInterval> | undefined;

    (async () => {
      if (alarmPlaybackActive) return; // 이미 다른 인스턴스(미션 화면 또는 알람 화면)가 재생 중
      alarmPlaybackActive = true;
      ownsPlayback = true;

      // Android는 네이티브 알람이 이미 STREAM_ALARM으로 재생 중이다 — 여기서 또
      // expo-audio를 켜면 소리가 겹친다. iOS만 이 레이어가 주 알람 사운드를 담당한다.
      if (Platform.OS === 'ios') {
        await configureAlarmAudioModeAsync();
        if (stopped) return;

        player.loop = true;
        player.volume = 1.0;
        player.play();
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      hapticsInterval = setInterval(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }, HAPTICS_INTERVAL_MS);
    })();

    return () => {
      stopped = true;
      if (hapticsInterval) clearInterval(hapticsInterval);
      // player.pause()를 여기서 부르지 않는다: useAudioPlayer가 언마운트 시 자동으로
      // release하므로(2d8d5db) 재생 정지는 이미 보장된다. 정지는 handleDismiss(alarm.tsx)
      // 단 한 곳에서만 명시적으로 한다.
      if (ownsPlayback) alarmPlaybackActive = false;
    };
  }, [player]);
}
