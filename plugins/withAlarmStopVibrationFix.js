// 알람 안정성 패치 두 건 — 둘 다 expo-alarm-module@1.2.0(node_modules) 소스라
// withFullScreenAlarmIntent.js와 같은 이유로 config plugin 안에서 patch-package 방식으로
// 처리한다(android/ 디렉터리는 gitignore라 여기서 해야 `expo prebuild --clean`에도 재현됨).
//
// 1. Sound.java stop() — stopVibration()이 stopSound()/release()와 같은
//    `if (mediaPlayer.isPlaying())` 가드 안에 있다. playSound()가 조용히 실패해서(catch로
//    삼켜짐, 원본 소스) isPlaying()이 계속 false로 남으면 진동을 끌 방법이 아예 사라져
//    무한 진동으로 남는다(알람이 "안 꺼지는" 최악 시나리오). stopVibration()을 가드
//    밖으로 빼 항상 호출되게 한다 — vibrator.cancel()은 진동 중이 아니어도 안전(no-op).
//
// 2. AlarmService.java onStartCommand() — START_STICKY라 OS가 프로세스를 죽인 뒤
//    서비스만 재시작시키면 intent가 null로 온다(Android 공식 문서화된 동작). 원본은
//    바로 intent.getStringExtra(...)를 호출해 NPE로 죽는다. alarmUid 없이는 어차피
//    아무것도 재생 못 하니 조용히 멈추게 한다.
//
// 버전 결합 주의: 아래 ANCHOR 상수들은 expo-alarm-module 1.2.0의 정확한 코드와 문자열이
// 일치해야 패치가 걸린다. 라이브러리를 업그레이드하면 이 파일도 다시 확인할 것
// (안 맞으면 조용히 스킵되지 않고 에러를 던지도록 만들어 뒀다).

const { withDangerousMod, createRunOncePlugin } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PACKAGE_DIR = 'node_modules/expo-alarm-module/android/src/main/java/com/expoalarmmodule';
const SOUND_JAVA_RELATIVE_PATH = `${PACKAGE_DIR}/Sound.java`;
const ALARM_SERVICE_JAVA_RELATIVE_PATH = `${PACKAGE_DIR}/AlarmService.java`;

const SOUND_STOP_ANCHOR = [
  'void stop() {',
  'try {',
  'if (mediaPlayer.isPlaying()) {',
  'stopSound();',
  'stopVibration();',
  'mediaPlayer.release();',
  '}',
  '} catch (IllegalStateException e) {',
  'Log.d(TAG, "Sound has probably been released already");',
  '}',
  '}',
];

function buildPatchedSoundLines(lines) {
  const startIdx = lines.findIndex((line) => line.trim() === SOUND_STOP_ANCHOR[0]);
  if (startIdx === -1) return null;
  for (let i = 0; i < SOUND_STOP_ANCHOR.length; i++) {
    if (!lines[startIdx + i] || lines[startIdx + i].trim() !== SOUND_STOP_ANCHOR[i]) return null;
  }

  const methodIndent = lines[startIdx].slice(0, lines[startIdx].indexOf('void'));
  const bodyIndent = methodIndent + '    ';

  const patched = lines.slice();
  patched.splice(
    startIdx,
    SOUND_STOP_ANCHOR.length,
    `${methodIndent}void stop() {`,
    `${bodyIndent}// PowerNap 패치(withAlarmStopVibrationFix) — stopVibration()을 stopSound()/release()와`,
    `${bodyIndent}// 같은 isPlaying() 가드에 묶지 않고 항상 먼저 호출한다(무한 진동 방지, CLAUDE.md 지뢰 목록).`,
    `${bodyIndent}stopVibration();`,
    `${bodyIndent}try {`,
    `${bodyIndent}    if (mediaPlayer.isPlaying()) {`,
    `${bodyIndent}        stopSound();`,
    `${bodyIndent}        mediaPlayer.release();`,
    `${bodyIndent}    }`,
    `${bodyIndent}} catch (IllegalStateException e) {`,
    `${bodyIndent}    Log.d(TAG, "Sound has probably been released already");`,
    `${bodyIndent}}`,
    `${methodIndent}}`
  );
  return patched;
}

const SERVICE_ANCHOR = [
  'Log.d(TAG, "On start command");',
  '',
  'String alarmUid = intent.getStringExtra("ALARM_UID");',
];

function buildPatchedServiceLines(lines) {
  const startIdx = lines.findIndex((line) => line.trim() === SERVICE_ANCHOR[0]);
  if (startIdx === -1) return null;
  for (let i = 0; i < SERVICE_ANCHOR.length; i++) {
    if (lines[startIdx + i] === undefined || lines[startIdx + i].trim() !== SERVICE_ANCHOR[i]) return null;
  }

  const bodyIndent = lines[startIdx].slice(0, lines[startIdx].indexOf('Log'));
  const blockIndent = bodyIndent + '    ';
  const insertAt = startIdx + 2; // "String alarmUid ..." 줄 앞

  const patched = lines.slice();
  patched.splice(
    insertAt,
    0,
    `${bodyIndent}if (intent == null) {`,
    `${blockIndent}// PowerNap 패치(withAlarmStopVibrationFix) — START_STICKY 재시작 시 OS가 null intent를`,
    `${blockIndent}// 준다(문서화된 동작). alarmUid 없이는 재생할 게 없으니 조용히 멈춘다(NPE 방지).`,
    `${blockIndent}Log.w(TAG, "onStartCommand called with null intent (OS restart) — stopping self");`,
    `${blockIndent}stopSelf();`,
    `${blockIndent}return START_NOT_STICKY;`,
    `${bodyIndent}}`,
    ''
  );
  return patched;
}

function patchJavaFile(projectRoot, relativePath, alreadyPatchedMarker, buildPatchedLines, errorHint) {
  const filePath = path.join(projectRoot, relativePath);
  const source = fs.readFileSync(filePath, 'utf8');

  if (source.includes(alreadyPatchedMarker)) {
    // 같은 node_modules 설치 위에서 prebuild를 다시 돌린 경우 — 이미 패치돼 있으니 스킵.
    return;
  }

  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r\n|\n/);
  const patchedLines = buildPatchedLines(lines);

  if (!patchedLines) {
    throw new Error(
      `withAlarmStopVibrationFix: ${relativePath}에서 패치 대상 코드를 찾지 못했습니다. ` +
        `라이브러리 버전이 바뀌어 코드가 달라졌을 수 있습니다 — plugins/withAlarmStopVibrationFix.js를 ` +
        `새 버전에 맞게 갱신하세요. (${errorHint})`
    );
  }

  fs.writeFileSync(filePath, patchedLines.join(eol));
}

function withAlarmStopVibrationFix(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      patchJavaFile(
        projectRoot,
        SOUND_JAVA_RELATIVE_PATH,
        'withAlarmStopVibrationFix',
        buildPatchedSoundLines,
        'Sound.stop()'
      );
      patchJavaFile(
        projectRoot,
        ALARM_SERVICE_JAVA_RELATIVE_PATH,
        'withAlarmStopVibrationFix',
        buildPatchedServiceLines,
        'AlarmService.onStartCommand()'
      );
      return config;
    },
  ]);
}

module.exports = createRunOncePlugin(withAlarmStopVibrationFix, 'powernap-alarm-stop-vibration-fix', '1.0.0');
