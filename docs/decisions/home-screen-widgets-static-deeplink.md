# 홈 화면 위젯 — 헤드리스 JS 대신 정적 위젯 + 딥링크

## Problem

"앱을 열지 않고 홈 화면 버튼 하나로 낮잠 알람을 건다"는 목표로 Android 홈 위젯을
검토했다. 위젯 버튼 탭이 JS 알람 로직(`scheduleAlarmNotificationAsync`/`getSettings`
등, `src/store.ts`·`src/notifications.ts`)을 어떻게 호출하느냐가 핵심 난제였다 —
위젯은 네이티브, 예약 로직은 JS에 있다.

두 갈래를 조사했다:

1. **헤드리스 JS**(`react-native-android-widget`의 `registerWidgetTaskHandler`) —
   앱을 전혀 열지 않고 백그라운드에서 JS를 실행해 기존 로직을 그대로 재사용할 수
   있어 "안 열고"라는 목표에 가장 가까웠다. 그러나 (1) 앱 프로세스가 완전히 종료된
   상태에서 실제로 기동되는지가 라이브러리 문서에 전혀 없고, (2) 삼성 One UI는
   "3일간 미실행 앱은 백그라운드 태스크(알람 포함) 정지"라는 공격적인 정책을 쓴다
   (dontkillmyapp.com) — 이 프로젝트의 실제 타겟 기기(Galaxy S24+)에서 정확히 이
   조합이 문제가 될 위험이 있는데 실기기 스파이크 없이는 검증 불가능한 미지수였다.
2. **앱을 열어서 처리** — 위젯 탭 → 딥링크로 앱이 열리고, 이미 검증된 JS 경로를
   그대로 탄다. "완전히 안 열림"이라는 이상에는 못 미치지만, 신뢰성 리스크가
   거의 없다(기존 앱 실행 경로와 동일).

## Action

헤드리스 JS를 채택하지 않고 2번(앱 열림 + 딥링크)으로 확정했다:

1. **위젯 3종(S/M/L)**을 `plugins/withHomeScreenWidgets.js`(신규 config plugin)로
   심었다. 위젯 내용이 완전히 정적(잔여시간 표시·실시간 갱신 없음 — 스코프 결정)이라
   JS로 위젯을 렌더링할 이유가 없어졌고, 그래서 `react-native-android-widget` 같은
   서드파티 라이브러리 없이 바닐라 `AppWidgetProvider` + `RemoteViews` XML로
   구현했다 — 새 네이티브 의존성을 안 늘리는 선택. 기존 네이티브 패치 플러그인들
   (`withFullScreenAlarmIntent.js`/`withAlarmStopVibrationFix.js`/
   `withAlarmForegroundStartFix.js`)과 파일이 전혀 겹치지 않아(전부 신규 파일 추가,
   기존 라이브러리 소스 텍스트 패치 없음) 공존 리스크가 그 패치들보다도 낮다.
2. **브릿지 = 딥링크**: 위젯 버튼의 `PendingIntent`가
   `ACTION_VIEW, powernap:///?widgetMode=fast|slow|coffee`를 연다 — `app.json`에
   이미 있던 `scheme: "powernap"`을 그대로 재사용, 새 네이티브 인텐트-익스트라
   브릿지를 만들지 않았다.
3. **앱 쪽 실행은 기존 함수 그대로**: `app/index.tsx`에 `handleWidgetModeEntry`(모듈
   스코프 함수, 컴포넌트 바깥)를 추가해 `resolveWidgetModeAction`(순수 함수,
   `src/store.ts`)의 판정 결과를 기존 `startFastSlow`/커피냅 인라인 패널 토글에
   연결만 한다 — 위젯 전용 새 알람 예약 경로를 만들지 않았다(CLAUDE.md "예약/취소는
   반드시 쌍" 원칙과 같은 이유로, `latency`/`caffeineOnset` 계산 로직이 JS·네이티브
   두 곳에 따로 존재하면 드리프트 위험이 커진다).
4. **재탭 가드**: `useNapWatchdog`의 비동기 리다이렉트 타이밍과 경쟁하지 않도록,
   `handleWidgetModeEntry`가 `getActiveNap()`을 독립적으로 먼저 확인한다 — 이미
   낮잠 중이면 어떤 모드로 탭해도 기존 알람을 그대로 두고 안내만 띄운다.
5. **커피냅은 새 화면이 아니라 기존 인라인 패널을 펼침**: `RemoteViews`는 정적
   뷰라 위젯 안에서 시각 입력을 받을 수 없다 — 위젯에서 "커피냅" 탭 시
   `setCoffeeOpen(true)`만 호출해 홈 화면의 기존 칩+직접입력 UI를 그대로 재사용한다.
6. **위젯 얼굴 텍스트는 디바이스 언어를 따름**(`res/values/`·`res/values-ko/`),
   앱 내부 언어 설정(`i18n.ts`의 수동 선택)과는 독립이다 — 사용자가 앱 언어를
   디바이스와 다르게 설정하면 위젯·앱 언어가 어긋날 수 있음을 감수하기로
   확정했다(스코프 부풀리지 않기 — 불일치 시 위젯을 다시 갱신하는 네이티브 브릿지는
   만들지 않음, v1.1+ 재검토 대상).
7. 위젯 얼굴의 "n분 뒤" 같은 상세 문구는 실시간 계산이 필요해(설정의 `latency` 값을
   네이티브가 알 방법이 없음, 헤드리스를 안 쓰기로 한 것과 같은 제약) 숫자 없는
   고정 안내 문구("탭하면 지금 알람이 맞춰져요")로 대체했다 — 목업 승인 당시의
   시각적 예시 문구(실제 시각 표시)와는 다른 최종 결정이라 REVIEW_NEEDED에 남긴다.

## Result

`expo prebuild --clean`을 두 번 연속 실행해 기존 4개 패치(풀스크린 인텐트/진동
정지/포그라운드 크래시 수정)와 위젯 플러그인이 전부 정상 적용되고 재실행해도
`AndroidManifest`에 중복 receiver가 생기지 않음을 확인했다. `gradlew assembleDebug`로
실제 Kotlin 컴파일까지 통과, `aapt dump xmltree`로 최종 APK의
`AndroidManifest.xml`에 위젯 receiver 3개가 `exported="true"`로 박혀있음을
직접 확인했다.

미해결: 실기기(Galaxy S24+)에서의 홈 배치·딥링크 콜드스타트·재탭 가드 동작은 adb
기기 미연결로 이번 세션에서 검증 못 함 — 기기 연결 후 별도 진행.

헤드리스 JS를 포기한 대신 얻은 것: 새 리스크 표면(프로세스 킬 상태에서의 백그라운드
서비스 기동, 삼성 배터리 최적화와의 상호작용)을 아예 만들지 않았다. "완전히 안
열림"이라는 이상보다 "검증 가능한 신뢰성"을 우선한 선택 — 이 프로젝트의 최우선
원칙(CLAUDE.md "알람 신뢰성이 제품의 생명")과 정확히 같은 방향의 판단이다.
