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
분류. 명언 원문 자체(`src/missionQuotes.ts`, ko/en 각 20개)는 UI 문자열이 아니라 이
파일이 아닌 코드에 있으므로 표에는 화면 문구만 올린다 — 영어 20개 전문은 "4순위"
섹션 참고(고전 인용 원문/직역 확인 목적, 자체 작성이 아니게 되면서 리스크 성격이
바뀜).

| 키 | 영어 | 검수 포인트 |
|---|---|---|
| `mission.instruction` | Type the sentence below exactly | "exactly"가 과하게 엄격한 인상을 주는지(실제로는 대소문자·구두점·공백 관대) — **아직 미검수** |
| `mission.retryHint` | Please type it exactly | 위와 같은 이유로 사용자가 "정말 토씨 하나까지"로 오해할 수 있는지 — **아직 미검수** |
| `settings.missionOnDescription` | On — when the alarm rings, you must type a sentence to dismiss it | "you must"의 단정 강도가 원문 "해제할 수 있어요"보다 강압적으로 읽히는지 — **아직 미검수** |

#### 신규 추가 (미검수) — 3회 실패 시 탈출 문구로 전환(`quotes-classical` 브랜치)

"더 짧은 명언으로 교체"(`mission.quoteSwapped`, 이제 폐기된 키) 대신 3회 연속
실패하면 고정 탈출 문구(`ESCAPE_PHRASE`)를 요구하는 방식으로 바꿨다 — 이게 최종
탈출구라 안내 문구가 실제로 이해되는지가 더 중요해져 1순위로 분류.

| 키 | 영어 | 검수 포인트 |
|---|---|---|
| `mission.escapeNotice` | Type "{{phrase}}" to continue | 3회 실패 뒤에야 뜨는 문구라 사용자가 왜 갑자기 다른 문장이 나왔는지 이해할 수 있는지, "continue"가 "미션을 건너뛴다"는 오해를 주지 않는지(실제로는 알람 해제 그 자체) — **아직 미검수** |

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
| `mypage.missionQuotesLink` | Edit quotes | 짧은 링크 라벨이라 리스크 낮음 — **아직 미검수** (마이페이지 개편으로 `settings.*`에서 이관, 문구 동일) |
| `missionQuotes.title` | Edit quotes | 화면 헤더, mypage.missionQuotesLink와 동일 문구 — **아직 미검수** |
| `missionQuotes.textPlaceholder` | Quote | 짧은 placeholder — 리스크 낮음 — **아직 미검수** |
| `missionQuotes.authorPlaceholder` | Attributed to | "말한 사람"의 번역으로 자연스러운지(나중에 실존 인물 명언·출처 추가 시 이 필드에 채워짐) — **아직 미검수** |
| `missionQuotes.delete` | Delete | 표준적 표현 — **아직 미검수** |
| `missionQuotes.add` | + Add quote | 표준적 표현 — **아직 미검수** |
| `mission.quoteAuthor` | — {{author}} | 인용 표기 관례(em dash)가 두 언어 모두에서 자연스러운지 — **아직 미검수** |

### 신규 추가 (미검수) — 알람 예약 실패 안내(SCHEDULE_EXACT_ALARM 거부 시나리오)

네이티브 알람 예약(`scheduleAlarm`)이 실패할 수 있다는 사실이 실기기 검증 지시로 코드
확인됨(`Helper.java`가 `canScheduleExactAlarms()` 체크 없이 바로 `setExactAndAllowWhileIdle`
호출) — 실패해도 화면이 그대로라 사용자가 앱이 멈춘 것으로 오인하던 문제를 고쳤다.
낮잠을 실제로 시작 못 시키는 경로라 1순위로 분류.

