# STATUS — 세션 핸드오프

## 완료 Phase

- Phase 0: 스캐폴딩 (expo-router, 디자인 토큰, AsyncStorage 래퍼, 4화면 라우팅)
- Phase 1: 홈 화면 (실시간 시계, 학습된 오프셋, 분 단위 재계산 알람 버튼)
- Phase 2 / 2.1: 수면 + 알람 코어, 알람 신뢰성 보강 (expo-audio, expo-notifications 백업 알람, watchdog 훅)
- Phase 3: 슬라이드 해제 제스처 + 후기 피드백 루프
- 보강 커밋: 오디오 released-object 크래시 수정, prebuild 설정 영속화(오디오 플러그인 옵션·불필요 권한 제거), 커피 토글 대비 수정 + dev 10초 테스트 알람, 알림 사운드 경고 수정, tsconfig 안정화(typedRoutes)
- Phase 4-1: 학습 엔진 개편 — 4버킷 오프셋(모드×커피 독립 학습), 적응형 스텝(미수렴 ±3분 →
  "딱 좋았어요" 이후 ±2분), clamp 10~35, 구형 {fast,slow} 설정 자동 마이그레이션,
  수면 화면 커피 토글 시 alarmAt 재계산 + 백업 알림 재예약, 후기 화면 "직접 조정하기"
  ±1분 스테퍼 보조 경로, NapRecord append-only 기록 시작, 패치 버전 드리프트 6건 해소.
  단위 테스트 11개(jest-expo) 통과.
- 낮잠 히스토리 화면 (BACKLOG v1.1에서 사용자 요청으로 코드 동결 중 선반영): 홈 화면
  "지난 낮잠 기록" 링크 → `/history`, `NapRecord` 읽기 전용 목록 표시. `format.ts`에
  `formatKoreanDateTime` 추가. 신규 데이터 기록/학습 로직 변경 없음(열람 전용).
- 도그푸딩 버그 3건 수정 (커밋 `11890c7`): 알림 채널 ID 버전업(`alarm`→`alarm-v2`,
  구채널 설정 고정 문제 — CLAUDE.md 지뢰 목록에 규칙 추가), 알람 화면 롱프레스 해제를
  `Pressable.onLongPress` → `Gesture.LongPress()`로 교체(RNGH 응답 시스템 레이스 회피),
  수면 화면 커피 토글 오프 상태에 프리뷰 텍스트("켜면 오후 h:mm 알람 (n분)") 추가.
  학습 로직/버킷 구조는 건드리지 않음.
- 테스트 버튼 노출을 `__DEV__` 게이트에서 `src/config.ts`의 `SHOW_TEST_BUTTONS` 플래그로
  전환 (커밋 `657d6ab`) — 도그푸딩 중엔 릴리즈 빌드에서도 노출되도록 기본 `true`.
  **정식 출시 전 반드시 `false`로 변경 확인할 것** (CLAUDE.md 코드 규칙에 체크리스트 추가).
- 도그푸딩 버그 3건 실기기 재검증 완료: 알림 채널 v2 정상 생성·소리/진동 ON. 단, 백그라운드/
  잠금 상태에선 진동만 나고 소리가 없어 "진짜 알람" 요구사항으로 확정 → Android 네이티브
  알람 조기 도입 결정.
