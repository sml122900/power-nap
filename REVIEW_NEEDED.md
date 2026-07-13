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

### 신규 추가 (미검수) — 권한 거부 시나리오 실기기 검증 후 문구 확정

`sleep.permissionHintAndroid`를 실기기 검증 결과(소리·진동은 권한 무관 발화, 화면
자동점등만 권한 필요)에 맞게 재작성하고 `sleep.permissionButton`(설정 딥링크 버튼)을
신규 추가했다. 기계 번역이라 원어민 검수 전.

| 키 | 영어 | 검수 포인트 |
|---|---|---|
| `sleep.permissionHintAndroid` | The alarm sound and vibration will play. However, without notification permission the screen won't turn on automatically — please open the app yourself to turn off the alarm when it rings. | 두 문장이 길게 이어짐 — 안전 관련 문구라 가장 먼저 검수 필요, 어색하면 문장 분리 검토 — **아직 미검수** |
| `sleep.permissionButton` | Allow permission | (갱신) 이제 `expo-intent-launcher`로 앱의 "알림" 설정 화면에 직행한다(실패 시에만 일반 설정으로 폴백) — 문구 자체는 여전히 미검수 |

### 신규 추가 (미검수) — 알람 해제 미션(명언 타이핑, `mission-alarm` 브랜치)

미션이 켜져 있으면 이 화면이 실제로 알람을 끄는 유일한 경로(건너뛰기 없음)라 1순위로
분류. 명언 원문 자체(`src/missionQuotes.ts`, ko/en 각 18개, 전부 자체 작성)는 UI
문자열이 아니라 이 파일이 아닌 코드에 있으므로 표에는 화면 문구만 올린다 — 명언
원문의 영어 표현 자연스러움도 함께 검수 권장.

| 키 | 영어 | 검수 포인트 |
|---|---|---|
| `mission.instruction` | Type the sentence below exactly | "exactly"가 과하게 엄격한 인상을 주는지(실제로는 대소문자·구두점·공백 관대) — **아직 미검수** |
| `mission.retryHint` | Please type it exactly | 위와 같은 이유로 사용자가 "정말 토씨 하나까지"로 오해할 수 있는지 — **아직 미검수** |
| `mission.quoteSwapped` | Switched to a different sentence | 실패로 인한 전환이라는 뉘앙스가 부정적으로 느껴지지 않는지(중립적 안내 톤 유지 확인) — **아직 미검수** |
| `settings.missionOnDescription` | On — when the alarm rings, you must type a sentence to dismiss it | "you must"의 단정 강도가 원문 "해제할 수 있어요"보다 강압적으로 읽히는지 — **아직 미검수** |
| `src/missionQuotes.ts`의 en 배열 전체 | (18개 문구) | 자체 작성 영어 문구라 원어민 자연스러움 검수가 특히 필요 — **아직 미검수** |

#### 신규 추가 (미검수) — 순서 변경(슬라이드 먼저 → 명언 나중) + 설정 명언 목록 편집

미션이 켜져 있을 때 알람 화면의 슬라이드/롱프레스가 "알람 끄기"가 아니라 "다음
단계(명언)로 넘어가기"로 의미가 바뀌어(사용자 지시), 문구도 새로 분리했다. 명언
목록을 설정 화면에서 직접 편집할 수 있게 된 것도 이번 변경.

| 키 | 영어 | 검수 포인트 |
|---|---|---|
| `alarm.slideLabelMission` | Slide to continue | 미션이 켜진 상태에서도 사용자가 "이거 슬라이드하면 알람이 꺼지는 건가?"로 오해하지 않는지 — **아직 미검수** |
| `alarm.longPressHintMission` | If sliding is hard, press and hold this area for 3 seconds to continue instead | 위와 같은 맥락, 문장이 다소 길어 자연스러운지 — **아직 미검수** |
| `alarm.a11ySlideLabelMission` | Slide to continue to the next step | 스크린리더용 — 의미 전달이 명확한지 — **아직 미검수** |
| `alarm.a11yDismissActionMission` | Continue to next step | 위와 동일 — **아직 미검수** |
| `settings.missionQuotesLink` | Edit quotes | 짧은 링크 라벨이라 리스크 낮음 — **아직 미검수** |
| `missionQuotes.title` | Edit quotes | 화면 헤더, settings.missionQuotesLink와 동일 문구 — **아직 미검수** |
| `missionQuotes.textPlaceholder` | Quote | 짧은 placeholder — 리스크 낮음 — **아직 미검수** |
| `missionQuotes.authorPlaceholder` | Attributed to | "말한 사람"의 번역으로 자연스러운지(나중에 실존 인물 명언·출처 추가 시 이 필드에 채워짐) — **아직 미검수** |
| `missionQuotes.delete` | Delete | 표준적 표현 — **아직 미검수** |
| `missionQuotes.add` | + Add quote | 표준적 표현 — **아직 미검수** |
| `mission.quoteAuthor` | — {{author}} | 인용 표기 관례(em dash)가 두 언어 모두에서 자연스러운지 — **아직 미검수** |