| 키 | 영어 | 검수 포인트 |
|---|---|---|
| `home.scheduleFailedTitle` | Couldn't set the alarm | 표준적 표현 — **아직 미검수** |
| `home.scheduleFailedBodyAndroid` | If "Alarms & reminders" permission is off in your phone settings, the alarm can't be scheduled. Please check the permission in Settings. | 원인을 정확히 짚어주는 문장인지, 설정 버튼 라벨과 자연스럽게 이어지는지 — **아직 미검수** |
| `home.scheduleFailedBodyIos` | The alarm couldn't be scheduled due to an unknown issue. Please try again in a moment. | iOS는 원인 특정이 안 되는 케이스라 일부러 뭉뚱그렸다 — 너무 성의 없어 보이지 않는지 — **아직 미검수** |
| `home.scheduleFailedOpenSettings` | Open Settings | 표준적 표현 — **아직 미검수** |

## 2순위 — 의학 관련 고지문 — 검수 완료, 수정 불필요

| 키 | 영어 | 검수 결과 |
|---|---|---|
| `analysisReport.disclaimer` | This report is general sleep hygiene information, not a medical diagnosis or advice. If symptoms persist, please consult a professional. | 검수 완료 — 수정 불필요. "의학적 조언이 아니다"는 단정 강도가 원문과 동등하게 유지됨 |
| `alarm.subtitle` | 5 more minutes will only leave you groggier from sleep inertia.\nGetting up right now feels best. | 검수 완료 — 수정 불필요. "sleep inertia"가 과장된 의학적 단정으로 읽히지 않음(일반 수면위생 용어 수준) |

### 신규 추가 (미검수) — 홈 화면 안내 문구 개편(`mypage-polish` 브랜치)

`home.learnNote`가 "문헌 근거로 정한 기본값" 수준의 뭉뚱그린 문구에서 "수면 전문의들의
권장 낮잠 시간"·"권장드립니다" 등 더 단정적인 구체적 수치 문구로 바뀌었다 — 의료 조언처럼
읽힐 리스크가 이전보다 커져 이 카테고리로 분류(BACKLOG.md에도 Play 심사 리스크 인지를
기록해둠). 4줄 구조를 그대로 직역했다.

| 키 | 영어 | 검수 포인트 |
|---|---|---|
| `home.learnNote` | Sleep specialists recommend napping for 15–20 minutes.\nIt typically takes 10–20 minutes to fall asleep.\nSo we recommend a 25–40 minute alarm.\nYou can adjust your alarm timing in My Page, based on AI and your stats. | "Sleep specialists recommend"이 원문 "수면 전문의들의 권장"과 같은 단정 강도로 읽히는지, "recommend"가 4줄 중 2번 반복돼 어색하지 않은지 — **아직 미검수** |

### 신규 추가 (미검수) — "파워냅이란?" 정보 화면(`about-powernap` 브랜치)

`app/about.tsx` 5개 섹션 본문 — 문헌 근거를 요약한 건강 정보 문구라 이 카테고리로
분류. 장기 건강효과·진단/치료 표현은 이미 배제하고 썼지만(작성 규칙 참고), 영어
문장이 원문보다 단정적으로 읽히지 않는지 원어민 검수 필요. 5개 섹션(`about.section1`~
`section5`) + `about.disclaimer` 전부 대상 — 분량이 많아 표 대신 파일 직접 확인 권장
(`locales/en.json`의 `about` 네임스페이스). 특히 `section1`의 "which can leave you
feeling worse instead of better"와 `section5`의 "that may be a sign you're not
sleeping enough at night"가 원문("개운함이 떨어질 수 있어요"/"밤잠 자체가 부족하다는
신호일 수 있어요")보다 단정 강도가 세게 읽히는지 우선 확인 — **아직 미검수**.

### 신규 추가 (미검수) — 기상 루틴 3화면(wake-sequence, `wake-sequence` 브랜치)

기상 체크리스트가 후기 설문 화면 안 체크박스 4개에서, 해제 직후 순차 진입하는 개별
화면 3개(`/wake-stretch` → `/wake-light` → `/wake-water`)로 바뀌면서 각 화면에
"이 행동이 왜 도움이 되는지"를 한 줄로 설명하는 `effect` 문구가 새로 생겼다. 수면
호르몬·카페인과 비슷하게 생리학적 근거를 직접 언급하는 문장이라 2순위로 분류.