- **Android 네이티브 알람 전환 완료** (`expo-alarm-module`, `STREAM_ALARM`) — `spike/native-alarm`
  브랜치에서 작업 후 `main`에 병합됨. PROJECT.md §4 참고:
  - `src/notifications.ts` Android 분기를 `expo-alarm-module`로 교체(고정 UID, showDismiss/
    showSnooze 끔), `app/alarm.tsx`는 Android에서 expo-audio 재생을 끄고 화면/햅틱/해제만
    담당, `app/_layout.tsx`의 `ensureAndroidChannelAsync` 제거(라이브러리가 자체 채널 생성).
  - **실기기 검증 전 항목 통과**: New Architecture 릴리즈 빌드 링크, 무음+볼륨0 관통 연속
    재생, 포그라운드/백그라운드/잠금 전부에서 발화, 알림 탭→해제 화면 진입, 슬라이드/롱프레스
    해제, 낮잠취소, 커피토글 재예약, 2연속 낮잠, **앱 강제종료 상태에서도 알람 발화**(가장
    중요한 시험) 전부 확인됨.
  - 롱프레스는 중간에 완전 미작동 발견 → `Gesture.LongPress()` 기본 `maxDistance`(~10pt)가
    3초 유지 기준으로 너무 빡빡했던 것 + 별도 텍스트 링크가 사용자가 누르는 지점과 분리돼
    발견성도 나빴음. `maxDistance(40)` + 롱프레스를 슬라이드 손잡이 자체에
    `Gesture.Race(pan, longPress)`로 결합해 재확인 완료.
  - **의도적으로 미룬 것 3건(다음 단계 후보, PROJECT.md §4 "알려진 한계" 참고)**:
    풀스크린 인텐트/화면 자동점등 미구현(알림 본문을 직접 탭해야 해제 화면 진입), 알림 스와이프
    삭제 시 화면 없이 소리 꺼짐, 커스텀 사운드(`alarm.wav`) 미지원(라이브러리 기본음 사용).
- **B그룹 — 풀스크린 인텐트 + 화면 자동점등** (`fullscreen-intent` 브랜치, `main` 기준 분기):
  - config plugin `plugins/withFullScreenAlarmIntent.js` 신규: (1) 매니페스트에
    `USE_FULL_SCREEN_INTENT` 권한 + `MainActivity`에 `showWhenLocked`/`turnScreenOn` 속성
    주입, (2) `node_modules/expo-alarm-module`의 `Helper.java`(알림 빌더, 라이브러리가
    `setFullScreenIntent` 옵션 자체를 제공 안 함)에 `.setFullScreenIntent(...)` 호출과
    `canUseFullScreenIntent()` 런타임 로그를 소스 레벨로 패치 — `android/`(gitignore) 대신
    `withDangerousMod`로 매 `expo prebuild`마다 재적용되게 함(patch-package 방식).
    버전 결합(expo-alarm-module 1.2.0 기준) 명시, 코드 안 맞으면 조용히 스킵 대신 에러.
  - 라이브러리 포크 없이 config plugin만으로 구현 가능 — 중단 기준(포크 수준 수정 필요) 미해당.
  - 검증 완료: `expo prebuild --clean` 2회 연속(멱등성, 중복 패치 없음) + 방금 재설치한
    pristine `expo-alarm-module` 위에서 1회(재설치 후에도 재현됨) + `gradlew assembleDebug`
    전체 빌드 성공(APK 생성, 패치된 Java 정상 컴파일) + 매니페스트에 권한/MainActivity
    속성 반영 확인.
  - `main`(phase-4-2/A그룹 포함) 병합 완료 — `app/alarm.tsx`는 두 브랜치 모두 건드렸지만
    실제 충돌은 없었음(A그룹은 BackHandler/롱프레스 트랙 확장, B그룹은 이 파일을 직접
    건드리지 않고 config plugin·네이티브 소스 패치로만 구현했기 때문). git이 자동 병합.
  - **실기기 검증 완료** (`gradlew assembleRelease` → `adb install -r`로 직접 설치):
    화면 꺼짐/잠금 상태에서 알람 시각에 자동 점등 + 해제 화면 직행 확인(실사용 낮잠
    시나리오 통과). 화면 켜진 채 잠금 해제 상태에서는 Android 정책상 풀스크린 대신
    헤드업 알림으로 강등되는 것도 확인 — OS 자체 정책(포그라운드에서 전체화면 액티비티
    금지)이라 앱에서 우회 불가, 버그 아님. 두 경우 모두 알람음/진동은 정상 발화.
    슬라이드/롱프레스 해제(A그룹)도 이 병합 빌드에서 정상 동작 확인. 결과를
    PROJECT.md §4에 알려진 특성으로 기록.
  - **`main`에 병합 완료** (merge commit, B그룹 커밋 전부 포함). 병합 후 main에서
    tsc/expo-doctor/expo export/jest 4종 재검증 통과.

