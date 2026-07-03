# expo-audio 플러그인 옵션 명시 (recordAudioAndroid / enableBackgroundPlayback: false)

## Problem

`npx expo prebuild --platform android --clean` 후 `android/app/src/main/AndroidManifest.xml`에
`RECORD_AUDIO`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` 권한이 계속 나타났다.
낮잠 알람 앱은 오디오를 녹음하지 않고, Phase 2에서 이미 `shouldPlayInBackground: false`로
백그라운드 재생을 안 쓰기로 정했기 때문에 이 권한들은 불필요했다. 처음엔 `app.json`의
수동 `android.permissions` 배열을 의심해 지웠지만, clean prebuild 후에도 동일하게 재현됐다.

## Action

`expo-audio`의 config-plugin 소스(`node_modules/expo-audio/plugin/src/withAudio.ts`)를 직접 읽어
원인을 확인했다. 이 플러그인은 옵션을 주지 않으면 `recordAudioAndroid: true`,
`enableBackgroundPlayback: true`가 기본값이라, 매 prebuild마다 위 권한들과 백그라운드 재생용
`AudioControlsService`를 자동으로 매니페스트에 주입하고 있었다. `app.json`의 permissions 배열을
직접 편집하는 대신, 근본 원인인 플러그인 옵션 자체를 앱의 실제 요구사항에 맞게 명시했다:

```json
["expo-audio", { "recordAudioAndroid": false, "enableBackgroundPlayback": false }]
```

## Result

`--clean` prebuild 후 `aapt dump permissions`로 실제 빌드된 APK를 검증한 결과 세 권한과
`AudioControlsService` 등록이 모두 사라진 것을 확인했다. `PROJECT.md` §4 Phase 5 항목에
"네이티브 알람(AlarmManager.setAlarmClock / AlarmKit)으로 전환 시 백그라운드 재생이 필요해지면
이 옵션들을 재검토할 것"이라는 메모를 남겨, 이번 결정이 영구적인 제약이 아니라 현재 요구사항
기준의 선택임을 문서화했다.