## 2순위 — 의학 관련 고지문 — 검수 완료, 수정 불필요

| 키 | 영어 | 검수 결과 |
|---|---|---|
| `analysisReport.disclaimer` | This report is general sleep hygiene information, not a medical diagnosis or advice. If symptoms persist, please consult a professional. | 검수 완료 — 수정 불필요. "의학적 조언이 아니다"는 단정 강도가 원문과 동등하게 유지됨 |
| `alarm.subtitle` | 5 more minutes will only leave you groggier from sleep inertia.\nGetting up right now feels best. | 검수 완료 — 수정 불필요. "sleep inertia"가 과장된 의학적 단정으로 읽히지 않음(일반 수면위생 용어 수준) |

### 신규 추가 (미검수) — "파워냅이란?" 정보 화면(`about-powernap` 브랜치)

`app/about.tsx` 5개 섹션 본문 — 문헌 근거를 요약한 건강 정보 문구라 이 카테고리로
분류. 장기 건강효과·진단/치료 표현은 이미 배제하고 썼지만(작성 규칙 참고), 영어
문장이 원문보다 단정적으로 읽히지 않는지 원어민 검수 필요. 5개 섹션(`about.section1`~
`section5`) + `about.disclaimer` 전부 대상 — 분량이 많아 표 대신 파일 직접 확인 권장
(`locales/en.json`의 `about` 네임스페이스). 특히 `section1`의 "which can leave you
feeling worse instead of better"와 `section5`의 "that may be a sign you're not
sleeping enough at night"가 원문("개운함이 떨어질 수 있어요"/"밤잠 자체가 부족하다는
신호일 수 있어요")보다 단정 강도가 세게 읽히는지 우선 확인 — **아직 미검수**.

## 3순위 — 동의/개인정보 관련 문구 — 검수 완료, 수정 불필요

| 키 | 영어 | 검수 결과 |
|---|---|---|
| `analysisConsent.paragraph1` | To generate the analysis, your nap records (times, survey answers, notes) are sent to our server. The data sent is used only to create suggestions and advice for adjusting your wait time and caffeine onset time. | 검수 완료 — 수정 불필요. 데이터 사용 범위 제한("used only to")이 정확히 대응됨 |
| `analysisConsent.paragraph2` | Suggestions are for reference only — they're applied to your settings only when you tap to apply them yourself. | 검수 완료 — 수정 불필요. "only when you tap"이 자동 반영 없음을 명확히 함 |

### 신규 추가 (미검수) — 서버 데이터 삭제 기능(설정 화면 2단계 확인)

`app/settings.tsx`의 "서버 데이터 삭제" 확인 다이얼로그(Alert.alert 2단계) 문구.
파괴적 동작(되돌릴 수 없는 삭제) 안내라 1순위와 비슷한 수준으로 신중한 검수가 필요.

| 키 | 영어 | 검수 포인트 |
|---|---|---|
| `settings.deleteConfirmBody` | Analysis reports, usage history, and credits will be permanently deleted from the server. Nap records stored on this device will remain. | "permanently"의 단정 강도가 원문 "영구히"와 대응되는지, 로컬 기록은 남는다는 대비가 명확한지 — **아직 미검수** |
| `settings.deleteConfirmCreditWarning` | {{count}} remaining credit(s) will be deleted too and cannot be recovered. | 환불 분쟁 방지 목적 문구라 "cannot be recovered"의 단정이 원문과 동일한 강도인지 — **아직 미검수** |
| `settings.deleteFinalBody` | This action cannot be undone. | 짧고 표준적인 표현이라 리스크는 낮지만 최종 확인 단계라 우선순위 유지 — **아직 미검수** |

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