- **학습 모델 v2 + 커피냅 3모드** (`main`에 병합 완료) — PROJECT.md §5·§6,
  BACKLOG.md "구현됨(Phase 4-2)"/"카페인 발현시간 근거" 참고:
  - 데이터 모델 v3: `offsets` 4버킷 → `latency{fast,slow}`(0~20분) + `caffeineOnset`
    (15~35분, 기본 25분)로 교체. `coffee: boolean` 필드 폐지, `NapMode`에 `'coffee'` 3번째
    값 추가. v1/v2 → v3 마이그레이션(caffeineOnset은 구형 커피 버킷 값 승계 안 함, 항상
    기본값에서 재시작 — 사용자 확정).
  - 수면 화면 커피 토글 완전 제거(재예약 코드 포함) — 커피 여부/시각은 홈 화면에서 낮잠
    시작 전에 이미 확정.
  - 홈 화면에 "커피냅" 버튼 추가, 탭하면 기존 3버튼 아래로 칩 4개(방금/5분전/10분전/
    직접입력)가 펼쳐짐(토글, ≤150ms 애니메이션). 프리셋은 즉시 시작, 직접입력만 숫자입력+
    실시간 미리보기+확정 버튼 예외 경로. `computeCoffeeAlarmAt`으로 "이미 카페인이 돌고
    있음" 보정(now+10분) 처리.
  - 후기 화면 3버튼 라벨을 실제 스텝으로 동적 표시(기존 ±5 하드코딩 버그 함께 수정 —
    Phase 4-1 스텝 개편 이후 라벨이 안 갱신됐던 문제), 학습 상태 캡션 추가, "직접
    조정하기"가 latency/caffeineOnset을 모드에 맞게 직접 편집.
  - jest 20개 통과(기존 11개 + 마이그레이션/3모드 학습/보정로직 신규 9개), tsc/expo-doctor/
    expo export 3종 통과.

