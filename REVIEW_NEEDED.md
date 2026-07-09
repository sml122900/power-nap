# 영어 번역 검수 필요 목록

`locales/en.json`은 사용자가 직접 영어 검수를 할 수 없는 상태에서 기계 번역으로 작성됨.
아래 항목은 오역·어색한 표현·법적/안전 문구 리스크가 있어 원어민 검수를 권장한다.
우선순위 순으로 정렬(1순위 = 가장 먼저 검수).

## 1순위 — 알람/안전 관련 (해제 방법, 권한 안내) — 검수 완료

이 카테고리는 사용자가 실제로 알람을 끄는 방법을 이해하지 못하면 제품 핵심 기능이
실패하는 곳이라 가장 먼저 검수했다. `slideLabel`/`permissionHint`는 아래 "해결됨"으로
이동, 나머지는 검수 완료 — 수정 불필요.

| 키 | 영어 | 검수 결과 |
|---|---|---|
| `alarm.longPressHint` | If sliding is hard, press and hold this area for 3 seconds instead | 검수 완료 — 수정 불필요. 대체 해제 수단 지시가 명확함 |
| `alarm.a11ySlideLabel` | Slide to turn off alarm | 검수 완료 — 수정 불필요 |
| `alarm.a11yDismissAction` | Turn off alarm | 검수 완료 — 수정 불필요 |
| `alarm.notificationTitle` / `alarm.notificationBody` | Time to wake up / Your PowerNap alarm is ringing. | 검수 완료 — 수정 불필요. OS 알림 그대로 노출되는 문구, 짧고 명확함 |

## 2순위 — 의학 관련 고지문 — 검수 완료, 수정 불필요

| 키 | 영어 | 검수 결과 |
|---|---|---|
| `analysisReport.disclaimer` | This report is general sleep hygiene information, not a medical diagnosis or advice. If symptoms persist, please consult a professional. | 검수 완료 — 수정 불필요. "의학적 조언이 아니다"는 단정 강도가 원문과 동등하게 유지됨 |
| `alarm.subtitle` | 5 more minutes will only leave you groggier from sleep inertia.\nGetting up right now feels best. | 검수 완료 — 수정 불필요. "sleep inertia"가 과장된 의학적 단정으로 읽히지 않음(일반 수면위생 용어 수준) |

## 3순위 — 동의/개인정보 관련 문구 — 검수 완료, 수정 불필요

| 키 | 영어 | 검수 결과 |
|---|---|---|
| `analysisConsent.paragraph1` | To generate the analysis, your nap records (times, survey answers, notes) are sent to our server. The data sent is used only to create suggestions and advice for adjusting your wait time and caffeine onset time. | 검수 완료 — 수정 불필요. 데이터 사용 범위 제한("used only to")이 정확히 대응됨 |
| `analysisConsent.paragraph2` | Suggestions are for reference only — they're applied to your settings only when you tap to apply them yourself. | 검수 완료 — 수정 불필요. "only when you tap"이 자동 반영 없음을 명확히 함 |

## 4순위 — 관용구·톤·문장 구조 리스크 (미해결 항목만 남김)

| 키 | 한국어 원문 | 영어 초안 | 검수 포인트 |
|---|---|---|---|
| `home.coffeeNotice` | 카페인이 이미 돌고 있어요 — 최소 대기시간으로 맞출게요 | Caffeine is already kicking in — we'll set the minimum wait time | "카페인이 돌고 있다"는 관용 표현의 영어 대응이 자연스러운지 — **아직 미검수** |
| `settings.inputA11y` | {{label}} 분 직접 입력 ({{min}}~{{max}}) | Enter minutes directly for {{label}} ({{min}}–{{max}}) | label이 문장 중간에 삽입되는 구조 — 어순이 어색하지 않은지 — **아직 미검수** |
| `analysisReport.paymentPlaceholder` | 추가 분석 1,000원 (준비 중) | Extra analysis ₩1,000 (coming soon) | 원화(₩) 표기를 영어 사용자에게도 그대로 보여줄지 — 결제 기능 자체가 아직 비활성이라 급하지 않음, Phase E(결제 활성화) 시점에 지역별 통화 표기 재검토 — **아직 미검수(Phase E로 이관)** |
| `analysisReport.networkError` / `analysisReport.unknownError` | 네트워크 연결을 확인해달라. / 알 수 없는 오류가 발생했다. | Please check your network connection. / An unknown error occurred. | 톤이 다른 문구(정중체)와 살짝 다름(원문부터 그랬음, "~해달라"체) — 그대로 직역, 문체 통일 여부 — **아직 미검수** |