| 키 | 영어 | 검수 포인트 |
|---|---|---|
| `wakeRoutine.stretch.effect` | Loosens stiff muscles and gets blood flowing to shift your body into active mode | "shift your body into active mode"가 과도하게 단정적인 생리학 주장으로 읽히는지 — **아직 미검수** |
| `wakeRoutine.light.effect` | Light exposure stops sleep hormones and signals your brain it's time to wake up | "stops sleep hormones"가 원문 "수면 호르몬이 멈추고"보다 의학적으로 단정적인 인상을 주는지 — **아직 미검수** |
| `wakeRoutine.water.effect` | Replenishes fluids lost during sleep, easing grogginess and brain fog | "brain fog"가 informal/의학 용어처럼 읽혀 불필요한 인상을 주는지 — **아직 미검수** |
| `wakeRoutine.stretch.instruction` / `.light.instruction` / `.water.instruction` / `.slideLabel` | (지시문·슬라이드 라벨 6개) | 명령형 문장 톤이 알람 화면(`alarm.slideLabel` 등)과 일관되는지 — **아직 미검수** |

## 3순위 — 동의/개인정보 관련 문구 — 검수 완료, 수정 불필요

| 키 | 영어 | 검수 결과 |
|---|---|---|
| `analysisConsent.paragraph1` | To generate the analysis, your nap records (times, survey answers, notes) are sent to our server. The data sent is used only to create suggestions and advice for adjusting your wait time and caffeine onset time. | 검수 완료 — 수정 불필요. 데이터 사용 범위 제한("used only to")이 정확히 대응됨 |
| `analysisConsent.paragraph2` | Suggestions are for reference only — they're applied to your settings only when you tap to apply them yourself. | 검수 완료 — 수정 불필요. "only when you tap"이 자동 반영 없음을 명확히 함 |

### 신규 추가 (미검수) — 기기 변경 시 데이터 소실 고지

마이페이지(로컬 낮잠 기록·이용권)와 AI 분석 동의 화면(서버 분석 기록) 양쪽에
"기기를 바꾸면 못 가져온다"는 사실을 알리는 문구. 사용자가 실제로 기기를
바꿨을 때 데이터가 사라진 이유를 이해하는 데 직결되는 문구라 신중한 검수 필요.

| 키 | 영어 | 검수 포인트 |
|---|---|---|
| `mypage.deviceDataNotice` | Nap records are stored on this device only. If you switch devices, you won't be able to bring your records over. Purchased credits can be recovered with "Restore purchases" on the same Google account. | 세 문장이 한 캡션에 이어붙어 다소 긴데, 정보 밀도상 나누기 애매함 — 영어에서도 자연스럽게 읽히는지, "Restore purchases"가 실제 버튼 라벨과 대소문자·표현까지 일치하는지 — **아직 미검수** |
| `analysisConsent.paragraph3` | Sent records are tied to this device's anonymous account — if you switch devices, you won't be able to access past analyses anymore. | "anonymous account"라는 표현이 사용자에게 익명 계정 개념을 처음 소개하는 자리라 오해 없이 이해되는지(회원가입 계정과 혼동 가능성) — **아직 미검수** |

### 신규 추가 (미검수) — 서버 데이터 삭제 기능(설정 화면 2단계 확인)

`app/settings.tsx`의 "서버 데이터 삭제" 확인 다이얼로그(Alert.alert 2단계) 문구.
파괴적 동작(되돌릴 수 없는 삭제) 안내라 1순위와 비슷한 수준으로 신중한 검수가 필요.

