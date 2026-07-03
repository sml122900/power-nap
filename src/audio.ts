// 알람 오디오 세션 설정 — PROJECT.md §4 레이어 1(포그라운드 주 알람).
// expo-audio SDK 57 `AudioMode`(node_modules/expo-audio/build/Audio.types.d.ts) 기준.

import { setAudioModeAsync } from 'expo-audio';

export async function configureAlarmAudioModeAsync(): Promise<void> {
  await setAudioModeAsync({
    // iOS 무음(벨소리) 스위치가 켜져 있어도 재생되도록 하는 옵션. AudioMode 타입 주석상
    // 기본값은 true이지만, 알람의 존재 이유가 걸린 설정이므로 암묵적 기본값에 기대지 않고
    // 명시적으로 켠다.
    playsInSilentMode: true,
    // 알람은 다른 앱의 오디오를 밀어내고 독점 재생되어야 한다(음악 재생 중에도 또렷하게 들려야 함).
    interruptionMode: 'doNotMix',
    // 이 레이어는 포그라운드 전용이다(§4: 포그라운드 JS 타이머 기반). 백그라운드 알람 재생은
    // 하지 않으며, 그 경우는 로컬 알림(§4 레이어 2)이 담당한다.
    shouldPlayInBackground: false,
  });
}
