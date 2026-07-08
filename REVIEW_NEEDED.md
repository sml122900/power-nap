# 영어 번역 검수 필요 목록

`locales/en.json`은 사용자가 직접 영어 검수를 할 수 없는 상태에서 기계 번역으로 작성됨.
아래 항목은 오역·어색한 표현·법적/안전 문구 리스크가 있어 원어민 검수를 권장한다.
우선순위 순으로 정렬(1순위 = 가장 먼저 검수).

## 1순위 — 알람/안전 관련 (해제 방법, 권한 안내)

이 카테고리는 사용자가 실제로 알람을 끄는 방법을 이해하지 못하면 제품 핵심 기능이
실패하는 곳이라 가장 먼저 검수해야 한다.

| 키 | 한국어 원문 | 영어 초안 | 검수 포인트 |
|---|---|---|---|
| `alarm.longPressHint` | 슬라이드가 어렵다면 이 영역을 3초간 눌러도 꺼져요 | If sliding is hard, press and hold this area for 3 seconds instead | 대체 해제 수단 안내 — 지시가 명확한지 |
| `alarm.a11ySlideLabel` | 밀어서 알람 끄기 | Slide to turn off alarm | 스크린리더 사용자의 유일한 해제 방법 설명 |
| `alarm.a11yDismissAction` | 알람 끄기 | Turn off alarm | 위와 동일 맥락 |
| `alarm.slideLabel` | 밀어서 끄기 | Slide to stop | 트랙 위 표시 문구, 짧고 명확해야 함 |
| `alarm.notificationTitle` / `alarm.notificationBody` | 일어날 시간이에요 / 파워냅 알람이 울리고 있어요. | Time to wake up / Your PowerNap alarm is ringing. | OS 알림에 그대로 노출(앱 밖에서 보임) |
| `sleep.permissionHint` | 앱을 켠 채로 두면 알람이 울려요 | Keep the app open for the alarm to ring | 알림 권한 거부 시 사용자가 반드시 이해해야 하는 조건 |

## 2순위 — 의학 관련 고지문

CLAUDE.md "의학적 표현 제한" 요구사항과 직결 — 과장되거나 애매하게 번역되면 규정 위반 리스크.

| 키 | 한국어 원문 | 영어 초안 | 검수 포인트 |
|---|---|---|---|
| `analysisReport.disclaimer` | 이 리포트는 일반적인 수면 위생 정보이며 의학적 진단이나 조언이 아닙니다. 증상이 지속되면 전문가와 상담해주세요. | This report is general sleep hygiene information, not a medical diagnosis or advice. If symptoms persist, please consult a professional. | "의학적 조언이 아니다"는 단정이 영어에서도 동일한 강도로 읽히는지 |
| `alarm.subtitle` | 5분 더 자면 수면 관성 때문에 더 멍해져요.\n지금 바로 일어나는 게 제일 개운합니다. | 5 more minutes will only leave you groggier from sleep inertia.\nGetting up right now feels best. | "수면 관성" 같은 생리학 용어 번역이 과장된 의학적 단정처럼 안 읽히는지 |

## 3순위 — 동의/개인정보 관련 문구 (스토어 등록정보는 아니지만 법적 뉘앙스 있음)

| 키 | 한국어 원문 | 영어 초안 | 검수 포인트 |
|---|---|---|---|
| `analysisConsent.paragraph1` | 분석을 위해 낮잠 기록(수면 시각·설문·메모)이 서버로 전송됩니다. 전송된 기록은 대기시간·카페인 발현시간 조정 제안과 조언을 만드는 데만 쓰입니다. | To generate the analysis, your nap records (times, survey answers, notes) are sent to our server. The data sent is used only to create suggestions and advice for adjusting your wait time and caffeine onset time. | 데이터 사용 범위 제한("만 쓰입니다")이 정확히 대응되는지 |
| `analysisConsent.paragraph2` | 제안은 참고용이며, 실제 설정 반영은 항상 직접 눌러야만 적용됩니다. | Suggestions are for reference only — they're applied to your settings only when you tap to apply them yourself. | "항상"의 강조가 유지되는지(자동 반영 없음을 분명히) |