| 키 | 영어 | 검수 포인트 |
|---|---|---|
| `settings.deleteConfirmBody` | Analysis reports, usage history, and credits will be permanently deleted from the server. Nap records stored on this device will remain. | "permanently"의 단정 강도가 원문 "영구히"와 대응되는지, 로컬 기록은 남는다는 대비가 명확한지 — **아직 미검수** |
| `settings.deleteConfirmCreditWarning` | {{count}} remaining credit(s) will be deleted too and cannot be recovered. | 환불 분쟁 방지 목적 문구라 "cannot be recovered"의 단정이 원문과 동일한 강도인지 — **아직 미검수** |
| `settings.deleteFinalBody` | This action cannot be undone. | 짧고 표준적인 표현이라 리스크는 낮지만 최종 확인 단계라 우선순위 유지 — **아직 미검수** |

### 신규 추가 (미검수) — 결제(Phase D, RevenueCat 연동)

돈이 오가는 화면·복원 흐름 문구라 삭제 확인과 비슷한 수준의 신중한 검수가 필요.
실제 Play Console 상품 등록·실결제 검증(DUNS 대기) 전이라 문구 자체도 아직 실기기로
본 적 없다.

| 키 | 영어 | 검수 포인트 |
|---|---|---|
| `analysisReport.purchaseErrorTitle` | Purchase failed | 표준적 표현 — **아직 미검수** |
| `analysisReport.purchaseTimeoutMessage` | The credit is taking longer than expected. Please check again in a moment. | 결제는 됐는데 적립만 늦는 상황이라는 뉘앙스가 "결제 자체가 실패했나?"로 오해되지 않는지 — **아직 미검수** |
| `purchaseHistory.restorePurchasesButton` | Restore purchases | 표준적 표현 — **아직 미검수** (마이페이지 개편으로 `settings.*`에서 이관, 문구 동일) |
| `purchaseHistory.restoreSuccessBody` | Your purchases have been restored. | 실제로 크레딧이 즉시 반영되는 건 아니고 RevenueCat 쪽 구매 기록 동기화라는 점이 오해를 살 수 있는지 — **아직 미검수** (이관, 문구 동일) |
| `purchaseHistory.restoreErrorTitle` | Restore failed | 표준적 표현 — **아직 미검수** (이관, 문구 동일) |

## 4순위 — 관용구·톤·문장 구조 리스크 (미해결 항목만 남김)

| 키 | 한국어 원문 | 영어 초안 | 검수 포인트 |
|---|---|---|---|
| `home.coffeeNotice` | 카페인이 이미 돌고 있어요 — 최소 대기시간으로 맞출게요 | Caffeine is already kicking in — we'll set the minimum wait time | "카페인이 돌고 있다"는 관용 표현의 영어 대응이 자연스러운지 — **아직 미검수** |
| `mypage.inputA11y` | {{label}} 분 직접 입력 ({{min}}~{{max}}) | Enter minutes directly for {{label}} ({{min}}–{{max}}) | label이 문장 중간에 삽입되는 구조 — 어순이 어색하지 않은지 — **아직 미검수** (마이페이지 개편으로 `settings.*`에서 이관, 문구 동일) |
| `analysisReport.purchaseButton` | 추가 분석 구매 (1,000원) | Buy extra analysis (₩1,000) | 원화(₩) 표기를 영어 사용자에게도 그대로 보여줄지 — Phase D에서 버튼이 실제로 눌리게 됐으니 지역별 통화 표기 재검토가 이제 급함 — **아직 미검수** |
| `analysisReport.networkError` / `analysisReport.unknownError` | 네트워크 연결을 확인해달라. / 알 수 없는 오류가 발생했다. | Please check your network connection. / An unknown error occurred. | 톤이 다른 문구(정중체)와 살짝 다름(원문부터 그랬음, "~해달라"체) — 그대로 직역, 문체 통일 여부 — **아직 미검수** |
| `history.deleteConfirmTitle` / `history.deleteConfirmBody` | Delete this nap record? / This cannot be undone. | 개별 낮잠 기록 삭제 확인(사용자 지시로 신규 추가) — 서버 데이터 삭제보다 낮은 stakes라 표준 문구로 짧게 썼다, 톤이 적절한지 — **아직 미검수** |