- **도그푸딩 발견 5건 수정 + 설정 화면 (A그룹, `main`에 병합 완료)**:
  - A-0 조사: 홈 버튼 fast(35분) > slow(30분) 역전은 v3 마이그레이션 버그 아님(코드
    전수 확인, mode 매핑 이상 없음) — 도그푸딩 중 테스트 낮잠(10초/1분 버튼)이 전부
    fast 모드로 latency.fast를 오염시킨 결과로 판정. `ActiveNap`/`NapRecord`에 `isTest`
    플래그 추가 → 테스트 낮잠은 후기 화면을 건너뛰고 학습 미반영, 히스토리에 "테스트"
    배지만 표시. 기존 오염값은 코드로 되돌리지 않음 — A-4 설정 화면에서 사용자가 직접
    교정 필요(fast 대기시간이 실제보다 부풀려져 있음).
  - 홈 화면 ScrollView + KeyboardAvoidingView 전환 — 커피냅 칩/직접입력 펼침 시
    작은 화면에서 잘리거나 키보드에 가리는 문제 해결, 펼침 시 자동 스크롤.
  - Android 뒤로가기 정리: 알람 화면은 하드웨어 뒤로가기 완전 차단(해제는 슬라이드/
    롱프레스만), 후기 화면은 뒤로가기 시 홈으로(알람 화면 복귀 방지). 수면 화면은
    기존 기본 동작이 이미 안전해 코드 변경 없음(백그라운드 전환돼도 네이티브 알람이
    낮잠을 책임짐).
  - 알람 해제 롱프레스 인식 영역을 손잡이(56pt)에서 슬라이드 트랙 전체+안내 문구로
    확대(도그푸딩에서 롱프레스 실패 리포트 반영).
  - 설정 화면(`/settings`) 신규: 수면 대기시간(잠듦/뒤척임, 0~20분)·카페인 발현시간
    (15~35분)을 스테퍼+숫자입력으로 직접 조정, 항목별 "20 + n = 총 n분" 미리보기.
    `applyManualAdjustment` 재사용(converged 유지), NapRecord에 `manual-settings`로
    기록(후기 화면의 `manual` 경로와 구분). 홈 화면 "지난 낮잠 기록" 옆에 "설정" 링크.
  - jest 21개 통과, tsc/expo-doctor/expo export 3종 통과. 커밋 3개로 분리
    (`fix: isolate test naps...` / `fix: home overflow, back nav, long-press hitbox` /
    `feat: settings screen (A-4)`).
  - **실기기 검증 완료**(디버그 빌드, Metro 포트 8080 연결): 뒤로가기 차단/이동, 롱프레스
    트랙 확장, 설정 화면 전부 정상 확인. 확인 과정에서 커피냅 직접입력 시 Android
    키보드가 입력창/미리보기/확정 버튼을 가리는 추가 버그 발견·수정 —
    `KeyboardAvoidingView`의 Android `behavior`를 `adjustResize`에만 맡기지 않고
    `'height'`로 명시 + 포커스 시 지연 스크롤(`fix: coffee custom-input panel hidden
    behind Android keyboard`). 겸사겸사 패치 버전 드리프트 3건(`expo`/`expo-linking`/
    `expo-router`)도 `expo install --fix`로 해소.
  - **`main`에 병합 완료** (merge commit `2f36363`, 커밋 6개 전부 포함). 병합 후
    main에서 tsc/expo-doctor/expo export/jest 4종 재검증 통과.

- **Phase 4-3 — 자동 조정 학습 폐지 + 4문항 설문 후기 화면** (`phase-4-3` 브랜치,
  `main` 기준 분기, **main 미병합**) — PROJECT.md §5·§6·§8, BACKLOG.md "구현됨(Phase 4-3)"/
  "학습 구조 전환 근거" 참고:
  - `applyFeedback`/`converged`/적응형 스텝 전부 삭제. latency/caffeineOnset을 바꾸는
    경로는 수동 조정(설정 화면, 후기 화면 "직접 조정하기")뿐 — 근거: 만성 수면부족
    사용자의 "부족함" 피드백은 수면부채 신호일 수 있어 자동 조정은 과잉 반응 위험.
  - 후기 화면 3버튼 → 4문항 설문(자세 편안함/소음 차단/빛 차단/수면 만족도, 각
    상·중·하, 기본값 '중')+선택 메모+"기록하기" 제출 버튼+"건너뛰기"(그래도 기록은
    저장, survey: null). 설문 응답은 latency/caffeineOnset에 영향 없음(순수 데이터
    수집, 향후 BACKLOG v2 분석 원료).
  - NapRecord v2 스키마(`survey`/`memo`/`manualAdjust`)를 기존 v1(`result`/
    `manualAdjustmentMinutes`) 옆에 추가 — 과거 기록 변경·삭제 없이 히스토리에서
    양쪽 포맷 모두 렌더. `history.tsx`의 `detailText`/`surveySummary`는 직접 단위
    테스트하도록 export.
  - jest 22개 통과(store 17개 + history 5개, 신규 `app/history.test.ts`), tsc/
    expo-doctor/expo export 3종 통과. 커밋 2개(`refactor: replace auto-adjustment...`
    / `docs: reflect Phase 4-3...`), push 완료.
  - `main`(B그룹/풀스크린 인텐트 포함) 재병합 완료 — CLAUDE.md/PROJECT.md는 자동 병합,
    STATUS.md만 충돌(둘 다 이 파일을 갱신해서) 수동 정리.
  - **히스토리 상세 보기 추가** (main 병합 전 phase-4-3에 선반영): 리스트 행을 탭하면
    같은 카드 안에 상세 블록이 펼쳐짐(아코디언, 새 라우트 없음) — 날짜/모드/사용
    시간에 이어 구v1은 후기 결과, 신v2는 설문 4항목을 풀네임으로 한 줄씩("자세: 중"
    형태), manualAdjust·메모 전문은 있을 때만 추가. 리스트 압축 표시는 그대로 유지.
    jest 26개로 증가(기존 22개 + `detailRows` 4케이스).
  - **`main`에 병합 완료** (merge commit `eb5737f`). 코드 충돌 없음(STATUS.md만
    수동 정리 — phase-4-3이 main을 앞서 재병합해둔 덕에 이번엔 그마저도 자동 병합).
    병합 후 main에서 tsc/expo-doctor/expo export/jest(26개) 4종 재검증 통과.
    **실기기 검증은 아직 — 사용자가 직접 진행**.

