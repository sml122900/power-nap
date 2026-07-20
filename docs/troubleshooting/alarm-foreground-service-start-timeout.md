# 화면 잠금 상태에서 알람 fire 시 앱 프로세스 전체가 죽던 크래시

## 문제상황

`wake-routine-resume` 브랜치의 실기기 체크리스트(스와이프→기상루틴 이어받기,
콜드스타트 복구, 체험모드)를 검증하던 중, 화면 잠금 상태로 알람 fire를 기다리던
낮잠 1건에서 앱이 51초간 완전히 무응답 상태로 남았다가에서야 발견됐다. 처음엔
`useNapWatchdog`의 orphan 정리 로직(알림 스와이프로 네이티브 알람만 죽고
`ActiveNap`은 JS에 남는 경로를 감지하는 코드, 이번 세션에서 막 추가/확장한 기능)이
네이티브 알람 상태를 오판해 자체적으로 취소하는 좁은 타이밍 레이스로 추정하고,
BACKLOG.md에 "구조적, 저심각도" 항목으로 기록했다.

## 시도한 것들

1. **1차 가설 — JS 폴링 레이스**: `isNativeAlarmActiveAsync` 폴링과 네이티브 알람
   fire 사이의 상태 반영 지연이 원인이라고 가정하고, "회귀 아님/저심각도/재현
   어려움"으로 판단해 BACKLOG.md에 v1.1+ 검토 항목으로만 남기고 넘어가려 했다.
2. 체크리스트 나머지 항목(D-3, F-3, F-4, G)을 계속 진행하다가, 사용자 지시로
   logcat 전체 스택을 다시 확인했다. 거기서 처음으로
   `ForegroundServiceDidNotStartInTimeException`이 찍힌 FATAL EXCEPTION을
   발견했다 — watchdog의 오판이 아니라 **앱 프로세스 자체가 OS에 의해 강제
   종료**된 것이었다.
3. `expo-alarm-module`(node_modules) 소스를 추적했다. `AlarmReceiver.onReceive()`가
   API 26+에서 `context.startForegroundService()`를 호출하는 순간 OS의
   foreground-service 시작 제한시간 타이머가 시작되는데, 실제
   `AlarmService.onStartCommand()`는 `Storage.getAlarm()` →
   `Helper.getAlarmNotification()`(내부에서 `BitmapFactory.decodeResource`로
   아이콘 비트맵을 디코딩) → `Manager.start()`를 전부 마친 뒤에야
   `startForeground()`를 호출하고 있었다. 화면 켜진 상태로 재현한 여러 낮잠에서는
   크래시가 없었던 것도, 화면 잠금/Doze 상태에서만 브로드캐스트·서비스 디스패치
   자체가 늦춰져 이 지연과 겹쳐야 제한시간을 넘긴다는 걸로 설명됐다.

## 최종 해결법

라이브러리를 fork하지 않고, 이 프로젝트에 이미 있던 patch-package-in-config-plugin
패턴(`withFullScreenAlarmIntent.js`, `withAlarmStopVibrationFix.js`)을 그대로 따라
`plugins/withAlarmForegroundStartFix.js`를 새로 만들었다. `AlarmService.onStartCommand()`
맨 앞에서 Bitmap 디코딩이 필요 없는 최소 알림으로 `startForeground()`를 즉시
선호출해 OS 제한시간 안에 반드시 걸리게 하고, 실제 알람 알림은 그 다음 만들어
같은 id(1)로 갱신한다(`startForeground`를 같은 id로 두 번 호출하는 건 알림 갱신으로
공식 문서상 안전).

```java
// AlarmService.onStartCommand() 맨 앞, alarmUid를 꺼낸 직후
Notification placeholderNotification = new NotificationCompat.Builder(this, channelId)
    .setSmallIcon(...).setContentTitle("Alarm")
    .setPriority(NotificationCompat.PRIORITY_MAX)
    .setCategory(NotificationCompat.CATEGORY_ALARM)
    .build();
startForeground(1, placeholderNotification); // 제한시간 안에 반드시 호출

Alarm alarm = Storage.getAlarm(...);
Notification notification = Helper.getAlarmNotification(this, alarm, 1); // 느린 작업
Manager.start(...);
startForeground(1, notification); // 같은 id로 실제 알림으로 갱신
```

실기기에서 동일한 화면 잠금 조건으로 재현해, 패치 후에는 logcat에
`ForegroundServiceDidNotStartInTimeException`/FATAL EXCEPTION이 없고 `ps`로
프로세스가 살아있음을 확인했다. 알람 화면 자체의 시각적 확인은 기기의 보안
잠금(PIN/패턴)이 adb 입력을 막아 못 했다 — 로그·프로세스 레벨 증거로 대체.

## 이력서 소재 한 줄

"좁은 타이밍 레이스"로 저심각도 오판했던 버그를 logcat 전체 스택 재확인으로
Android `ForegroundServiceDidNotStartInTimeException`에 의한 앱 프로세스 전체
강제종료임을 재규명하고, 서드파티 네이티브 모듈(`expo-alarm-module`)의 소스를
직접 추적해 무거운 알림 빌드(Bitmap 디코딩)가 `startForeground()` 호출을 지연시키는
게 근본 원인임을 특정, 표준 Android 패턴(최소 알림 선호출 후 갱신)으로 라이브러리
fork 없이 config-plugin 패치로 수정해 실기기 재현 테스트로 검증했다.