## 4순위 — 관용구·톤·문장 구조 리스크

| 키 | 한국어 원문 | 영어 초안 | 검수 포인트 |
|---|---|---|---|
| `feedback.toastManualAdjust` | 다음 {{modeName}}은 {{label}} {{minutes}}분으로 맞춰둘게요. | Next time, {{modeName}} {{label}} will be set to {{minutes}} min. | 한국어는 명사 3개를 이어 붙이는 어순이라 영어로 그대로 보간하면 어색할 위험 큼(예: "Next time, Fall asleep fast wait time will be set to 5 min.") — 문장 구조 자체를 다시 짜야 할 수도 |
| `home.coffeeNotice` | 카페인이 이미 돌고 있어요 — 최소 대기시간으로 맞출게요 | Caffeine is already kicking in — we'll set the minimum wait time | "카페인이 돌고 있다"는 관용 표현의 영어 대응이 자연스러운지 |
| `settings.inputA11y` | {{label}} 분 직접 입력 ({{min}}~{{max}}) | Enter minutes directly for {{label}} ({{min}}–{{max}}) | label이 문장 중간에 삽입되는 구조 — 어순이 어색하지 않은지 |
| `analysisHistory.listLabel` | {{month}}월 {{day}}일 분석 | Analysis — {{month}}/{{day}} | MM/DD 표기가 지역에 따라 DD/MM으로 오해될 수 있음(예: "7/8"이 7월 8일인지 8월 7일인지) — 월 이름 표기(예: "Jul 8")로 바꿀지 검토 |
| `analysisReport.paymentPlaceholder` | 추가 분석 1,000원 (준비 중) | Extra analysis ₩1,000 (coming soon) | 원화(₩) 표기를 영어 사용자에게도 그대로 보여줄지 — 결제 기능 자체가 아직 비활성이라 급하지 않음, Phase E(결제 활성화) 시점에 지역별 통화 표기 재검토 |
| `analysisReport.networkError` / `analysisReport.unknownError` | 네트워크 연결을 확인해달라. / 알 수 없는 오류가 발생했다. | Please check your network connection. / An unknown error occurred. | 톤이 다른 문구(정중체)와 살짝 다름(원문부터 그랬음, "~해달라"체) — 그대로 직역, 문체 통일 여부는 검수 시 판단 |

## 해결됨 (추가)

- ~~AI 분석 에러 메시지가 서버 `message`(한국어 하드코딩)를 그대로 노출해 앱이 영어
  모드여도 한국어로 표시되던 문제~~ — `analyze` Edge Function의 JSON 에러 응답에서
  `error`(안정적 snake_case 코드)만 신뢰하도록 계약을 확정하고, `message`는 서버
  로그/디버그 전용 영어 텍스트로 전환(index.ts 상단 "에러 응답 규칙" 주석 참고).
  클라이언트(`src/aiAnalysisErrors.ts`)는 이제 `error` 코드를
  `locales/*.json`(`analysisReport.serverError.*`)로 직접 매핑해 표시 문구를 만든다
  (`SERVER_ERROR_MESSAGE_KEY: Record<AnalysisErrorCode, string>` — 새 코드 추가 시
  매핑 누락하면 TS 컴파일 에러로 잡힘). 이 분리 덕분에 새 언어를 추가해도 Edge
  Function은 전혀 안 건드려도 된다(사용자 지시로 수정, CLAUDE.md에도 원칙 기록).

## 해결됨

- ~~`home.learnNote`가 Phase 4-3 자동 조정 폐지 이후에도 "자동으로 조정돼요"라고
  남아있던 문제~~ — ko.json/en.json 양쪽 모두 실제 동작(문헌 기반 고정값 + 수동
  조정)에 맞게 문구 교체 완료(사용자 지시로 수정).