### 신규 추가 (미검수) — 마이페이지 신설 + 설정 화면 분리(`main`, 브랜치 통합 세션)

홈 화면 "지난 낮잠 기록" 링크를 "마이페이지"로 교체하고, 낮잠 타이밍 조정/명언 수정/
구매 복원을 설정 화면에서 새 허브 화면(`/mypage`)으로 옮겼다. 설정 화면은 이제 동작
토글·계정 관리만 남는다(동일 문구 이관은 위쪽 결제/미션 섹션에 각각 표기). 아래는
이번에 처음 생긴 문구만.

| 키 | 영어 | 검수 포인트 |
|---|---|---|
| `home.mypageLink` | My Page | 표준적 표현 — **아직 미검수** |
| `mypage.title` | My Page | 화면 헤더 — **아직 미검수** |
| `mypage.creditBalance` | {{count}} credit(s) remaining | 단수/복수 처리가 영어에서 자연스러운지(0개/1개/N개 전부 이 문구 하나로 처리) — **아직 미검수** |
| `mypage.creditBalanceConsentNotice` | Consent to AI analysis to see your remaining credits | "Consent to X"가 명령문처럼 강하게 읽히는지(원문 "동의하면 확인할 수 있어요"는 권유 톤) — **아직 미검수** |
| `mypage.sleepTimingSectionLabel` | Nap Timing | 표준적 표현 — **아직 미검수** |
| `mypage.napHistoryLink` | Nap History | 표준적 표현 — **아직 미검수** |
| `mypage.aiAnalysisHistoryLink` | AI Analysis History | 표준적 표현 — **아직 미검수** |
| `mypage.purchaseHistoryLink` | Purchase History | 표준적 표현 — **아직 미검수** |
| `purchaseHistory.title` | Purchase History | 화면 헤더 — **아직 미검수** |
| `purchaseHistory.emptyText` | No purchases yet. | 결제 내역 조회 API가 아직 없어 항상 빈 상태로 표시된다는 맥락 — 문구 자체가 오해를 살 정도로 단정적이지 않은지 — **아직 미검수** |
| `settings.deleteSectionLabel` | Delete Data | 표준적 표현 — **아직 미검수** |
| `settings.legalSectionLabel` | Legal | 약관(Terms) URL이 아직 없어 이 섹션엔 개인정보처리방침 링크만 있음 — 나중에 약관이 추가되면 라벨이 계속 맞는지 재확인 — **아직 미검수** |

### 신규 추가 (미검수) — 체험 모드(`preview-mode` 브랜치)

QA 테스트 낮잠(`isTest`, 기존 검수 대상 아님 — 개발용 라벨)과 별개로, 출시 빌드에도
상시 노출되는 사용자 대상 "10초 알람 체험" 버튼과 완료 안내 토스트를 신규 추가했다.
버튼 라벨은 실제로 사용자가 처음 마주치는 신규 진입점이고, 토스트는 "왜 기록에 안
남았는지" 오해 없이 이해돼야 해서 리스크가 낮지 않다고 판단해 이 카테고리에 넣었다.

| 키 | 한국어 원문 | 영어 초안 | 검수 포인트 |
|---|---|---|---|
| `home.previewButton` | 10초 알람 체험 | Try a 10-Sec Alarm | "체험"이 "미리 써보기(trial)"라는 뉘앙스로 자연스럽게 읽히는지, 버튼 하나로 "10초짜리 가짜 알람"이라는 의미가 명확한지 — **아직 미검수** |
| `feedback.toastPreviewNotSaved` | 체험이라 기록에는 남기지 않았어요. | This was a preview, so it wasn't saved. | "체험"과 버튼 라벨의 "체험"이 같은 단어로 자연스럽게 연결되는지, "기록에는 남기지 않았어요"가 AI 분석·통계에서도 빠진다는 걸 오해 없이 함의하는지(문구엔 "기록"만 언급) — **아직 미검수** |