- **Phase A — AI 분석 서버 기반**(`main`에 직접 커밋, 별도 브랜치 없음) — AI_ANALYSIS.md §7,
  BACKLOG.md v2 아키텍처 결정 참고. "전부 로컬" 원칙을 처음 깨는 항목, 사용자 명시 확인 후 착수:
  - `AI_ANALYSIS.md` 신규(제품 정의/비즈니스 규칙/아키텍처/데이터 모델/AI 파이프라인/앱 변경/
    Phase 분할/리스크). CLAUDE.md "전부 로컬" 원칙을 "v1.1부터 AI 분석에 한해 서버 사용
    (AI_ANALYSIS.md 참조), 그 외 기능은 여전히 로컬 전용"으로 갱신.
  - Supabase 프로젝트 생성(신형 publishable/secret 키 체계, 레거시 anon/service_role 아님) —
    프로젝트 생성·키 발급·익명 인증 활성화는 사용자가 대시보드에서 직접, 스키마·클라이언트·
    검증은 코드로 분담.
  - `supabase/migrations/0001_ai_analysis_init.sql`: `users`/`credits`/`credit_events`/
    `analyses` 4테이블. RLS는 각자 자기 행만 read, insert/update 정책 없음(secret key 전용
    — 클라이언트가 자기 크레딧을 직접 못 올림). 크레딧 원장 트리거(`credit_events` insert →
    `credits.balance` 자동 반영, `balance >= 0` 제약으로 초과 소비 시 insert 자체 롤백).
    `has_weekly_free()`: 월요일 00:00 KST 기준 주간 무료 판정 함수.
  - `src/supabase.ts`: `@supabase/supabase-js` + `react-native-url-polyfill` + AsyncStorage
    세션 저장. `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`만 앱에 노출,
    `SUPABASE_SECRET_KEY`/`SUPABASE_ACCESS_TOKEN`은 `.env`에 있지만 앱 코드는 안 읽음(CLI 전용).
    `.env.example` 신규 추적(gitignore에 `!.env.example` 예외 추가), 실제 `.env`는 그대로 무시.
  - `supabase/tests/credit-ledger.test.ts`: 실 클라우드 프로젝트에 대해 도는 통합 테스트 5개
    — 해피패스(purchase→analysis 잔액 반영), 초과 소비 차단(check 제약 롤백 실증), 중복 적립
    방지(external_id unique), 주간 무료 판정 KST 경계(월요일 00:00 KST 전후로
    `has_weekly_free()` 반전 확인 — UTC 유출 방지), RLS 음성 케이스(anon 세션의
    `credit_events` 직접 insert 거부 확인).
  - jest를 `app`/`supabase` 두 프로젝트로 분리 — jest-expo 프리셋이 전역 `fetch`를 Expo
    winter 런타임 스텁으로 덮어써 실제 네트워크 호출이 깨지는 문제 발견. `supabase` 프로젝트는
    순수 node 환경 + 최소 바벨 트랜스폼(`@babel/preset-typescript` + commonjs 변환)으로 분리해
    우회, `babel-preset-expo`(EXPO_PUBLIC_* 인라인 플러그인 포함)를 아예 안 태운다.
  - jest 31개 통과(app 26개 + supabase 통합 5개), tsc/expo-doctor/expo export 3종 통과.
  - **Phase A 완료.** Phase B(Edge Function `analyze`, Claude API 파이프라인)는 별도 지시 시 착수.

