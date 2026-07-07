// 알람 화면 자동 점등 패치 — PROJECT.md §4 "알려진 한계" / STATUS.md B그룹 참고.
//
// expo-alarm-module@1.2.0은 알람 발화 시 일반 알림만 띄우고 setFullScreenIntent()를 쓰지
// 않는다(라이브러리에 옵션 자체가 없음 — Helper.getNotification()에 하드코딩돼 있어 JS에서
// 끌어올 훅이 없다). 그래서 잠금/백그라운드 상태에선 사용자가 알림을 직접 탭해야 해제
// 화면으로 들어간다. 이 플러그인은 두 가지를 한다:
//
// 1. 매니페스트: USE_FULL_SCREEN_INTENT 권한 + MainActivity에 showWhenLocked/turnScreenOn
//    (둘 다 순수 매니페스트 속성이라 소스 수정 없이 config-plugin mod만으로 가능)
// 2. node_modules/expo-alarm-module의 Helper.java 소스를 직접 패치해 setFullScreenIntent()
//    호출을 주입한다 — android/ 디렉터리(gitignore 대상)가 아니라 여기서 처리해야
//    `expo prebuild --clean`을 다시 돌려도 매번 재현된다. patch-package와 같은 원리를
//    config plugin 안에 넣은 것.
//
// 버전 결합 주의: 아래 ORIGINAL_SNIPPET은 expo-alarm-module 1.2.0의 정확한 코드와
// 문자열이 일치해야 패치가 걸린다. 라이브러리를 업그레이드하면 이 파일도 다시 확인할 것
// (안 맞으면 조용히 스킵되지 않고 에러를 던지도록 만들어 뒀다).

const { AndroidConfig, withAndroidManifest, withDangerousMod, createRunOncePlugin } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const HELPER_JAVA_RELATIVE_PATH =
  'node_modules/expo-alarm-module/android/src/main/java/com/expoalarmmodule/Helper.java';

const CONTENT_INTENT_LINE = '.setContentIntent(createOnClickedIntent(context, alarmUid, id))';
const DELETE_INTENT_LINE = '.setDeleteIntent(pendingIntentDismiss);';

// node_modules 안 라이브러리 소스라 OS/checkout에 따라 CRLF일 수 있다(실제로 이 파일은
// CRLF) — 줄 단위로 찾아 스플라이스하는 방식이라 개행 문자에 영향받지 않는다.
function buildPatchedLines(lines) {
  const contentIntentIdx = lines.findIndex((line) => line.trim() === CONTENT_INTENT_LINE);
  if (contentIntentIdx === -1) return null;
  const deleteIntentIdx = contentIntentIdx + 1;
  if (!lines[deleteIntentIdx] || lines[deleteIntentIdx].trim() !== DELETE_INTENT_LINE) return null;

  const indent = lines[contentIntentIdx].slice(0, lines[contentIntentIdx].indexOf('.'));
  const bodyIndent = indent.slice(0, -8); // 메서드 체이닝 들여쓰기(8칸) 한 단계 바깥 — if 블록용.

  const patched = lines.slice();
  patched.splice(
    deleteIntentIdx,
    0,
    `${indent}.setFullScreenIntent(createOnClickedIntent(context, alarmUid, id), true)`
  );
  patched.splice(
    deleteIntentIdx + 2,
    0,
    '',
    `${bodyIndent}// PowerNap 패치(withFullScreenAlarmIntent) — 실제 권한 부여 여부를 도그푸딩`,
    `${bodyIndent}// 실기기에서 확인하기 위한 로그. false여도 시스템이 일반 헤즈업 알림으로`,
    `${bodyIndent}// 자동 대체할 뿐이라 크래시나 알람 미발화로 이어지지 않는다.`,
    `${bodyIndent}if (!androidx.core.app.NotificationManagerCompat.from(context).canUseFullScreenIntent()) {`,
    `${bodyIndent}    Log.w(TAG, "USE_FULL_SCREEN_INTENT not granted by system — falling back to heads-up notification");`,
    `${bodyIndent}}`
  );
  return patched;
}

function withFullScreenIntentHelperPatch(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const helperPath = path.join(config.modRequest.projectRoot, HELPER_JAVA_RELATIVE_PATH);
      const source = fs.readFileSync(helperPath, 'utf8');

      if (source.includes('setFullScreenIntent')) {
        // 같은 node_modules 설치 위에서 prebuild를 다시 돌린 경우 — 이미 패치돼 있으니 스킵.
        return config;
      }

      const eol = source.includes('\r\n') ? '\r\n' : '\n';
      const lines = source.split(/\r\n|\n/);
      const patchedLines = buildPatchedLines(lines);

      if (!patchedLines) {
        throw new Error(
          'withFullScreenAlarmIntent: expo-alarm-module Helper.java에서 패치 대상 코드를 찾지 못했습니다. ' +
            '라이브러리 버전이 바뀌어 코드가 달라졌을 수 있습니다 — plugins/withFullScreenAlarmIntent.js를 ' +
            '새 버전에 맞게 갱신하세요.'
        );
      }

      fs.writeFileSync(helperPath, patchedLines.join(eol));
      return config;
    },
  ]);
}

function withFullScreenIntentManifest(config) {
  config = AndroidConfig.Permissions.withPermissions(config, ['android.permission.USE_FULL_SCREEN_INTENT']);

  return withAndroidManifest(config, (config) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    mainActivity.$['android:showWhenLocked'] = 'true';
    mainActivity.$['android:turnScreenOn'] = 'true';
    return config;
  });
}

const withFullScreenAlarmIntent = (config) => {
  config = withFullScreenIntentManifest(config);
  config = withFullScreenIntentHelperPatch(config);
  return config;
};

module.exports = createRunOncePlugin(withFullScreenAlarmIntent, 'powernap-full-screen-alarm-intent', '1.0.0');