### 신규 추가 (미검수) — 홈 화면 위젯 3종(S/M/L, 네이티브 `strings.xml`)

`fastMode`/`slowMode`/`coffeeMode` 버튼 라벨은 기존 검수 대상 문구를 그대로 복사한
것이라 별도 검수 불필요. 새로 작성한 건 위젯 전용 "탭 안내" 두 줄과 위젯 추가 목록에
뜨는 위젯 이름(피커 라벨) 세 개뿐 — 이 문구들은 앱의 `locales/*.json`이 아니라
네이티브 `res/values/widget_strings.xml`(영어)·`res/values-ko/widget_strings.xml`
(한국어)에 있어(`plugins/withHomeScreenWidgets.js`), 앱 언어 설정과 무관하게 디바이스
언어를 따른다. 실시간 알람 시각을 위젯 얼굴에 못 보여주는 제약 때문에(헤드리스 JS
없이는 네이티브가 `latency` 설정을 모름 —
`docs/decisions/home-screen-widgets-static-deeplink.md`) 숫자 없는 고정 안내 문구로
설계했다는 점도 검수 시 참고.

| 키 | 한국어 원문 | 영어 초안 | 검수 포인트 |
|---|---|---|---|
| `widget_tap_hint_nap` | 탭하면 지금 알람이 맞춰져요 | Tap to set the alarm now | fast/slow 버튼 둘 다 공유하는 문구 — "지금"이 "탭하는 시점 기준"이라는 뜻으로 명확히 읽히는지 — **아직 미검수** |
| `widget_tap_hint_coffee` | 탭하면 마신 시각을 입력해요 | Tap to enter when you had it | "it"이 바로 앞 버튼 제목(커피냅/Coffee nap)의 "커피"를 가리키는 게 위젯이라는 좁은 지면에서도 자연스러운지 — **아직 미검수** |
| `widget_label_s` | 파워냅 – 바로 낮잠 | PowerNap – Quick Nap | 위젯 추가 목록(피커)에서 S/M/L 세 항목이 서로 구별되는지 — **아직 미검수** |
| `widget_label_m` | 파워냅 – 낮잠 (2가지) | PowerNap – Nap (2 modes) | 동일 | 
| `widget_label_l` | 파워냅 – 낮잠 (3가지) | PowerNap – Nap (3 modes) | 동일 |

위 다섯은 네이티브 리소스지만, 같은 기능의 재탭 가드 안내는 앱 쪽
`locales/en.json`(`home.toastWidgetAlreadyNapping`)에 있어 검수 대상에 같이 올린다.

| 키 | 한국어 원문 | 영어 초안 | 검수 포인트 |
|---|---|---|---|
| `home.toastWidgetAlreadyNapping` | 이미 낮잠 중이에요. 기존 알람은 그대로 유지돼요. | You're already napping — your existing alarm is unchanged. | 위젯을 두 번 탭했을 때만 보이는 짧은 토스트 — "그대로 유지"가 "새로 안 바뀐다"는 안도감을 주는 톤인지 — **아직 미검수** |

### 신규 추가 (미검수) — 낮잠 모드 라벨 개편("바로 잠들 것 같아요"/"좀 뒤척일 것 같아요" → "매우 졸림"/"조금 졸림")