**마지막 검증된 커밋: `eb5737f` — "Merge branch 'phase-4-3' into main", `main` 브랜치.**

## 브랜치 현황

- `main`: 네이티브 알람 + 학습 모델 v2 + 커피냅 3모드 + A그룹 + B그룹(풀스크린 인텐트) +
  Phase 4-3(학습 로직 단순화 + 설문 후기 + 히스토리 상세 보기) 전부 병합 완료.
  A그룹/B그룹은 실기기 검증까지 끝남, **Phase 4-3만 실기기 검증 대기**.
- `phase-4-2` / `fullscreen-intent` / `phase-4-3`: 전부 main에 병합 완료 — 더 이상
  별도로 갈 일 없음(정리 대상, 삭제는 사용자 지시 시). `phase-4-3`용 worktree
  (`power-nap-phase43`)도 같은 이유로 정리 대상.

## 지금 단계

**기능 개발 동결(v1) 유지, AI 분석(v1.1)만 사용자 명시 지시로 예외 진행 중.**
`main`에 계획했던 v1 기능(네이티브 알람, 학습 모델 v2, 커피냅 3모드, A/B그룹, Phase 4-3
학습 개편)은 전부 병합 완료 — 남은 건 Phase 4-3 실기기 검증과 출시 전 체크리스트
(SHOW_TEST_BUTTONS=false 전환 등, CLAUDE.md 코드 규칙 참고). 그와 별개로 AI 분석
(Phase A~E, AI_ANALYSIS.md)은 사용자가 명시적으로 착수 지시해 Phase A(서버 기반)까지
완료됨 — Phase B(Edge Function/AI 파이프라인)는 별도 지시 대기. 그 외 [BACKLOG.md](BACKLOG.md)
항목은 여전히 요청 없이 착수하지 않는다.

## 미해결 항목

- [ ] **Phase 4-3 실기기 검증**(사용자 진행): 설문 제출/건너뛰기/메모 저장이 실제로
      기록되는지, 세그먼트 탭 반응·기본값(중) 확인, 설정 화면·"직접 조정하기" 양쪽에서
      수동 조정이 여전히 정상 동작하는지, 히스토리에서 기존(v1) 기록과 신규(v2) 기록이
      둘 다 깨지지 않고 보이는지(기존 AsyncStorage 데이터 위에서 확인 — 마이그레이션
      아님, 공존), 히스토리 행 탭 시 상세가 펼쳐지는지(구v1/신v2 각각), B그룹(풀스크린
      인텐트)이 이 병합 빌드에서도 여전히 동작하는지
- [ ] tsconfig 안정화 여부 (`experiments.typedRoutes` 적용 후 `expo start` 반복 실행으로 include 배열 되돌아가지 않는지 재확인)
- [ ] `phase-4-2`/`fullscreen-intent`/`phase-4-3` 브랜치 + `power-nap-phase43` worktree
      정리(삭제) — 전부 main 병합 완료로 더 이상 필요 없음, 삭제는 사용자 확인 후
- [ ] 출시 전 체크리스트: `src/config.ts`의 `SHOW_TEST_BUTTONS`를 `false`로(CLAUDE.md
      코드 규칙 참고), 그 외 출시 준비 항목은 사용자 지시로 구체화 예정

---

**작업 완료 조건**: 앞으로 매 작업을 완료할 때마다 이 파일(STATUS.md)을 갱신한다.