## 해결됨 (2차 검수 — 사용자 지시로 수정)

- ~~`sleep.permissionHint`가 Android에서 실제와 다른 내용을 안내하던 문제(원문 자체가
  틀림)~~ — **코드 확인 중 새 버그 발견**: `src/notifications.ts`의
  `scheduleAlarmNotificationAsync`는 알림 권한이 거부되면 **함수 최상단에서 즉시
  `null`을 반환**한다. 즉 Android에서도 네이티브 알람(`scheduleAlarm`, STREAM_ALARM)
  자체가 예약되지 않는다 — "앱을 켠 채로 두면 알람이 울려요"는 사실이 아니라 실제로는
  **아예 안 울린다**. `app/sleep.tsx`에서 `Platform.OS`로 분기해 iOS는 기존 문구(foreground
  JS 타이머가 실제 주 레이어라 사실과 맞음) 그대로 두고, Android는 경고 문구
  ("알림 권한이 없으면 알람이 울리지 않을 수 있어요 — 설정에서 허용해주세요" /
  "The alarm may not ring without notification permission — please allow it in
  Settings")로 교체. **문구만 고쳤을 뿐, 근본 원인(Android가 알림 권한 거부 시
  STREAM_ALARM 알람 자체를 건너뛰는 것 — expo-alarm-module의 알람 스케줄링은
  README 기준 알림 권한과 무관해 보이는데도 이 함수가 조건 분기 없이 먼저 막고 있음)은
  이번 커밋 범위 밖 — CLAUDE.md "알람 신뢰성이 제품의 생명" 원칙에 직결되는 별도
  버그 수정이 필요하다.**
- ~~`alarm.slideLabel` "Slide to stop"이 알람 앱 관용 표현과 다름~~ — "Slide to
  dismiss"로 교체(사용자 지시).
- ~~`feedback.toastManualAdjust`의 보간 변수 3개가 이어붙어 어색함~~ — "Next time,
  {{modeName}} {{label}} will be set to {{minutes}} min." → "'{{modeName}}'
  {{label}} set to {{minutes}} min for next time."로 재구성(따옴표로 mode명을
  시각적으로 분리, 사용자 지시).
- ~~`analysisHistory.listLabel`의 "{{month}}/{{day}}" 숫자 표기가 MM/DD·DD/MM으로
  헷갈릴 수 있던 문제~~ — `src/format.ts`에 `formatShortDate` 신규(언어별 월 이름
  포맷터, ko "7월 8일" / en "Jul 8"), `analysisDisplay.ts`가 이제 이 함수로 만든
  문자열을 `{{date}}`로 보간(과거의 `{{month}}`/`{{day}}` 숫자 보간 방식 폐지).

## 해결됨 (1차, AI 분석 에러 메시지)

- ~~AI 분석 에러 메시지가 서버 `message`(한국어 하드코딩)를 그대로 노출해 앱이 영어
  모드여도 한국어로 표시되던 문제~~ — `analyze` Edge Function의 JSON 에러 응답에서
  `error`(안정적 snake_case 코드)만 신뢰하도록 계약을 확정하고, `message`는 서버
  로그/디버그 전용 영어 텍스트로 전환(index.ts 상단 "에러 응답 규칙" 주석 참고).
  클라이언트(`src/aiAnalysisErrors.ts`)는 이제 `error` 코드를
  `locales/*.json`(`analysisReport.serverError.*`)로 직접 매핑해 표시 문구를 만든다
  (`SERVER_ERROR_MESSAGE_KEY: Record<AnalysisErrorCode, string>` — 새 코드 추가 시
  매핑 누락하면 TS 컴파일 에러로 잡힘). 이 분리 덕분에 새 언어를 추가해도 Edge
  Function은 전혀 안 건드려도 된다(사용자 지시로 수정, CLAUDE.md에도 원칙 기록).

## 해결됨 (learnNote 문구)

- ~~`home.learnNote`가 Phase 4-3 자동 조정 폐지 이후에도 "자동으로 조정돼요"라고
  남아있던 문제~~ — ko.json/en.json 양쪽 모두 실제 동작(문헌 기반 고정값 + 수동
  조정)에 맞게 문구 교체 완료(사용자 지시로 수정).