사용자 지시로 기존 두 가지 표현 체계(홈 버튼의 긴 예측형 문장 "바로 잠들 것 같아요"/"좀
뒤척일 것 같아요"와 히스토리·설정 등의 짧은 표현 "바로 잠듦"/"뒤척임")를 "매우 졸림"/
"조금 졸림" 하나로 통일 — 앱·위젯·온보딩·설정·히스토리 전부. 영문은 이번에 새로 작성.

| 키 | 한국어 원문 | 영어 초안 | 검수 포인트 |
|---|---|---|---|
| `common.napMode.fast` / `home.fastMode` / `widget_fast_title` | 매우 졸림 | Very sleepy | 홈 버튼·위젯·히스토리·설정 전반에서 재사용되는 핵심 라벨 — **아직 미검수** |
| `common.napMode.slow` / `home.slowMode` / `widget_slow_title` | 조금 졸림 | A bit sleepy | 동일 — **아직 미검수** |
| `alarmTiming.rowLabel.fast` | 수면 대기시간 — 매우 졸림 | Sleep latency — Very sleepy | 접두어 "Sleep latency —"와 새 라벨의 조합이 어색하지 않은지 — **아직 미검수** |
| `alarmTiming.rowLabel.slow` | 수면 대기시간 — 조금 졸림 | Sleep latency — A bit sleepy | 동일 — **아직 미검수** |
| `analysis.suggestion.fastLabel` / `slowLabel` | 매우 졸림 {{sign}}{{minutes}}분 / 조금 졸림 {{sign}}{{minutes}}분 | Very sleepy {{sign}}{{minutes}} min / A bit sleepy {{sign}}{{minutes}} min | 부호+분 숫자가 뒤에 붙는 라벨이라 "Very"/"A bit"로 시작해도 읽기 자연스러운지 — **아직 미검수** |

### 신규 추가 (미검수) — 첫 실행 온보딩(4장 튜토리얼, `onboarding` 브랜치)

첫 실행 시 1회 자동 노출되는 전체화면 슬라이드 4장(3모드 차이/미션·기상루틴/AI 분석/위젯).
카피는 사용자가 초안 검토 후 확정, 영어는 아직 원어민 검수 전.

| 키 | 한국어 원문 | 영어 초안 | 검수 포인트 |
|---|---|---|---|
| `onboarding.slide1.body` | 매우 졸림 · 조금 졸림 · 커피냅 — 상황에 맞는 버튼만 누르면 알람 시간은 앱이 계산해요. | Very sleepy, A bit sleepy, Coffee nap — pick what fits, and the app works out your wake-up time. | 홈 화면 버튼 3개 원문을 그대로 나열한 구조 — 자연스러운 영어 리듬인지 — **아직 미검수** |
| `onboarding.slide2.body` | 알람을 끄면 기지개·빛·물 순서로 기상 루틴이 이어져요. 명언을 따라 입력해야 꺼지는 미션은 설정에서 켤 수 있어요. | A stretch-light-water routine kicks in after the alarm by default. Turn on the quote-typing mission in Settings if you want it harder to snooze. | ⚠️ **"harder to snooze" 표현 — 이 앱엔 스누즈 기능이 없어 오해 소지, 영어 검수 때 반드시 재검토** — **아직 미검수** |
| `onboarding.slide3.body` | 마이페이지에서 낮잠 패턴을 AI로 분석받을 수 있어요. 주 1회 무료예요. | Get an AI breakdown of your nap patterns from My Page — free once a week. | "무료"를 첫인상에 명확히 전달하는 톤인지 — **아직 미검수** |
| `onboarding.slide4.body` | 홈 화면에 위젯을 추가하면 버튼 한 번으로 앱이 열리고 알람까지 바로 맞춰져요. 나중에 홈 화면을 길게 눌러 추가해보세요. | Add the PowerNap widget and one tap opens the app with your alarm already set. Add it anytime by long-pressing your home screen. | 위젯이 앱을 열지 않고 동작한다는 오해를 주지 않는지(사실은 앱이 열림) — **아직 미검수** |
| `settings.onboardingReplayLink` | 온보딩 다시 보기 | Replay onboarding | 톤 — **아직 미검수** |

### 신규 추가 (미검수) — 수면 화면 페이드 안내 문구

수면 화면에 은은하게 페이드 인/아웃하는 안내 문구를 신규 추가(`sleep.restHint`,
사용자가 한국어 원문을 직접 확정). 알람/안전과 무관한 분위기 문구라 4순위로 분류.

| 키 | 한국어 원문 | 영어 초안 | 검수 포인트 |
|---|---|---|---|
| `sleep.restHint` | 휴대폰을 놓고 눈을 감으세요 | Put your phone down and close your eyes | 명령형 문장이 다른 수면 화면 문구(`countdownLabel`/`wakeAt*`, 안내형 톤)와 어울리는지 — **아직 미검수** |

### 신규 추가 (미검수) — 명언 타이핑 미션, 고전 인용 20개로 교체(`quotes-classical` 브랜치)

기존 자체 작성 18개(author "클로드"/"Claude")를 전부 폐기하고 실존 인물의 고전
인용 20개로 교체(사용자가 원문/출처까지 확정한 표를 그대로 반영, `src/missionQuotes.ts`
참고). 영어가 원문인 것(에디슨·프랭클린·켈러·아인슈타인·셰익스피어)은 원문 그대로라
검수 리스크 낮음, 나머지(니체·아인슈타인 서한·톨스토이·괴테·공자·노자·세네카)는
기존 통용 영역본을 참고해 직접 옮긴 것이라 원어민 검수 권장. 오귀속이 흔한 영역이라
(가짜 명언 예시는 `src/missionQuotes.ts` 파일 상단 주석 참고) 인용 자체의 출처 정확성도
같이 확인 필요.

| # | 영어 | 저자 | 검수 포인트 |
|---|---|---|---|
| 1 | Genius is one percent inspiration and ninety-nine percent perspiration. | Thomas Edison | 원문 그대로 — 리스크 낮음 |
| 2 | The most certain way to succeed is always to try just one more time. | Thomas Edison | 원문 그대로 — 리스크 낮음 |
| 3 | Never leave till tomorrow what you can do today. | Benjamin Franklin | 원문 그대로 — 리스크 낮음 |
| 4 | Do you love life? Then do not squander time. | Benjamin Franklin | 원문 그대로 — 리스크 낮음 |
| 5 | What does not kill me makes me stronger. | Friedrich Nietzsche | 통용 영역본 — 독일어 원문(우상의 황혼) 대비 뉘앙스 확인 — **아직 미검수** |
| 6 | He who has a why can bear almost any how. | Friedrich Nietzsche | 통용 영역본(차라투스트라) — **아직 미검수** |
| 7 | Life is like riding a bicycle. To keep your balance, keep moving. | Albert Einstein | 서한(1952) 인용 — 통용 영역, 원문 그대로에 가까움 — **아직 미검수** |
| 8 | I have no special talent. I am only passionately curious. | Albert Einstein | 서한(1952) 인용 — **아직 미검수** |
| 9 | The unexamined life is not worth living. | Socrates | 플라톤 「변론」 통용 영역 — **아직 미검수** |
| 10 | To thine own self be true. | William Shakespeare | 「햄릿」 원문 그대로 — 리스크 낮음 |
| 11 | Everyone wants to change the world. No one wants to change himself. | Leo Tolstoy | 통용 영역 — **아직 미검수** |
| 12 | Without haste, but without rest. | Goethe | 괴테 좌우명 통용 영역 — **아직 미검수** |
| 13 | To have a fault and not correct it — that is the real fault. | Confucius | 논어 통용 영역 — em dash 사용이 원문 어투와 맞는지 — **아직 미검수** |
| 14 | Say you know what you know, and admit what you don't. | Confucius | 논어 통용 영역 — **아직 미검수** |
| 15 | Learning without thinking gains nothing. | Confucius | 논어 통용 영역 — **아직 미검수** |
| 16 | A thousand miles begins with a single step. | Lao Tzu | 도덕경 통용 영역 — **아직 미검수** |
| 17 | Knowing others is wisdom. Knowing yourself is clarity. | Lao Tzu | 도덕경 통용 영역 — **아직 미검수** |
| 18 | Optimism is the faith that leads to achievement. | Helen Keller | 「Optimism」 원문 그대로 — 리스크 낮음 |
| 19 | Alone we can do little. Together we can do much. | Helen Keller | 원문 그대로 — 리스크 낮음 |
| 20 | Life is not short. We waste it. | Seneca | 통용 영역 — **아직 미검수** |

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
