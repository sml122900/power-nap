// 알람 fire 시 앱 프로세스가 통째로 죽는 크래시 패치 — expo-alarm-module@1.2.0(node_modules) 소스라
// withFullScreenAlarmIntent.js/withAlarmStopVibrationFix.js와 같은 이유로 config plugin 안에서
// patch-package 방식으로 처리한다(android/ 디렉터리는 gitignore라 여기서 해야
// `expo prebuild --clean`에도 재현됨).
//
// 실기기 재현(2026-07-19, Galaxy S24+, 화면 잠금/Doze 상태에서 알람 fire): logcat에
// `ForegroundServiceDidNotStartInTimeException`으로 앱 프로세스 전체가 FATAL EXCEPTION —
// 크래시 후 자동 재시작 없이 죽은 채로 남았다(재현 세션에서 51초간 무응답, 수동 재실행 전까지).
//
// 원인: AlarmReceiver.onReceive()가 startForegroundService()를 부르는 순간 OS의 foreground-service
// 시작 제한시간 타이머가 시작되는데, AlarmService.onStartCommand()는 Storage.getAlarm() →
// Helper.getAlarmNotification()(Bitmap 디코딩 포함) → Manager.start()를 다 마친 뒤에야
// startForeground()를 부른다. 화면 잠금/Doze로 브로드캐스트·서비스 디스패치 자체가 늦춰지는
// 상태에서 이 지연이 겹치면 제한시간을 넘긴다. 화면 켜진 상태로 재현한 여러 낮잠에서는
// 크래시가 재현되지 않았다 — 지연이 짧아 제한시간 안에 들어온 것으로 보임.
//
// 해법(표준 Android 패턴): startForeground()를 무거운 작업보다 먼저, Bitmap 디코딩 없이
// 즉시 만들 수 있는 최소 알림으로 선호출해 제한시간 안에 반드시 걸리게 하고, 실제 알람
// 알림은 그 다음에 만들어 같은 id(1)로 갱신한다(startForeground를 같은 id로 두 번 호출 =
// 알림 갱신, 공식 문서상 안전).
//
// 버전 결합 주의: 아래 ANCHOR 상수는 expo-alarm-module 1.2.0의 정확한 코드와 일치해야
// 패치가 걸린다(withAlarmStopVibrationFix가 이미 null-intent 가드를 앞에 삽입해 둔 상태를
// 전제로 한다 — 이 파일은 항상 withAlarmStopVibrationFix 다음에 적용되어야 함, app.json
// plugins 배열 순서 참고). 라이브러리를 업그레이드하면 이 파일도 다시 확인할 것(안 맞으면
// 조용히 스킵되지 않고 에러를 던지도록 만들어 뒀다).

const { withDangerousMod, createRunOncePlugin } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const ALARM_SERVICE_JAVA_RELATIVE_PATH =
  'node_modules/expo-alarm-module/android/src/main/java/com/expoalarmmodule/AlarmService.java';

const ANCHOR = [
  'String alarmUid = intent.getStringExtra("ALARM_UID");',
  'Alarm alarm = Storage.getAlarm(getApplicationContext(), alarmUid);',
  'Notification notification = Helper.getAlarmNotification(this, alarm, 1);',
  'Manager.start(getApplicationContext(), alarmUid);',
  'startForeground(1, notification);',
];

const ALREADY_PATCHED_MARKER = 'withAlarmForegroundStartFix';

function buildPatchedLines(lines) {
  const startIdx = lines.findIndex((line) => line.trim() === ANCHOR[0]);
  if (startIdx === -1) return null;
  for (let i = 0; i < ANCHOR.length; i++) {
    if (lines[startIdx + i] === undefined || lines[startIdx + i].trim() !== ANCHOR[i]) return null;
  }

  const bodyIndent = lines[startIdx].slice(0, lines[startIdx].indexOf('String'));

  const patched = lines.slice();
  patched.splice(
    startIdx + 1, // "String alarmUid ..." 줄 다음
    0,
    '',
    `${bodyIndent}// PowerNap 패치(${ALREADY_PATCHED_MARKER}) — startForeground()를 무거운 작업(알림 빌드,`,
    `${bodyIndent}// Bitmap 디코딩) 전에 최소 알림으로 즉시 호출해 OS의 foreground-service 시작 제한시간을`,
    `${bodyIndent}// 넘기지 않게 한다(넘기면 ForegroundServiceDidNotStartInTimeException으로 프로세스 전체가`,
    `${bodyIndent}// 죽는다 — 실기기 재현, 화면 잠금/Doze 상태에서 확인됨).`,
    `${bodyIndent}Notification placeholderNotification = new androidx.core.app.NotificationCompat.Builder(`,
    `${bodyIndent}        this, getResources().getString(R.string.notification_channel_id))`,
    `${bodyIndent}    .setSmallIcon(getResources().getIdentifier("ic_launcher", "mipmap", getPackageName()))`,
    `${bodyIndent}    .setContentTitle("Alarm")`,
    `${bodyIndent}    .setPriority(androidx.core.app.NotificationCompat.PRIORITY_MAX)`,
    `${bodyIndent}    .setCategory(androidx.core.app.NotificationCompat.CATEGORY_ALARM)`,
    `${bodyIndent}    .build();`,
    `${bodyIndent}startForeground(1, placeholderNotification);`,
    ''
  );
  return patched;
}

function withAlarmForegroundStartFix(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const filePath = path.join(projectRoot, ALARM_SERVICE_JAVA_RELATIVE_PATH);
      const source = fs.readFileSync(filePath, 'utf8');

      if (source.includes(ALREADY_PATCHED_MARKER)) {
        // 같은 node_modules 설치 위에서 prebuild를 다시 돌린 경우 — 이미 패치돼 있으니 스킵.
        return config;
      }

      const eol = source.includes('\r\n') ? '\r\n' : '\n';
      const lines = source.split(/\r\n|\n/);
      const patchedLines = buildPatchedLines(lines);

      if (!patchedLines) {
        throw new Error(
          `withAlarmForegroundStartFix: ${ALARM_SERVICE_JAVA_RELATIVE_PATH}에서 패치 대상 코드를 찾지 못했습니다. ` +
            `라이브러리 버전이 바뀌었거나 withAlarmStopVibrationFix의 패치 결과와 어긋났을 수 있습니다 — ` +
            `plugins/withAlarmForegroundStartFix.js를 새 버전에 맞게 갱신하세요. (AlarmService.onStartCommand())`
        );
      }

      fs.writeFileSync(filePath, patchedLines.join(eol));
      return config;
    },
  ]);
}

module.exports = createRunOncePlugin(withAlarmForegroundStartFix, 'powernap-alarm-foreground-start-fix', '1.0.0');
