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

- **Phase B — AI 파이프라인**(`main`에 직접 커밋) — AI_ANALYSIS.md §5, 사용자 명시 지시로 착수:
  - `supabase/migrations/0002_analysis_pipeline.sql`: `analyses.turns`(jsonb, 후속 대화
    이력) 컬럼 추가. `record_analysis_result()` RPC — Claude 호출 **성공 후에만**
    `credit_events` insert + `analyses` insert를 한 트랜잭션으로 묶는다("호출 전 예약 →
    실패 시 환급" 대신 "성공 후 차감" 선택 — 예약→환급 방식은 환급 자체가 실패하면 사용자가
    서비스 없이 차감만 당하는 상태가 남을 수 있어 AI_ANALYSIS.md §8 "실패 시 크레딧 미차감"
    요구사항에 더 취약; 근거는 마이그레이션 주석 참고). `append_followup_turn()` RPC —
    `followup_turns_used < 3` 조건을 UPDATE의 WHERE절에 넣어 동시 요청에서도 3턴 초과를
    원자적으로 막는다.
  - `supabase/migrations/0003_lock_rpc_permissions.sql`: **도그푸딩 중 발견한 보안 구멍
    수정** — Postgres/Supabase가 새 함수의 EXECUTE를 기본적으로 anon/authenticated에도
    열어두는데(0001의 `has_weekly_free`도 포함), `REVOKE ... FROM public`만으로는 안
    막힌다는 걸 실제 anon 클라이언트로 RPC를 직접 호출해보고 발견(발견 즉시 수정 원칙).
    `anon, authenticated`에서 명시적으로 revoke, `service_role`에만 grant. 수정 전/후
    양쪽 다 anon 클라이언트로 직접 검증함.
  - `supabase/functions/analyze/prompts/analysis-v1.ts`: 시스템 프롬프트(BACKLOG.md 문헌
    근거 요약 + "제안만 하고 적용은 사용자가" 원칙 + 의학적 표현 제한 + 수면장애 의심 시
    전문가 상담 권유) + zod 스키마(`latencyAdjust`/`caffeineOnsetAdjust`/`summary`/
    `advice`/`confidence`) + 모델/토큰 상수.
  - `supabase/functions/analyze/index.ts` (Deno): JWT 인증(`admin.auth.getUser`, 익명
    세션 포함) → 기록 5개 미만 422 → `has_weekly_free()`로 무료/유료 분기(유료인데 잔액 0이면
    402) → Claude 호출(`client.messages.parse` + `output_config.format`(zodOutputFormat)로
    스키마 강제, 실패 시 1회 재시도) → 성공 시에만 `record_analysis_result` RPC로 원자적
    기록. 후속 질문은 같은 함수에서 `analysisId` 유무로 분기, `append_followup_turn` RPC로
    3턴 제한 강제.
  - 모델: AI_ANALYSIS.md 원문의 `claude-sonnet-4-6`은 작성 시점 기준 구형 — 실제 구현은
    `claude-sonnet-5`(현재 최신 Sonnet, structured outputs 지원)로 교체하고 문서도 갱신.
  - `supabase/tests/analyze.test.ts`: 배포된 함수를 HTTPS로 직접 호출하는 통합 테스트
    3개(401 미인증, 422 기록 부족, 200 정상 분석+후속질문+같은 주 재요청 402) — 매 실행마다
    실제 Claude 호출 2회 발생(소액 비용, sonnet-5 max_tokens 캡).
  - jest를 `app`/`supabase` 프로젝트로 나눈 구조가 아직 jest-expo 프리셋의 `EXPO_PUBLIC_*`
    바벨 인라인 플러그인을 태워 `expo/virtual/env.js`(ESM) 파싱 에러가 났음 — `supabase`
    프로젝트 전용 transform을 `@babel/preset-typescript` + commonjs 변환만으로 재구성해
    `babel-preset-expo`를 완전히 배제, 해결.
  - `tsconfig.json`에 `supabase/functions` exclude 추가 — Deno 전용 문법(`Deno.serve`,
    `npm:` import specifier)이 앱 tsc 검사에 걸리는 문제 발견 즉시 수정.
  - **로컬 `supabase functions serve` 검증은 Docker Desktop 데몬이 꺼져 있어 스킵** —
    대신 배포 후 실제 HTTPS 엔드포인트로 401/422/200(실제 Claude 리포트)/후속질문/402
    전체 시나리오를 직접 호출해 검증(이 방식이 로컬 serve보다 넓은 범위를 실증함,
    다만 사용자가 요청한 정확한 절차는 아니었음 — Docker Desktop 켜면 이후 로컬 serve도
    가능).
  - 익명화 샘플: 기기 AsyncStorage에 직접 접근할 수 없어 store.ts `NapRecord` 스키마와
    동일한 구조의 합성 데이터로 테스트(원본 스키마 자체에 개인정보 필드가 없어 실기록을
    구했어도 실질적 차이는 적음).
  - jest 34개 통과(기존 31개 + analyze 통합 3개), tsc(exclude 반영)/expo-doctor/expo export
    3종 통과. 커밋 4개로 분리(migrations/prompt/function/tests).
  - **Phase B 완료.** Phase C(앱 통합 — 동의 UI/분석 진입점/리포트 화면/후속질문 UI)는
    별도 지시 시 착수.

- **Phase C — 앱 통합**(`ai-analysis-app` 브랜치) — AI_ANALYSIS.md §6, 사용자 명시
  지시로 착수:
  - `src/store.ts`: `getAiConsent`/`setAiConsent`(AsyncStorage, `null`=아직 안 물어봄/
    `true`=동의/`false`=거부 — 거부해도 재진입 시 다시 물어봄, tri-state), `MIN_RECORDS_FOR_ANALYSIS`
    (=5, 클라이언트 진입점 비활성과 Edge Function 422 판정이 같은 값을 쓰도록 export),
    `canRunAnalysis(count)`, `computeSuggestionApplication(mode, current, delta)`(AI 제안
    ± delta를 clamp해 적용값 계산 — 순수 함수). `NapRecord.manualAdjust.source`에
    `'ai-analysis'` 추가(기존 `'feedback'`/`'settings'`와 나란히, 출처 구분 유지).
  - `src/supabase.ts`: `ensureAnonymousSession()`이 `accessToken`도 함께 반환하도록 변경 —
    **발견**: `supabase-js`의 `client.functions.invoke()`는 세션 JWT를 자동으로
    Authorization 헤더에 넣어주지 않는다(`client.functions`는 매 호출마다 새
    `FunctionsClient`를 만들고 생성 시점의 정적 헤더만 물려받음, 세션 갱신과 무관) —
    소스 직접 확인 후 호출부에서 매번 명시적으로 헤더를 넣는 방식으로 설계.
  - `src/aiAnalysisErrors.ts` 신규 분리(순수 함수만): `mapInvokeErrorToAnalysisError`,
    `isAnalysisError`. `src/aiAnalysis.ts`가 아니라 별도 파일로 뺀 이유: `aiAnalysis.ts`는
    `supabase.ts`를 끌어오는데 `supabase.ts`는 모듈 로드 시점에 `EXPO_PUBLIC_SUPABASE_*`
    env var가 없으면 즉시 throw한다 — jest `app` 프로젝트는 `.env`를 안 읽으므로, 같은 파일에
    있었다면 에러 매핑 테스트가 항상 깨졌을 것(발견 즉시 구조 분리로 수정).
  - `src/aiAnalysis.ts`: `requestAnalysis`/`requestFollowup` — `supabase.functions.invoke`에
    Authorization/apikey 헤더 명시, `FunctionsHttpError`면 `error.context.json()`으로 서버
    에러 바디 파싱해 `AnalysisError`로 매핑.
  - `app/analysis-consent.tsx`: 최초 1회(또는 거부 후 재진입 시) 동의 화면 — 전송 안내 +
    처리방침 자리(URL 미정, "준비 중" 표기) + 동의/다음에.
  - `app/analysis.tsx`: loading → report(요약/조언/± 제안 항목별 "설정에 반영하기" 버튼 +
    고정 하단 고지문 — LLM이 advice에 넣는 고지와 별개로 앱이 항상 렌더) →
    insufficient_credit(402, "이번 주 무료 분석을 사용했어요" + 결제 버튼은 비활성 "준비
    중" — Phase D에서 활성화) → 후속 질문(턴 카운터, 3턴 소진 시 입력 비활성). "설정에
    반영하기"는 `applyManualAdjustment` + `appendNapRecord(source:'ai-analysis')`로 기존
    수동 조정 경로 재사용.
  - `app/history.tsx`: 상단에 "AI 분석" 진입점 — `canRunAnalysis`로 5개 미만 비활성 +
    안내 캡션. 탭 시 `getAiConsent()`로 분기(true면 `/analysis`, 그 외엔
    `/analysis-consent`).
  - `app/settings.tsx`: "데이터 및 분석" 섹션 추가 — 동의 상태 표시 + 토글 버튼(동의
    철회/재동의, AI_ANALYSIS.md §6 "동의 철회" + 사용자 지시 "설정에서 재동의 가능").
  - **실기기 미검증 항목**(사용자 확인 필요): 동의 화면 표시/버튼 동작, 히스토리 5개 미만
    비활성 문구, 실제 분석 요청 → 리포트 렌더 → "설정에 반영하기" 탭 시 설정 화면에 실제
    반영되는지, 후속 질문 3턴 후 입력창 비활성, 402(무료 소진) 화면, 설정 화면 동의
    토글, 키보드 올라왔을 때 후속 질문 입력창 가려짐 여부(Android).
  - DESIGN_HANDOFF 준수 확인: 신규 화면 3개(analysis-consent/analysis 화면, settings
    추가분) 아이콘 0개, `theme.ts` 토큰만 사용(하드코딩 색상 없음).
  - jest 48개 통과(기존 34개 + store 8개 + aiAnalysisErrors 6개), tsc(라우터 타입 재생성
    필요했음 — `expo start` 한 번 띄워야 `.expo/types/router.d.ts`가 새 라우트를 인식,
    `expo export`만으로는 안 됨)/expo-doctor/expo export 3종 통과. 커밋 2개(데이터 계층/
    화면).
  - **Phase C 완료(실기기 검증 대기).**

- **`wake-checklist` → `main` 병합**: 기상 직후 행동 체크리스트(커밋 `0e7d469`) —
  충돌 없이 자동 병합(겹친 파일 `feedback.tsx`/`history.tsx`/`store.ts`/`store.test.ts`는
  전부 서로 다른 영역 수정이라 git이 자동으로 합침). 병합 후 main에서 tsc/expo-doctor/
  expo export/jest(40개) 4종 재검증 통과. **실기기 검증은 아직**.

- **`main`(wake-checklist 포함) → `ai-analysis-app` 병합**: `STATUS.md`/`app/history.tsx`
  충돌(둘 다 같은 파일 수정) — 수동 정리. `app/history.tsx`는 두 기능이 서로 다른 영역이라
  단순 병합(AI 분석 진입점 + 기상 체크리스트 상세행 공존). `app/feedback.tsx`는 예상과 달리
  충돌 없이 자동 병합(Phase C가 feedback.tsx를 건드리지 않아서).
- **릴리즈 빌드 1차 + 실기기 설치**: `expo prebuild --clean` → `gradlew assembleRelease`
  성공, `aapt dump permissions`로 최종 APK 매니페스트 재확인(`USE_FULL_SCREEN_INTENT` 등
  정상). adb 인증이 처음엔 `unauthorized`로 막혀 있었음 — 케이블 재연결 + "이 컴퓨터에서
  항상 허용" 체크로 해결(흔한 함정, 코드 이슈 아님). `adb install -r`로 설치 완료.

- **Phase C 확장 — 분석 기록 열람 + 기간 선택**(`ai-analysis-app` 브랜치 이어서, 사용자
  명시 지시) — AI_ANALYSIS.md §2·§5·§6 갱신:
  - `src/analysisTypes.ts`(순수 타입: `AnalysisReport`/`FollowupTurn`/`AnalysisListItem`/
    `AnalysisDetail`/`MAX_FOLLOWUP_TURNS`)와 `src/analysisDisplay.ts`(순수 표시 로직:
    `formatAnalysisListLabels` — 같은 날짜 여러 건이면 시각 병기, `turnsToExchanges` —
    저장된 turns를 Q&A 쌍으로 묶음)를 신규 분리 — `aiAnalysisErrors.ts`와 같은 이유
    (supabase.ts env var 가드를 안 타야 jest "app" 프로젝트에서 테스트됨).
  - `src/store.ts`: `filterAnalyzableRecords(records, sinceMs?)`(isTest 항상 제외 +
    기간 필터), `AnalysisPeriod`/`periodSinceMs`(1주/2주/1개월(달력 기준)/전체), 분석
    목록·상세 로컬 캐시(`getCachedAnalysisList`/`Detail`, `setCached...`) +
    `resolveAnalysisList`/`resolveAnalysisDetail`(순수 폴백 판정 — `fetched ?? cached`,
    캐시 폴백 로직을 네트워크 I/O와 분리해 목킹 없이 테스트).
  - **발견·수정**: 히스토리 화면의 "AI 분석" 활성화 판정(`canRunAnalysis`)이 그동안
    `records.length`를 그대로 썼다 — isTest 낮잠도 포함해 카운트하던 버그. 지난 세션
    확인 요청 사항이었음, `filterAnalyzableRecords`로 교체해 수정.
  - `src/aiAnalysis.ts`: `listAnalyses()`/`getAnalysisDetail(id)` 추가 — `analyses`
    테이블을 RLS(본인 행만)로 **직접 SELECT**(Edge Function 안 거침, 읽기 전용이라
    RLS만으로 충분). 실패 시 로컬 캐시로 폴백. `AnalysisResult`에 `recordsUsed` 필드
    추가.
  - `supabase/functions/analyze/index.ts`: 수신 records를 `completedAt` 최신순 정렬 후
    50개로 컷(`MAX_RECORDS`, 토큰 비용 방어선) — 초과분은 에러 없이 조용히 버림, 응답에
    `recordsUsed` 포함.
  - `app/analysis-period.tsx` 신규: 프리셋 칩(1주/2주 기본/1개월/전체) + 선택 기간의
    유효 기록 수 실시간 표시 + 분석하기 버튼(5개 미만 비활성). 동의 화면 다음 단계로
    삽입(`analysis-consent.tsx`의 리다이렉트 대상을 `/analysis` → `/analysis-period`로
    변경).
  - `app/analysis-history.tsx` 신규: 지난 분석 목록(`"7월 8일 분석"`, 같은 날 여러 건이면
    시각 병기) — 탭하면 `/analysis?id=X`로 이동.
  - `app/analysis.tsx` 구조 변경: `since`(새 분석, 기간 필터) / `id`(지난 분석 열람) 두
    진입 경로를 하나의 화면이 처리. **발견·수정**: 기존엔 `useRef` 1회성 가드로 마운트
    시 딱 한 번만 로드했는데, 히스토리 목록에서 다른 분석 id로 연달아 이동하면 화면
    인스턴스가 재사용되면서 "적용됨" 상태나 리포트가 이전 것으로 남을 위험이 있었음 —
    `requestKey`(id 또는 since 조합)를 `useEffect` 의존성으로 바꿔 매번 완전히 다시
    로드·초기화하도록 재구성.
  - `app/history.tsx`: "AI 분석" 옆에 "지난 분석 보기" 진입점 추가, isTest 카운트 버그
    수정(위 참고).
  - jest 73개 통과(기존 48개 + store 신규 12개 + analysisDisplay 6개 + analyze 통합
    신규 1개), tsc(라우터 타입 재생성 필요 — 동일 패턴)/expo-doctor/expo export 3종
    통과. Edge Function 재배포 후 통합 테스트 재확인(recordsUsed 필드, 50개 컷 실증).
    커밋 4개(데이터 계층/화면/Edge Function/문서)로 분리.
  - **Phase C 확장 완료(실기기 검증 대기).** 릴리즈 재빌드 → 설치 대기.

- **릴리즈 빌드 2차 + 실기기 재설치**: app.json/네이티브 설정 변경 없어 `prebuild` 없이
  `gradlew assembleRelease`만 재실행, `adb install -r`로 설치 완료. 두 번째부터는 adb
  인증이 바로 됨(첫 연결 때만 겪는 문제였음).

- **무료 리셋 카운트다운**(`ai-analysis-app` 브랜치 이어서, 사용자 명시 지시) — 402
  화면 + 히스토리 "AI 분석" 진입점에 "다음 무료 분석까지 N일 N시간 N분" 표시:
  - **설계 제약 발견**: `has_weekly_free` RPC는 Phase B에서 이미 anon/authenticated로부터
    잠가둔 상태(migrations/0003)라 클라이언트가 직접 못 부른다 — Edge Function에 가벼운
    `mode: 'status'` 분기를 추가해 유일한 조회 경로로 삼음(NapRecord 없이 RPC 하나만
    호출, Claude 비용 없음).
  - 리셋 시각 계산은 Postgres `week_start_kst()`를 다시 호출하지 않고 Deno 쪽에
    동일 공식을 그대로 복제(analyze.test.ts의 `mondayKstBoundaryUtc`와 같은 공식 —
    이미 DB 함수와 일치함이 검증돼 있어 안전하게 재사용). 이 값 자체가 Edge Function
    서버 시각 기준이라 기기 시각 조작과 무관("서버 시각 기준" 요구사항 충족).
  - 클라이언트 카운트다운은 "서버가 준 remaining을 fetch 시점에 고정 → 이후엔 기기의
    경과 시간(델타)만 더해 틱" 방식(`useFreeResetStatus`, 분 단위 갱신) — 기기의 절대
    시각이 아니라 경과 시간만 신뢰하므로 기기 시각을 바꿔도 카운트다운 자체는 정상
    흐름(단, 표시 목적일 뿐 실제 크레딧 판정은 항상 서버가 함 — 애초에 위조해도 의미 없음).
  - 히스토리 진입점은 **동의 전에는 상태를 조회하지 않음**(consented===true && 분석
    가능할 때만 훅 활성화) — "동의 전엔 서버로 아무것도 안 보낸다" 원칙 유지.
  - **회귀 버그 발견·수정**: `useFreeResetStatus`(신규 훅)가 `aiAnalysis.ts` →
    `supabase.ts`로 이어지는 체인을 끌어오면서, `supabase.ts`가 모듈 로드 시점에 env
    var 없으면 즉시 throw하던 것 때문에 `app/history.tsx`를 import하는
    `app/history.test.ts`(순수 함수 `detailText` 등만 테스트하는 파일)까지 덩달아
    깨짐. `supabase.ts`를 지연 초기화(`getSupabase()`, 최초 실제 호출 시점에만 env var
    확인)로 바꿔 근본 수정 — `.env` 없는 환경에서도 화면 컴포넌트를 끌어오는 테스트가
    깨지지 않게 됨(같은 부류 문제가 세션 내내 반복돼 이번엔 아예 구조로 막음).
  - jest 80개 통과(기존 73개 + analysisDisplay 5개 + analyze 통합 2개), tsc/expo-doctor/
    expo export 3종 통과. 커밋 3개(Edge Function/데이터 계층/화면)로 분리, push 완료.
  - **실기기 검증 대기** — 재빌드·재설치는 사용자 지시 시.

- **프롬프트 보강 + 출력 언어 변수화**(`ai-analysis-app` 브랜치 이어서, 사용자 명시 지시) —
  BACKLOG.md 문헌 근거 4건 반영 + advice 가이드 확장 + 다국어 대비 출력 언어 변수화:
  - `BACKLOG.md`에 "AI 분석 조언 근거" 섹션 신규(낮잠 최적 시간대/타이밍 개인차/환경
    최적화/낮잠 빈도, 출처 명시 — Harvard Health 2024/RISE/PUIRP 2024/크로노타입
    constant routine 연구/Studley) + "v1.2" 섹션 신규(앱 전체 i18n, locale 실제 전달은
    여기로 이관).
  - `supabase/functions/analyze/prompts/analysis-v2.ts` 신규(v1 유지, 파일명으로만
    버전 추적하는 기존 관행 유지 — DB 컬럼 추가는 이번에도 보류, 현재 규모에선 git
    히스토리로 충분하다고 판단): `LITERATURE_BASIS`에 신규 4건 추가(총 7개), "조언
    가이드"(늦은 시간대 낮잠 패턴을 크로노타입 개인차 인정하며 짚기/소음·빛 점수 낮으면
    안대·귀마개 제안/하루 3회+면 빈도 언급) + "제외할 것"(90분 낮잠 — 앱 정체성 충돌,
    장기 건강효과 주장 — 상관관계·의학효능 리스크) 섹션 신규. `SYSTEM_PROMPT` 상수를
    `buildSystemPrompt(outputLanguage='ko')` 함수로 전환(출력 언어 줄만 변수화, 나머지
    지시문은 Claude 내부 지시라 한국어 고정). `toKstTimeLabel` 신규 — 기록에
    `localTimeKst` 필드를 붙여 모델이 시간대 조언 시 직접 epoch 계산 없이 비교하게 함.
  - `supabase/functions/analyze/index.ts`: import를 `analysis-v2.ts`로 교체,
    `callAnalysis`가 `locale` 인자를 받아 `buildSystemPrompt(locale)` 사용,
    `handleAnalyze`/`handleFollowup` 양쪽에서 `body?.locale ?? 'ko'` 추출.
  - `src/aiAnalysis.ts`: `requestAnalysis`/`requestFollowup` 요청 바디에 `locale: 'ko'`
    고정 전송(실제 로케일 반영은 BACKLOG.md v1.2 몫).
  - Edge Function 재배포 완료, jest 80개(기존과 동일 개수 — analyze.test.ts는 스키마/
    상태코드만 검증해 프롬프트 내용 변경으로 깨지지 않음, 실제 재배포된 v2 대상으로
    재통과 확인)/tsc/expo-doctor/expo export 4종 통과. 커밋 3개(BACKLOG/v2 프롬프트/
    Edge Function+앱 연동)로 분리, push 완료.
  - **재빌드 안 함** — 사용자 지시로 무료 리셋 카운트다운 작업과 묶어 다음 빌드 지시에서
    한 번에 처리.

- **릴리즈 빌드 3차 + 실기기 재설치 + 통합 실기기 검증 완료**: app.json/네이티브 설정
  변경 없어 `prebuild` 없이 `gradlew assembleRelease`만 재실행, `adb install -r`로
  설치(무료 리셋 카운트다운 + 프롬프트 보강/출력 언어 변수화 반영분). 사용자가 직접
  기기에서 검증 진행, 아래 항목 전부 통과 확인:
  - Phase 4-3 설문 후기(세그먼트 탭·기본값 '중', 메모 저장, 제출/건너뛰기, 설정 화면·
    "직접 조정하기" 수동 조정, 히스토리 v1/v2 기록 공존, 상세 아코디언 펼침)
  - B그룹 풀스크린 인텐트(화면 꺼짐/잠금 상태 자동 점등 + 해제 화면 직행) 재확인
  - Phase C AI 분석 전 구간(기록 5개 미만 비활성, 동의 화면, 기간 선택, 리포트 렌더,
    "설정에 반영하기", 후속 질문 3턴 제한, 설정 화면 동의 토글, Android 키보드 가림
    없음)
  - 분석 기록 열람(목록·상세 재열람), 402 화면 카운트다운, 히스토리 진입점 카운트다운,
    결제 버튼 비활성 유지
  - analysis-v2 프롬프트 조언 내용 방향성(90분 낮잠 미언급, 장기 건강효과 단정 없음,
    늦은 시간대 낮잠 언급 시 개인차 인정하는 톤) 확인
  - **Phase 4-3·기상 체크리스트·B그룹·Phase C(AI 분석 전체)·무료 리셋 카운트다운·
    프롬프트 v2 전부 실기기 검증 완료로 확정.**

- **`ai-analysis-app` → `main` 병합 완료**: 실기기 통합 검증(위 항목) 통과 확인 후
  병합. 충돌 없이 자동 병합(22개 파일, `ai-analysis-app`이 건드린 파일과 `main`이
  단독으로 건드린 파일이 겹치지 않았음). 병합 후 `main`에서 tsc/expo-doctor/
  expo export/jest(80개) 4종 재검증 통과, push 완료. `main`이 이제 AI 분석 기능
  (Phase A~C, 무료 리셋 카운트다운, analysis-v2 프롬프트) 전부 포함.

- **다국어(한/영) 지원**(`i18n` 브랜치, `main` 기준 분기, 사용자 명시 지시) — 한국어(기본)
  + 영어, 확장 가능한 구조:
  - `expo-localization` + `i18next`/`react-i18next` 도입. `src/i18n.ts`: 리소스는
    `locales/ko.json`/`locales/en.json` 단일 파일(화면별 네임스페이스는 파일 내부 최상위
    키로 분리)에서 정적 import, 네트워크 백엔드 없이 동기 초기화(`init()` 직후 `t()` 즉시
    동작). 언어 결정: AsyncStorage 수동 선택('ko'/'en') > 기기 언어 > 'ko' 폴백.
    AsyncStorage는 `getSupabase()`와 같은 이유로 함수 내부에서 지연 import(모듈 최상단
    import 시 순수 함수 테스트가 jest.mock 없이 깨지는 걸 방지).
  - 앱 전체 하드코딩 한국어 문자열을 화면 그룹 7개(홈/수면/알람/후기/분석/설정/히스토리)로
    나눠 커밋 분리해 전수 추출: `app/index.tsx`, `app/sleep.tsx`, `app/alarm.tsx`+
    `src/notifications.ts`(OS 알림 제목/본문 포함), `app/feedback.tsx`, `app/history.tsx`
    (`detailText`/`detailRows`/`surveySummary`/`wakeChecklistSummary` 등 순수 함수는
    컴포넌트 밖이라 `useTranslation()` 훅 대신 전역 `i18n.t()` 직접 사용), `app/settings.tsx`
    (+ 언어 선택 UI 신규: 기기 설정 따름/한국어/English), `app/analysis*.tsx` 4개 +
    `src/analysisDisplay.ts`. 최종 sweep(`grep [가-힣]` 전수 확인, 주석 제외)으로
    `src/aiAnalysis.ts`/`src/aiAnalysisErrors.ts`의 네트워크/알수없음 에러 폴백 메시지도
    누락분으로 발견해 추가 로컬라이즈.
  - `src/format.ts`: `formatKoreanTime`/`formatKoreanDateTime` → `formatTime`/
    `formatDateTime`로 개명, 언어별 포맷터 레지스트리로 전환(ko: "오전/오후 h:mm", en:
    "h:mm AM/PM" 등) — 새 언어 추가 시 포맷터만 더하면 됨. 인자 생략 시 `i18n.language`
    따름(화면이 `useTranslation()`으로 언어 변경 시 리렌더되면 인라인 호출도 같이 갱신).
  - AI 분석 요청의 `locale`을 고정 `'ko'` 대신 실제 앱 언어(`i18n.language`)로 전송
    (`aiAnalysis.ts`) — Edge Function의 `buildSystemPrompt(locale)`은 이전 세션에서
    이미 준비돼 있어 앱 쪽 연결만 하면 됐음.
  - 폰트 검증: `fonttools`로 Pretendard 4종 weight 전부 A-Z/a-z/0-9 + 특수문자(em dash/
    middle dot/arrow/ellipsis) 글리프 커버리지 직접 확인 — 전부 포함, 폴백 폰트 불필요.
  - 번역 검수 안전장치: 사용자가 영어 원어민 검수를 할 수 없는 상태라 `REVIEW_NEEDED.md`
    신규 — 우선순위 1(알람/해제 방법), 2(의학 고지문), 3(동의/개인정보 문구), 4(관용구·
    문장구조 리스크) 순으로 정리. Edge Function의 401/422/402 등 JSON 에러 메시지는
    여전히 서버에 한국어로 하드코딩돼 있어 앱이 영어 모드여도 그대로 노출되는 한계를
    별도 절로 명시(이번 작업 범위 밖 — Edge Function 재수정 필요).
  - **발견(번역과 무관, 우연히 찾은 기존 버그)**: `home.learnNote`("후기를 반영해 시간이
    자동으로 조정돼요")가 Phase 4-3에서 자동 조정 학습을 폐지한 이후에도 안 고쳐져
    있음 — 문구가 실제 동작(수동 조정만)과 어긋난다. 이 브랜치는 번역만 하고 원문은
    그대로 옮김, 문구 수정은 범위 밖이라 별도 확인 필요.
  - BACKLOG.md "v1.2" 섹션의 i18n 항목을 "구현됨 (i18n)" 섹션으로 승격, 스토어 등록정보/
    개인정보처리방침 영어판은 Phase E로 계속 이관.
  - jest 91개 통과(기존 80개 + `src/i18n.test.ts` 신규 11개 — 언어 전환/로케일 포맷/
    ko·en 키 완전 일치 검증)/tsc/expo-doctor/expo export 4종 통과. `supabase` 프로젝트
    통합 테스트는 이 브랜치와 무관하게 세션 내 반복 실행으로 Supabase anon-auth rate
    limit에 걸려 일시 실패 — `supabase/` 디렉터리는 이 브랜치에서 전혀 건드리지 않음
    (확인됨), 무관한 일시적 인프라 이슈로 판정.
  - 커밋 10개로 분리(infra+홈/수면/알람/후기/설정/히스토리/분석/테스트+REVIEW_NEEDED/
    tsc 타입 수정 2건).
  - **실기기 미검증**: 언어 선택 UI 동작, 영어 전환 시 전 화면 렌더링, 영어 폰트
    렌더링 실물 확인(글리프 커버리지는 코드로 확인했지만 실제 화면 표시는 별도).
    재빌드는 이번 지시에 포함 안 됨 — 다음 지시 대기.

- **i18n 마무리 3건 + `main` 병합**(`i18n` 브랜치 이어서, 사용자 명시 지시) — 병합 전
  마지막 정리:
  1. **서버 에러 메시지 언어 불변화**(발견 2 해결): `analyze` Edge Function의 JSON
     에러 응답에서 `error`(안정적 snake_case 코드)만 클라이언트 계약으로 확정,
     `message`는 서버 로그/디버그 전용 영어 텍스트로 전환(과거엔 한국어 하드코딩이라
     앱이 영어 모드여도 그대로 노출됐음). `src/aiAnalysisErrors.ts`가 이제 `error`
     코드를 `locales/*.json`(`analysisReport.serverError.*`)으로 직접 매핑 —
     `Record<AnalysisErrorCode, string>` 타입이라 새 코드 추가 시 매핑 누락은 TS
     컴파일 에러. 이 원칙(서버는 언어 불변, 에러 코드만 계약)을 CLAUDE.md "핵심
     원칙"에도 기록. Edge Function 재배포 완료.
  2. **learnNote 문구 수정**(발견 1 해결): "후기를 반영해 시간이 자동으로 조정돼요"
     (Phase 4-3 자동조정 폐지 후에도 안 고쳐져 있던 문구)를 "문헌 근거로 정한
     기본값이에요. 다르게 느껴지면 후기나 설정에서 직접 조정할 수 있어요"로 ko.json/
     en.json 양쪽 교체.
  3. **supabase 통합 테스트 rate limit 확인**: 30분 대기 후 재실행해 11개 전부
     클린 통과 확인(credit-ledger 5개 + analyze 6개) — 재시도 중간 결과(1→3→8→3개
     통과, 재실행 자체가 anon 로그인 요청을 더 만들어 한도를 다시 깎는 패턴 관찰)로
     코드 회귀가 아니라 순수 rate limit이었음을 최종 확인. 스킵/무시 없이 실제
     클린 패스로 검증.
  - jest 92개(기존 91개 + `aiAnalysisErrors.test.ts` 신규 케이스 1개: 영어 로케일
    에러 메시지)/tsc/expo-doctor/expo export 4종 통과. 커밋 3개(서버 에러 계약/
    learnNote/이 문서).
  - **`i18n` → `main` 병합 완료**(fast-forward, `main`이 그동안 변경 없어 충돌 없음).
    병합 후 `main`에서 4종 재검증 통과, push 완료. `main`이 이제 한/영 다국어 전체
    포함.

- **알림 권한(POST_NOTIFICATIONS) 거부 시나리오 실기기 검증 반영**(`main`, 아직 커밋
  전) — 사용자가 실기기에서 직접 검증 완료: 소리·진동은 권한과 무관하게 항상 발화,
  화면 자동점등+해제 화면은 권한 필요 + 화면 꺼짐/잠금 상태에서만(화면 켜짐+잠금해제
  시엔 권한 있어도 헤드업 배너만 — 기존에 확인된 OS 정책과 동일 원인). 결과를
  `PROJECT.md` §4에 4행 표로 기록.
  - `app/sleep.tsx`: Android + 권한 거부 조합의 안내 문구를 검증 결과에 맞게 최종
    확정("알람 소리와 진동은 울려요. 다만 알림 권한이 없어 화면이 자동으로 켜지지
    않으니, 알람이 울리면 직접 앱을 열어 꺼주세요") + "권한 허용하기" 버튼 신규
    (`Linking.openSettings()`로 앱 설정 화면 딥링크 — 알림 설정 전용 인텐트는 패키지명
    조회에 새 네이티브 의존성이 필요해 범위 밖으로 판단, 앱 설정에서 한 번 더 탭하면
    도달 가능).
  - `useNapWatchdog` 코드 재확인: 권한 없이 알람 발화 중 앱을 직접 열어도(알림 배너
    없이) 마운트 시 `alarmAt` 경과를 판정해 즉시 `/alarm`으로 보낸다 — 권한 여부를
    전혀 참조하지 않는 로직이라 이미 정상 동작(코드 확인만, 수정 불필요).
  - `locales/ko.json`/`en.json`: `sleep.permissionHintAndroid` 갱신 + `sleep.permissionButton`
    신규 키 양쪽 추가. `REVIEW_NEEDED.md` 1순위에 두 키 신규 미검수 항목으로 추가.
  - 커밋 `813bca8`("fix: permission-independent alarm + denied-state guidance") push
    완료. **릴리즈 빌드 4차 + 실기기 재설치 완료** — app.json/네이티브 설정 변경 없어
    `prebuild` 없이 `gradlew assembleRelease`만 재실행, `adb install -r`로 설치.
    (adb 인증이 `unauthorized`로 막혀 있었음 — 케이블/화면 잠금 상태에서 폰 쪽 승인
    팝업이 안 뜬 것으로 추정, 화면 잠금 해제 후 팝업에서 승인해 해결 — 기존에도 겪은
    흔한 함정, 코드 이슈 아님.)
  - **실기기 검증 대기**: 위 STATUS.md "미해결 항목"의 `useNapWatchdog` `/alarm` 직행
    실증(콜드 스타트/백그라운드 복귀), 신규 "권한 허용하기" 버튼 실제 동작, 최종 확정된
    안내 문구 표시 — 전부 사용자가 폰에서 직접 진행.

- **"권한 허용하기" 버튼 개선**(`main`, 사용자 명시 지시) — 위 항목의 `Linking.openSettings()`
  방식을 대체:
  - `expo-intent-launcher` 신규 설치(`npx expo install`) — Android에서
    `ACTION_APP_NOTIFICATION_SETTINGS` 인텐트로 앱의 "알림" 설정 화면에 직행(extra:
    `android.provider.extra.APP_PACKAGE`, 패키지명은 `expo-constants`의
    `Constants.expoConfig?.android?.package`로 조회). 패키지명을 못 얻거나 인텐트
    자체가 실패하면(제조사 커스텀 설정 앱 등) `Linking.openSettings()`로 폴백. iOS는
    동급 세부 인텐트가 없어 처음부터 `openSettings()`. `src/notifications.ts`에
    `openNotificationSettingsAsync()`로 캡슐화.
  - 버튼 위에 켜야 할 토글 이름을 명시한 안내 문구(`sleep.permissionGuide`) 추가.
    화면 위에 토글을 직접 가리키는 오버레이/하이라이트는 구현하지 않음 —
    `SYSTEM_ALERT_WINDOW`(다른 앱 위에 그리기) 권한이 새로 필요한데, 알림 권한 하나
    받으려고 더 민감한 권한을 요청하는 건 본말전도고 스토어 심사에도 불리(판단 근거는
    `app/sleep.tsx` 인라인 주석에도 기록) — 텍스트 안내로 충분하다고 판단.
  - `src/notifications.ts`에 `getNotificationPermissionGrantedAsync()` 신규 —
    `app/sleep.tsx`가 `ActiveNap.notificationPermissionGranted`(낮잠 시작 시점 고정값)
    대신 별도 상태로 실시간 권한을 들고, `AppState`가 `'active'`로 복귀할 때(설정
    화면에서 돌아왔을 때) 재조회해 권한이 그새 허용됐으면 안내를 자동으로 감춘다.
  - `expo-intent-launcher`는 새 네이티브 모듈이라 `npx expo prebuild --platform android`
    필요(config plugin/권한 추가는 없음 — app.json 변경 없음, 커밋 후 `git status`로
    확인). prebuild가 `android/local.properties`를 비운 채로 재생성해 `sdk.dir` 수동
    기입 필요했음(일회성 환경 이슈, `android/`는 gitignore라 커밋 대상 아님).
  - tsc/expo-doctor/expo export/jest(88개) 4종 통과. 커밋
    `79ed57a`("feat: precise notification-settings deep link + live permission
    recheck") push 완료. **릴리즈 빌드 5차(prebuild 포함) + 실기기 재설치 완료**
    (adb `unauthorized` 재발 → 화면 잠금 해제 후 승인 팝업에서 해결, 5차부터도 같은
    패턴 반복 확인).
  - **실기기 검증 대기**: "권한 허용하기" 버튼이 실제로 앱 알림 설정 화면(일반 앱
    정보 화면이 아니라)으로 직행하는지, 설정에서 권한을 켜고 돌아오면 안내가 자동으로
    사라지는지, `permissionGuide` 문구 표시 — 전부 사용자가 폰에서 직접 진행.
  - 커밋 `813bca8`/`79ed57a`/`c9415d0` push 완료 — 위 "커밋 전"이던 표기 정정.

- **개인정보처리방침 "서버 데이터 삭제" 기능**(`main`, 사용자 명시 지시) —
  AI_ANALYSIS.md §6/§7 갱신:
  - `supabase/functions/delete-my-data`: 인증된 유저의 `auth.users` 행을
    `admin.auth.admin.deleteUser()`로 삭제 — `public.users`/`credits`/`credit_events`/
    `analyses`가 전부 기존 `on delete cascade` FK로 한 트랜잭션에 함께 정리된다
    (migrations/0001 스키마, `credit-ledger.test.ts`/`analyze.test.ts`의 테스트 유저
    정리가 이미 같은 전제로 쓰고 있던 검증된 메커니즘 — 새 마이그레이션/RPC 불필요).
    **판단(사용자 요청 사항): 익명 계정 자체도 삭제한다** — 이메일/비번 없는 익명
    계정이라 데이터만 지우고 신원을 남겨도 재사용 가치가 없고, 세션 무효화로 다음
    사용 시 새 익명 계정이 자동 발급되는 것도 §8의 기존 트레이드오프(기기 분실 시
    크레딧 소실)와 같은 성격이라 부자연스럽지 않다고 판단. 재시도해도
    `admin.auth.getUser(jwt)`가 이미 없는 유저로 자연스럽게 401을 내 별도
    idempotency 처리가 필요 없다. `config.toml`에 `[functions.delete-my-data]`
    등록(analyze와 동일하게 `verify_jwt = false`, 함수 안에서 수동 검증).
  - `src/aiAnalysis.ts`: 기존 `invoke<T>(body)`를 `invoke<T>(functionName, body)`로
    일반화(3개 기존 호출부 `'analyze'` 명시로 이관) + `requestDataDeletion()` 신규.
    `getCreditBalance()` 신규 — `credits` 테이블을 RLS(본인 행만)로 직접 조회
    (`listAnalyses`와 동일 패턴), 실패 시 null(fail-open, 삭제 자체를 막을 이유는
    아님) — 설정 화면 확인 다이얼로그의 "남은 이용권 n회" 경고에 사용.
  - `src/store.ts`: `clearAiLocalData()` 신규 — 삭제 성공 후 로컬 AI 동의 상태 +
    분석 목록/상세 캐시만 초기화(AsyncStorage.multiRemove). 로컬 낮잠 기록(NapRecord)은
    서버 데이터가 아니므로 안 건드림.
  - `app/settings.tsx` "데이터 및 분석" 섹션에 "서버 데이터 삭제" 버튼 추가 — 2단계
    확인(`Alert.alert` 안내 → 최종 확인, 이 화면에 기존 모달/바텀시트 컴포넌트가 없어
    새로 안 만들고 OS 네이티브 확인창 재사용). 안내 단계에서 크레딧 잔액이 있으면
    "남은 이용권 n회가 함께 삭제되며 복구할 수 없다" 경고를 덧붙임. 성공 시
    `clearAiLocalData()` + 동의 상태 false로 리셋 + 성공 안내, 실패 시 에러 안내.
  - `PRIVACY_POLICY.md` — 레포에 이미 커밋되지 않은 채(untracked) 존재하던 초안을
    발견(회사명 "라이프북", RevenueCat/Google Play 결제 처리자 명시, 연락처 포함 —
    이번 세션 이전에 사용자가 직접 작성해둔 것으로 보여 덮어쓰지 않고 그대로 커밋만
    함). §5가 이미 이번에 구현한 삭제 기능과 정확히 일치하는 절차를 설명하고 있어
    별도 수정 없음. 영어판은 없음(법률 문서라 UI 문자열보다 신중한 전문 번역이
    필요하다고 판단, REVIEW_NEEDED.md 3순위보다 더 신중하게 접근해야 할 문서 —
    Phase E에서 별도 처리).
  - `REVIEW_NEEDED.md` 3순위에 신규 삭제 확인 문구 3건(`deleteConfirmBody`/
    `deleteConfirmCreditWarning`/`deleteFinalBody`) 미검수로 등록. 겸사겸사
    `sleep.permissionButton`의 검수 메모도 지난 세션에 IntentLauncher로 바뀐
    실제 동작에 맞게 갱신(내용은 그대로 미검수).
  - `supabase/tests/delete-my-data.test.ts` 신규(analyze.test.ts와 동일한 실배포
    HTTPS 통합 테스트 패턴, Claude 호출 없어 비용 없음) — 4개 케이스: 인증 없이 401,
    삭제 후 4테이블 + auth 유저 전부 빈 결과, 타 유저 데이터 격리(RLS 아니라 앱
    로직상 자기 uid만 지우는지 확인), 삭제된 유저 JWT 재호출 시 401. **실제 배포
    (`supabase functions deploy delete-my-data`) 후 4개 전부 통과 확인** — 스킵/모킹
    없이 실서버 대상 검증.
  - jest(app) 88개 그대로 통과(신규 앱 코드가 기존 테스트를 안 건드림) + jest(supabase)
    신규 4개 통과, tsc/expo-doctor/expo export 3종 통과. 커밋 `23a4192`("feat: server
    data deletion...") push 완료(이 문서에 이전에 "push 전"이라 적어둔 건 정정 —
    같은 커밋에 STATUS.md도 함께 들어가 커밋 시점에 반영이 안 됐던 표기 오류).
  - **실기기 검증 대기**(사용자 진행): 설정 화면 "서버 데이터 삭제" 버튼 → 2단계
    확인 다이얼로그 → 크레딧 있을 때 경고 문구 표시 → 삭제 성공 시 동의 상태/캐시
    초기화 확인. **재빌드 불필요**(JS/Edge Function만 변경, 네이티브 의존성 추가
    없음 — 기존 설치본에서 Metro/dev 클라이언트로 확인 가능, 릴리즈 APK로 보려면
    재빌드 필요).

- **알람 해제 미션(명언 타이핑)**(`mission-alarm` 브랜치, `main`(`23a4192`) 기준 분기,
  사용자 명시 지시) — BACKLOG.md "알람 해제 미션"/PROJECT.md §6.3.5 신규 참고:
  - `Settings.missionEnabled`(기본 false) 신규 — `getSettings()` v3 마이그레이션에
    `?? false` 폴백 추가, `setMissionEnabled()` 신규(read-modify-write). `ActiveNap.
    missionCompleted?: boolean` 신규 + `markMissionCompleted()`.
  - `useNapWatchdog`의 라우팅 판정을 `resolveNapRoute(nap, missionEnabled, nowMs)`
    순수 함수로 분리(`NapRoute`에 `'/mission'` 추가) — 미션 on + 아직 미완료 +
    isTest 아님일 때만 `/alarm` 대신 `/mission`으로. 테스트 낮잠은 후기와 마찬가지로
    미션도 건너뛴다(기존 isTest 특례와 같은 이유). expo-router 타입드 라우트 재생성
    필요(신규 라우트라 `expo start` 1회 필요 — CLAUDE.md 지뢰 목록대로 tsc 전에 수행,
    `.expo/types/router.d.ts`는 gitignore라 커밋 대상 아님).
  - `app/mission.tsx` 신규: 명언 타이핑 화면. `src/missionQuotes.ts`에 한/영 각 18개
    로컬 상수(전부 자체 작성 — 실존 인물 인용구는 원문·출처 불확실성으로 배제).
    `normalizeMissionInput`(공백·구두점 제거+소문자화) 기반 관대한 대조, 건너뛰기
    없음, 3회 연속 실패 시 `pickShorterQuote`로 더 짧은 문구 교체. 하드웨어 뒤로가기
    차단(알람 화면과 동일).
  - **알람음·진동을 미션 중에도 유지**(CLAUDE.md 알람 신뢰성 원칙): 기존
    `app/alarm.tsx`에 있던 사운드(iOS)/햅틱 시작 로직을 `src/useAlarmPlayback.ts`로
    추출해 `app/mission.tsx`와 공유(모듈 레벨 `alarmPlaybackActive` 가드도 함께
    이전해야 두 화면 인스턴스 사이에서 겹침 없이 동작 — 각 파일에 따로 두면 가드가
    무력화됨). `alarm.tsx`는 동작 변경 없이 이 훅을 호출하도록만 리팩터.
  - 수학 문제 미션은 채택하지 않음 — 알라미 시그니처라 차별화 안 됨 + 낮잠 앱의
    "편안하게 깨어나기" 톤과 충돌한다고 판단, 근거를 BACKLOG.md에 기록.
  - `src/missionQuotes.test.ts`(정규화 비교, 더 짧은 문구 선택 로직) +
    `src/useNapWatchdog.test.ts`(resolveNapRoute — 미션 on/off·완료 여부·isTest
    조합 6케이스) 신규. `store.test.ts`에 `setMissionEnabled`/`markMissionCompleted`
    테스트 추가, 기존 "already-v3 설정 유지" 테스트 2건은 `missionEnabled` 필드
    반영해 갱신.
  - `locales/ko.json`/`en.json`: `mission` 네임스페이스 신규 + `settings.mission*`
    키(토글 섹션) 추가. `REVIEW_NEEDED.md` 1순위에 미션 관련 문구 5건(화면 문구 4개 +
    명언 en 배열 전체) 신규 미검수로 등록 — 알람을 실제로 끄는 유일한 경로라 안전
    카테고리로 분류.
  - jest 107개(기존 88 + missionQuotes 8 + useNapWatchdog 6 + store 신규 3, 갱신 2)
    /tsc/expo-doctor/expo export 4종 통과.
  - **실기기 검증 대기**: 미션 토글 ON 상태에서 알람 발화 → 명언 화면 → 정답 입력 시
    알람 해제 화면으로 전환 → 슬라이드/롱프레스 해제 → 기상 체크리스트/설문까지 전체
    흐름, 오타 재시도, 3회 실패 후 문구 교체, Android 네이티브 알람 소리가 미션
    화면에서도 끊김 없이 나는지, iOS에서 미션→알람 전환 시 소리 재시작 체감 여부.
    재빌드 불필요(네이티브 의존성 추가 없음).

- **"파워냅이란?" 정보 화면 → `mission-alarm`(→ `main`) 병합**(`about-powernap`
  브랜치는 이 문서를 직접 갱신하지 않았음 — 병합 시점에 한 번에 정리): 홈 화면 텍스트
  링크 + `app/about.tsx` 5개 섹션 카드 + 하단 고지문. 상세는 BACKLOG.md "구현됨
  ('파워냅이란?' 정보 화면)"/PROJECT.md §6.5 참고. `about-powernap` 단독으로는 tsc/
  expo-doctor/expo export/jest(88개, 신규 로직 없어 테스트 추가 없음) 4종 통과 확인됨.

- **세 브랜치 병합 + 정리**(사용자 명시 지시, 순서대로 진행):
  1. `about-powernap` → `main`(`d3b6e51`): 충돌 없이 자동 병합(`app/about.tsx` 신규 +
     `app/index.tsx` 링크만 겹쳤는데 서로 다른 위치라 git이 자동 처리).
  2. `main` → `mission-alarm`(`6042ffa`): `BACKLOG.md`/`PROJECT.md`에서만 충돌
     (둘 다 §6 헤딩 문구·"구현됨" 목록 근처를 건드림) — 두 브랜치의 새 절을 모두
     보존하는 방향으로 수동 정리(§6 헤딩은 "핵심 4개 화면 + 미션 화면 1개 + 정보
     화면 1개"로 통합). `app/index.tsx`/`locales/*.json`/`REVIEW_NEEDED.md`는
     자동 병합(서로 다른 영역).
  3. `mission-alarm` → `main`(`c4d20eb`): 충돌 없음(이미 2단계에서 main을 흡수해둔
     상태라 순방향 병합).
  - **라우팅 회귀 재확인**(사용자 지시대로 병합 직후 필수 확인): 병합 2단계 직후
    `useNapWatchdog.test.ts`(resolveNapRoute 6케이스)를 포함한 jest 전체가
    107개(기존 88 + missionQuotes 8 + useNapWatchdog 6 + store 5) 그대로 통과 —
    about 화면 병합이 라우팅 로직에 개입하지 않아 카운트가 정확히 합산됨. `main`에서도
    동일 107개로 재확인.
  - `main`에서 4종(tsc/expo-doctor/expo export/jest 107개) 재검증 통과, push 완료.
  - **실기기 검증 전부 대기**(사용자 진행) — 이번에 병합된 세 기능(서버 데이터 삭제는
    이전 세션에 이미 push됐던 것 포함) 중 실기기로 확인된 건 하나도 없음:
    1. 알림 권한 거부 상태의 `useNapWatchdog` `/alarm` 직행(콜드 스타트/백그라운드 복귀)
    2. "권한 허용하기" 버튼의 정밀 딥링크 + 복귀 시 안내 자동 숨김
    3. 설정 > 데이터 및 분석 > "서버 데이터 삭제" 2단계 확인 + 크레딧 경고 + 삭제 후
       로컬 상태 초기화
    4. 알람 해제 미션 전체 흐름(미션 ON → 명언 화면 → 슬라이드/롱프레스 → 체크리스트/
       설문, 오타 재시도, 3회 실패 후 문구 교체, Android/iOS 소리 연속성)
    5. "파워냅이란?" 화면 진입/스크롤/뒤로가기, 3링크 한 줄 배치(특히 영어 로케일에서
       줄바꿈 없이 보이는지)
  - **릴리즈 빌드 6차(클린) + 실기기 재설치 완료**: `npx expo prebuild --clean` →
    `gradlew clean assembleRelease`(20분 40초, 656개 태스크 재실행) → `adb install -r`.
    이전 세션에 누적된 `expo-intent-launcher`(네이티브 의존성) 포함 전체를 처음부터
    다시 빌드해 검증(사용자 지시대로 clean 빌드로 진행 — JS 전용 변경이라도 네이티브
    누적 변경 가능성을 배제). `android/local.properties`는 prebuild가 다시 비운 채로
    재생성해 `sdk.dir` 수동 기입 필요했음(반복 확인된 일회성 환경 이슈, gitignore라
    커밋 대상 아님). adb `unauthorized`/미연결이 중간에 다시 발생 — 케이블 재연결 후
    해결(기존에도 겪은 흔한 함정).
  - STATUS.md에 이 병합·재검증·재빌드 기록을 커밋 `b6d1a29`로 push 완료.
  - **릴리즈 빌드 7차 + 재설치**(사용자 지시로 재확인): 코드 변경 없이(`4c50a22`에서
    working tree clean) `gradlew assembleRelease`만 재실행(prebuild 불필요 — 6차에서
    이미 clean 빌드했고 그 사이 네이티브/설정 변경 없음, 1분 38초·대부분 UP-TO-DATE) →
    `adb install -r`로 재설치 완료.

**마지막 검증된 커밋: `main` 브랜치, `4c50a22`("docs: record clean release build 6 +
install after three-branch merge") — 4종 검증(tsc/expo-doctor/expo export/jest
107개) 통과. 릴리즈 빌드 7차·실기기 설치 완료. 기능 실사용 검증(위 1~5번 항목)은
전부 대기.**

- **캐릭터 작업 보류**: 잠자는 강아지 캐릭터(숨쉬기 애니메이션, 배경 제거 jimp
  파이프라인)는 `sleep-character` 브랜치에만 존재 — **main은 병합하지 않음**,
  캐릭터 없는 상태가 기준. 사유·재개 조건은 BACKLOG.md "캐릭터 (보류)" 참고.
  브랜치는 삭제하지 않고 보존(재사용 가능한 코드 포함).

## 브랜치 현황

- `main`: 네이티브 알람 + 학습 모델 v2 + 커피냅 3모드 + A그룹 + B그룹(풀스크린 인텐트) +
  Phase 4-3(학습 로직 단순화 + 설문 후기 + 히스토리 상세 보기) + 기상 직후 체크리스트 +
  AI 분석(Phase A~C, 무료 리셋 카운트다운, analysis-v2 프롬프트) + 다국어(한/영) +
  알림 권한 안내 개선 + 서버 데이터 삭제 + 알람 해제 미션 + "파워냅이란?" 정보 화면
  전부 병합 완료. **다국어 이후 신규 기능(권한 안내/서버 데이터 삭제/미션/정보 화면)
  전부 실기기 검증 대기**, 그 이전 기능은 실기기 검증 완료.
- `ai-analysis-app` / `i18n`: `main`에 병합 완료 — 더 이상 별도로 갈 일 없음(정리
  대상, 삭제는 사용자 지시 시).
- `mission-alarm` / `about-powernap`: `main`에 병합 완료 — 더 이상 별도로 갈 일 없음
  (정리 대상, 삭제는 사용자 지시 시).
- `phase-4-2` / `fullscreen-intent` / `phase-4-3` / `wake-checklist`: 전부 main에 병합
  완료 — 더 이상 별도로 갈 일 없음(정리 대상, 삭제는 사용자 지시 시). `phase-4-3`용
  worktree(`power-nap-phase43`)도 같은 이유로 정리 대상.
- `sleep-character`: **main에 병합하지 않음** — 캐릭터 에셋 일관성 문제로 보류
  (BACKLOG.md "캐릭터 (보류)" 참고). 삭제하지 말 것, 코드 재사용 목적으로 보존.
- `payments`: AI 분석 Phase D(결제) 작업 중, `main` 기준 분기, 아직 미병합 —
  RevenueCat 연동 코드/webhook 서버는 완료(Test Store 키로 파이프라인 전체 검증
  가능한 구조), 실결제(Play) 검증은 Play Console DUNS 대기 중.

## 지금 단계

**v1 계획 기능 + AI 분석(v1.1) Phase A~C + 다국어(한/영) + 알림 권한 안내 개선 +
서버 데이터 삭제 + 알람 해제 미션 + "파워냅이란?" 정보 화면 전부 `main`에 병합, 4종
검증 통과.** AI 분석 Phase D(결제)는 `payments` 브랜치에서 코드·서버 착수 완료(위
항목 참고), 실결제 검증은 Play Console 계정(DUNS) 대기 중이라 보류. 남은 건 다섯 개
신규 기능(권한 안내/서버 데이터 삭제/미션/정보 화면 + 이번 Phase D)의 실기기 검증
(재빌드·설치는 다음 지시 대기) + 출시 전 체크리스트(SHOW_TEST_BUTTONS=false 전환 등,
CLAUDE.md 코드 규칙 참고). 그 외 [BACKLOG.md](BACKLOG.md) 항목은 여전히 요청 없이
착수하지 않는다.

## 미해결 항목

- [ ] tsconfig 안정화 여부 (`experiments.typedRoutes` 적용 후 `expo start` 반복 실행으로 include 배열 되돌아가지 않는지 재확인)
- [ ] `phase-4-2`/`fullscreen-intent`/`phase-4-3`/`mission-alarm`/`about-powernap`
      브랜치 + `power-nap-phase43` worktree 정리(삭제) — 전부 main 병합 완료로 더
      이상 필요 없음, 삭제는 사용자 확인 후
- [ ] 출시 전 체크리스트: `src/config.ts`의 `SHOW_TEST_BUTTONS`를 `false`로(CLAUDE.md
      코드 규칙 참고), 권한 거부 전수 검증(`POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`,
      `USE_FULL_SCREEN_INTENT` 각각) — 세 개 전부 실기기 검증 + 코드 확인 완료
      (PROJECT.md §4 표 참고). `SCHEDULE_EXACT_ALARM`은 재현 여부와 무관하게 예약
      실패가 조용히 삼켜지는 구조적 결함이 있어 `app/index.tsx`에 try/catch + 안내
      다이얼로그(+ Android 설정 딥링크)를 추가해 이번 세션에 수정(코드 변경 완료,
      **수정 후 재빌드·실기기 재확인은 아직 안 함 — 다음 지시 대기**),
      `USE_FULL_SCREEN_INTENT`는 거부돼도 크래시 없이 헤드업 알림으로 자동 대체됨을
      코드로 재확인(수정 불필요). 그 외 출시 준비 항목은 사용자 지시로 구체화 예정
- [ ] **알림 권한 거부 상태에서 `useNapWatchdog`의 `/alarm` 직행 실기기 실증** —
      "권한 무관하게 항상 동작"은 지금까지 코드 검토(마운트 시 `alarmAt` 경과 판정에
      권한 참조 없음 확인)만 거쳤고 실기기 확인은 아직 없다. 알림 권한 거부 상태에서
      알람이 울리는 중 앱 아이콘으로 앱을 열면 `/alarm`으로 직행하는지 콜드 스타트
      (앱 완전 종료 상태)/백그라운드 복귀(홈 화면 등 다른 화면에 있다가 복귀) 각각
      확인 필요.
- [ ] `PRIVACY_POLICY.md` 법률 검토 + 시행일 확정(문서 상단 placeholder 참고), 영어판
      작성(Phase E) — AI_ANALYSIS.md §7 참고
- [ ] "서버 데이터 삭제" 실기기 확인(2단계 확인 다이얼로그, 크레딧 경고 문구, 삭제
      후 로컬 동의/캐시 초기화) — 사용자 진행
- [ ] "알람 해제 미션" 실기기 확인(미션 ON → 명언 화면 → 슬라이드/롱프레스 → 체크리스트/
      설문 전체 흐름, 오타 재시도, 3회 실패 후 문구 교체, Android/iOS 소리 연속성) —
      사용자 진행
- [ ] "파워냅이란?" 화면 실기기 확인(진입/스크롤/뒤로가기, 3링크 한 줄 배치가 영어
      로케일에서도 줄바꿈 없이 보이는지) — 사용자 진행
- [ ] AI 분석 Phase D(결제) Test Store 실기기 검증 — 사용자 진행 예정(아래 시나리오
      목록 참고). 실결제(Play) 검증은 Play Console 계정(DUNS) 발급 대기 중 — 발급 후:
      Play Console 앱 등록 + 소모성 상품(`powernap_extra_analysis_1000`, 1,000원)
      등록, RevenueCat Play Store 앱에 Google Play 서비스 계정 연동,
      `src/config.ts`의 `REVENUECAT_STORE`를 `'play'`로 전환, 라이선스 테스터 실구매
      검증

- **설정 화면 스크롤 버그 수정 + 섹션 재배치 + 첫 컴포넌트 렌더 테스트**(`main`, 사용자
  명시 지시):
  - **버그 원인**: `app/settings.tsx`가 콘텐츠를 ScrollView 없이 플레인 `<View>`로
    감싸고 있었음(다른 화면은 전부 ScrollView/FlatList 사용) — 작은 화면에서 하단 항목
    (알람 해제 미션 등)에 물리적으로 도달 불가. `<ScrollView>`로 교체해 수정.
  - **다른 화면 전수 점검 결과(버그 없음 확인)**: `about.tsx`/`analysis.tsx`/`feedback.tsx`/
    `index.tsx`는 이미 ScrollView, `history.tsx`/`analysis-history.tsx`는 FlatList 사용 —
    둘 다 RN 기본 baseStyle(`flexGrow:1, flexShrink:1`)로 스스로 크기를 맞춰 정상 동작.
    설정 화면만 플레인 View라 예외적으로 버그였음.
  - 섹션 순서를 사용 빈도·중요도 기준으로 재배치: ① 알람 해제 미션(토글, 맨 위) →
    ② 수면 대기시간/카페인 발현시간(신규 헤더 "낮잠 타이밍 조정" 추가, `napTimingSectionLabel`
    키) → ③ 언어 → ④ 데이터 및 분석(동의/서버 데이터 삭제 — 파괴적 동작이라 맨 아래).
    스타일은 `scrollContent`의 `gap: 24`로 섹션 간 간격 통일(기존 섹션별 `marginTop: 24`
    중복 제거).
  - **첫 컴포넌트 렌더 테스트 도입**(사용자 확인 후 진행, CLAUDE.md 코드 규칙에 한 줄 기록):
    `@testing-library/react-native`(devDependency) + React 19용 신규 피어 패키지
    `test-renderer`(구 `react-test-renderer` 대체, npm에 `test-renderer`라는 별도
    패키지로 존재 — 설치 필요했음) 추가. `src/settings.test.tsx`(4개 섹션 렌더 확인,
    `expo-router/testing-library`의 `renderRouter` 사용).
    - **`app/`가 아니라 `src/`에 둔 이유**: expo-router의 `require.context`가 `app/`
      아래 파일을 파일명에 `.test.`가 있어도 그대로 프로덕션 번들에 포함시킨다 —
      `expo-router/testing-library`가 끌어오는 Node 전용 `path` 모듈을 Metro가 iOS
      번들에 넣을 수 없어 `expo export`가 깨짐(직접 재현 확인). `app/history.test.ts`는
      이 문제가 없는 이유: 그 파일의 import 체인엔 Node 전용 모듈이 없었을 뿐 — 즉
      `app/` 밑에 테스트를 두는 것 자체가 잠재 위험이라 `src/`로 옮겨 해결.
    - **발견(이번 테스트가 처음 노출한 기존 인프라 갭)**: `src/i18n.ts`의
      `getLanguagePreference`/`setLanguagePreference`가 쓰는 `await import(...)`
      동적 import가 jest-expo의 metro caller 설정상 커밋 시점에 CommonJS로 안 바뀌고
      네이티브 `import()`로 남아 "`--experimental-vm-modules` 없이 호출됨" 에러를
      낸다 — 이 두 함수가 실제로 호출되는 컴포넌트 렌더 테스트가 이번이 처음이라 지금까지
      드러난 적 없었음. 범위 밖이라 이번 테스트는 두 함수만 `jest.mock`으로 우회, 근본
      수정(dynamic import 트랜스폼)은 하지 않음 — 필요해지면 별도 지시로.
  - jest 108개 통과(기존 107 + 렌더 테스트 1개)/tsc/expo-doctor/expo export 4종 통과.
    커밋 2개(`fix: settings screen scroll + reorder sections by priority` /
    `test: add component render test for settings screen`), push 완료.
  - **실기기 검증 대기**: 작은 화면(<700pt 기준 요청)에서 실제 스크롤 동작, 재배치된
    섹션 순서 체감, "낮잠 타이밍 조정" 헤더 표시 — 사용자 진행.
  - **설정 화면 스크롤 짤림 후속 수정**(같은 세션, 실기기 확인 후 발견): 하단
    "서버 데이터 삭제" 버튼이 끝까지 스크롤해도 짤리는 문제 — `container`의
    `paddingBottom: 32`가 ScrollView 자체 뷰포트를 불필요하게 줄이고 있었음(제거),
    `scrollContent.paddingBottom`을 8→40으로 확대. 재빌드·재설치 완료.

- **알람 해제 미션 순서 변경(슬라이드 → 명언) + 설정 명언 목록 편집**(`main`, 사용자
  명시 지시) — BACKLOG.md "구현됨 (알람 해제 미션)"/PROJECT.md §6.3·§6.3.5 갱신:
  - **순서 반전**: 도입 당시 "명언 먼저 → 슬라이드"였던 걸 "슬라이드/롱프레스 먼저 →
    명언 나중"으로 변경. 단, **알람음/진동은 슬라이드 이후에도 명언 화면까지 계속
    울린다**(사용자 명시 확인 — 슬라이드만으로 알람이 꺼지면 다시 잠들 위험이 있다는
    판단, 처음엔 "슬라이드가 곧 정지"로 가정했으나 질문해서 정정). 실제 사운드 정지·
    알림 취소·기록 저장(`NapRecord`/`PendingFeedback`)은 명언 통과 시점에 한 번에
    처리 — `src/finishNap.ts` 신규(공통 로직, `app/alarm.tsx`의 미션 꺼짐 경로와
    `app/mission.tsx`의 명언 통과 경로가 공유).
  - `ActiveNap.missionCompleted` 폐지 → `ActiveNap.alarmDismissed`로 교체(store.ts).
    새 순서에서 명언은 항상 마지막 게이트라 "통과 여부" 추적이 불필요해짐(통과 =
    ActiveNap 즉시 삭제). `useNapWatchdog.resolveNapRoute`는 이제 알람 미해제 →
    `/alarm`, 해제됨+미션 on → `/mission` 순으로 판정(isTest 무관 동일 라우팅,
    지난 세션에 이미 확정된 사항).
  - 알람 화면 슬라이드/롱프레스 안내 문구가 미션 on/off에 따라 갈림 — 미션 off는
    기존 "밀어서 끄기" 그대로, 미션 on은 "밀어서 다음으로"(신규 `*Mission` 키 4개,
    `alarm.tsx`가 `getSettings()`로 로드한 `missionEnabled`로 분기).
  - **명언 목록을 설정 화면에서 직접 편집·추가 가능**(사용자 지시) — 미션 토글 ON일
    때만 노출, 줄바꿈으로 구분된 멀티라인 텍스트박스 1개 + "저장" 버튼(사용자가 이
    구현 방식을 직접 선택 — 줄별 추가/삭제 UI 대신 가장 단순한 형태).
    `src/missionQuotes.ts`에 `getMissionQuotes(locale)`/`setMissionQuotes(locale,
    quotes)` 신규(AsyncStorage에 언어별 커스텀 목록 저장, 없으면 `MISSION_QUOTES`
    기본값 폴백, 빈 배열 저장 시도는 폴백 유지). `pickRandomQuote`/`pickShorterQuote`
    시그니처를 `locale` 대신 로드된 배열을 받도록 변경(순수 함수 유지).
  - **발견(이번 세션 중 재확인된 기존 인프라 갭)**: `missionQuotes.ts`에 처음엔
    i18n.ts와 같은 지연 `await import(...)` 패턴으로 AsyncStorage를 불러왔는데,
    이 패턴 자체가 jest-expo의 metro caller 설정상 실제로 호출되면
    "`--experimental-vm-modules` 없이 호출됨" 에러가 남(지난 세션 settings 렌더
    테스트에서 처음 발견한 것과 동일 버그, 이번엔 새 테스트가 다시 밟음) — 이 파일은
    지연 로딩이 보호할 "AsyncStorage 없이 도는 순수 함수 테스트"가 이미 없다는 걸
    확인(유일한 테스트 파일이 새 저장 함수 테스트 때문에 AsyncStorage를 이미
    mock하고 있음)하고 **정적 top-level import로 전환** — 버그를 원천 회피하면서
    코드도 더 단순해짐.
  - jest 111개 통과(기존 108 + missionQuotes 신규 4개 + useNapWatchdog 갱신 +
    store.test.ts 갱신), tsc/expo-doctor/expo export 3종 통과. 커밋
    `452cdfa`("feat: reorder mission after alarm dismiss, allow custom quote
    lists") push 완료. **릴리즈 재빌드 + 재설치 완료**(JS/에셋만 변경, prebuild 불필요).
  - REVIEW_NEEDED.md 1순위에 신규 문구(알람 슬라이드 미션 변형 4개, 설정 명언 편집
    3개) 미검수로 등록.
  - **실기기 검증 대기**: 미션 ON 상태에서 슬라이드/롱프레스 후 알람음이 끊기지
    않고 명언 화면까지 이어지는지, "밀어서 다음으로" 문구 표시, 명언 통과 시 실제
    알람 정지+기록 저장+후속 화면(체크리스트/후기 또는 테스트 낮잠이면 홈) 전환,
    설정 화면 명언 목록 편집(멀티라인 입력·저장·재로드), 언어 전환 시 다른 언어
    목록으로 갱신되는지 — 전부 사용자 진행.

- **명언에 author 필드 추가 + 설정 명언 편집 UI를 행 단위로 교체**(`main`, 사용자
  실사용 피드백 반영) — BACKLOG.md "구현됨 (알람 해제 미션)"/PROJECT.md §6.3.5 갱신:
  - 직전 커밋에서 만든 "줄바꿈 텍스트박스 하나" 방식이 실사용해보니 별로라는 피드백 —
    나중에 "소크라테스: 너 자신을 알라"처럼 실존 인물 명언에 출처를 붙일 계획이라
    author 필드를 넣기로 하면서 통짜 텍스트로는 관리가 더 불편해짐. `MISSION_QUOTES`를
    `string[]` → `{ text, author }[]`(`MissionQuote` 타입)로 변경, 기존 자체 작성
    명언은 전부 author를 `'클로드'`(ko)/`'Claude'`(en)로 저장(사용자 지시). 정답
    판정(`isMissionInputCorrect`)은 `text`만 비교, author는 미션 화면에 `— {{author}}`
    캡션으로만 표시(있을 때만).
  - 설정 화면 명언 편집을 행(row) 단위 UI로 교체 — 명언마다 텍스트 입력 2개(본문/말한
    사람) + "삭제" 버튼, 목록 끝에 "+ 명언 추가" 버튼. 각 입력은 blur 시 전체 배열을
    저장(저장 버튼 없음 — add/delete/blur마다 즉시 반영). 빈 텍스트 행은 저장 시
    걸러내되 화면엔 남겨 계속 채울 수 있게 둠.
  - `getMissionQuotes`/`setMissionQuotes`가 이제 `MissionQuote[]`를 읽고 쓴다.
    **실기기에 이미 저장돼 있을 수 있는 이전 포맷(순수 문자열) 데이터를 위한 방어적
    정규화** 추가 — 도그푸딩 중 실제로 문자열 포맷으로 한 번 저장했을 가능성이 있어
    author: ''로 변환해 크래시 없이 읽음.
  - jest 114개 통과(기존 111 + author/legacy-format 케이스 신규), tsc/expo-doctor/
    expo export 3종 통과. 커밋 `c2d09cf`("feat: per-quote author field +
    row-based quote editor in settings") push 완료. **릴리즈 재빌드 + 재설치 완료**.
  - REVIEW_NEEDED.md 1순위 갱신(missionQuotesHint/Save 제거 → TextPlaceholder/
    AuthorPlaceholder/Delete/Add + mission.quoteAuthor로 교체).
  - **실기기 검증 대기**: 행 단위 추가/수정/삭제가 제대로 저장되는지, 미션 화면에
    author 캡션이 표시되는지, 빈 행 처리, 실기기에 남아있던 이전 포맷 데이터가
    깨지지 않고 정상 로드되는지 — 사용자 진행.

- **명언 편집 UI를 설정 화면에서 별도 화면으로 분리**(`main`, 사용자 피드백 — "설정
  화면이 너무 길다"):
  - `app/mission-quotes.tsx` 신규(신규 라우트 `/mission-quotes`) — 직전 커밋에서
    설정 화면에 인라인으로 넣었던 행 단위 명언 편집 UI를 그대로 옮김. 설정 화면은
    이제 미션 토글 ON일 때 "명언 수정" 링크 한 줄만 보여주고 탭하면
    `router.push('/mission-quotes')`로 이동 — `getMissionQuotes`/`setMissionQuotes`
    등 명언 관련 로직을 settings.tsx에서 전부 제거.
  - locale 키 재배치: `settings.missionQuotesLabel`/`TextPlaceholder`/
    `AuthorPlaceholder`/`Delete`/`Add` → 신규 `missionQuotes` 네임스페이스로 이동
    (`title`/`textPlaceholder`/`authorPlaceholder`/`delete`/`add`), `settings`엔
    `missionQuotesLink`("명언 수정")만 남김.
  - 신규 라우트 추가라 CLAUDE.md 지뢰 목록대로 `expo export`가 이미 타입드 라우트를
    재생성해둔 상태 확인 후 tsc 진행(별도 `expo start` 불필요했음 — 직전 export
    실행이 이미 `.expo/types/router.d.ts`에 `/mission-quotes` 반영).
  - jest 114개(변경 없음, settings.test.tsx는 미션 꺼짐 기본값이라 이 변경에
    영향받지 않음)/tsc/expo-doctor/expo export 4종 통과. 커밋
    `22493f3`("refactor: move quote editor out of settings into its own
    screen") push 완료. **릴리즈 재빌드 + 재설치 완료**.
  - **실기기 검증 대기**: 설정 화면 길이가 실제로 짧아졌는지, "명언 수정" 링크 탭 →
    새 화면 진입 → 뒤로가기로 설정 복귀, 새 화면에서의 행 단위 편집이 이전과 동일하게
    동작하는지 — 사용자 진행.

- **AI 분석 Phase D 착수 — 결제, RevenueCat Test Store로 전체 파이프라인 검증**
  (`payments` 브랜치, `main` 기준 분기, 사용자 명시 지시) — AI_ANALYSIS.md §7 Phase D
  갱신. 전략: Play Console 계정(DUNS) 발급 전까지 RevenueCat Test Store 키로 전체
  구매 파이프라인을 검증하고, 실스토어 전환은 상수 하나만 바꾸면 되는 구조로 설계.
  커밋 4개로 분리(패키지명 / SDK+구매 플로우 / webhook / 문서):
  - **패키지명** `com.anonymous.powernap` → `com.lifebook.powernap`(app.json, 사용자
    확정 — Play Console 최초 등록 전 마지막 기회). 레포 전수 검색 결과 다른 곳은
    전부 동적 참조(딥링크의 `Constants.expoConfig`, config plugin의 `AndroidConfig`
    헬퍼)라 하드코딩된 곳 없음, `ios.bundleIdentifier`도 미설정이라 맞출 대상 없음.
  - **RevenueCat SDK + 구매 플로우**: `react-native-purchases` 설치. `src/config.ts`에
    `REVENUECAT_STORE`(`'test'|'play'`, 기본 `'test'`) 신규 — `SHOW_TEST_BUTTONS`와
    같은 패턴(명시적 상수, `__DEV__` 게이트 아님). `src/purchases.ts` 신규 —
    `resolveApiKey()`가 이 상수로 `EXPO_PUBLIC_REVENUECAT_KEY_TEST`/`_PLAY` 중 하나를
    골라 `Purchases.configure`(익명 Supabase uid를 `appUserID`로, 세션 수립 후
    초기화 순서 보장). `'test'` 키로 뜨면 콘솔 경고(하드 assert 아님 — 검증 릴리즈
    빌드도 의도적으로 test 키를 쓰기 때문).
    - `app/analysis.tsx` 402 화면: "준비 중" placeholder를 실제 구매 버튼으로 교체.
      구매 성공 시 "이용권이 곧 적립돼요" 안내 + 크레딧 잔액을 2초 간격 최대 30초
      폴링(webhook 반영 지연 대응), 적립 확인되면 분석 자동 재시도, 30초 내 미확인
      시 "적립이 지연되고 있어요. 잠시 후 다시 확인해주세요". 취소는 원상복구,
      실패는 Alert, `purchasing`/`purchasePending` 상태로 이중탭·중복폴링 가드.
      기존 `useEffect` 내부 분석 요청 로직을 `runFreshAnalysis()`로 분리해 최초
      진입과 구매 후 재시도가 공유(언마운트 가드도 `mountedRef`로 통일).
    - `app/settings.tsx` "데이터 및 분석" 섹션에 "구매 복원" 버튼 추가.
    - `react-native-purchases`가 하위 의존성
      `@revenuecat/purchases-js-hybrid-mappings`(ESM 전용)를 끌어와 jest-expo 기본
      `transformIgnorePatterns`로 파싱이 깨지는 문제 발견 — 화면 렌더 테스트
      (`src/settings.test.tsx`)가 `@/purchases`를 거쳐 처음 노출됨.
      `__mocks__/react-native-purchases.js` 신규(node_modules 모킹 관례상 루트
      `__mocks__/`에 두면 `jest.mock()` 호출 없이 자동 적용) — 실제 네이티브 SDK는
      렌더/로직 테스트에서 태울 필요 없음.
    - `.env`에 실제 `EXPO_PUBLIC_REVENUECAT_KEY_TEST`/`_PLAY` 값 등록(RevenueCat
      대시보드에서 발급, 사용자가 전달). `.env.example`은 두 키 모두 빈 값으로.
  - **revenuecat-webhook**: RevenueCat 대시보드가 보내는 고정 Authorization 헤더
    값으로 인증(HMAC 아님, `.env`의 `REVENUECAT_WEBHOOK_SECRET`과 Supabase Edge
    Function secret 양쪽에 동일 값 등록·배포 완료). `INITIAL_PURCHASE`/
    `NON_RENEWING_PURCHASE` + 상품 ID 일치 → `credit_events` purchase +1,
    `REFUND`/`CANCELLATION` → refund -1. `${event.transaction_id}:${reason}`을
    `external_id`로 써서 재전송 중복을 unique 제약으로 막는다(23505 → 200 ack) —
    reason별 네임스페이스가 필요한 이유: 같은 거래의 구매/환불이 같은
    transaction_id를 공유해서, 안 나누면 환불 insert가 구매의 unique 제약과 충돌해
    "중복"으로 잘못 무시된다(회귀 테스트로 실제 확인). 이미 소진한 크레딧의 환불로
    잔액이 음수가 되려는 케이스는 `credits.balance` check(>=0) 제약이 insert를 자동
    롤백시키는 걸 그대로 활용해 거부(23514 → 200 ack +
    `refund_rejected_insufficient_balance`, 콘솔 로그만 남기고 자동 처리 안 함 —
    사용자 확정: 정책 판단 필요 사항). `app_user_id`가 우리 유저 테이블에 없으면
    (23503 FK 위반) 202로 ack + 로그만(RevenueCat의 무한 재시도 방지).
    - `supabase/tests/revenuecat-webhook.test.ts`: 배포된 함수를 합성 RevenueCat
      페이로드로 호출하는 통합 테스트 9개(미인증/오인증 401, 구매 적립, 재전송 중복
      무시, 상품 ID 불일치 무시, 환불 차감, 같은 transaction_id의 구매+환불 둘 다
      정상 반영(dedup 네임스페이스 회귀 테스트), 잔액 부족 환불 거부, 존재하지 않는
      유저 202, 무관 이벤트 무시) — **실제 배포 후 9개 전부 통과 확인**(최초
      event.id 기반 dedup으로 배포했다가 transaction_id+reason 방식으로 수정 후
      재배포·재검증).
  - jest(app) 114개 그대로(기존 테스트 개수 유지, 모킹으로 회귀 없이 통과) +
    jest(supabase) 24개(기존 15 + revenuecat-webhook 9개 신규) 전부 통과.
    tsc/expo-doctor/expo export 3종도 통과. 커밋 4개로 분리(패키지명 `68fb9ff` /
    SDK+구매 플로우 `09b4f7b` / webhook `05f1daf` / 이 문서).
  - **릴리즈 빌드 + aapt 패키지명 확인 완료**: 이번 회차엔 새 네이티브 의존성이 없어
    (react-native-purchases는 직전 회차에 이미 설치·링크됨) `prebuild --clean` 없이
    `gradlew assembleRelease`만 재실행(2분 12초, 대부분 UP-TO-DATE). `aapt dump
    badging`로 최종 APK의 `package: name='com.lifebook.powernap'` 확인.
  - **실기기 설치 대기** — adb에 연결된 기기가 없어 이번 세션에서는 설치까지 못함.
    기기 연결 후 기존 `com.anonymous.powernap` 설치본은 별개 앱이라 수동 삭제 권장,
    이어서 새 APK(`android/app/build/outputs/apk/release/app-release.apk`) 설치.
  - **Test Store 실기기 확인 시나리오**(기기 연결 후 사용자 진행):
    1. 히스토리 → AI 분석 → 기록 5개 미만이면 진입 자체가 막히는지(기존 동작 그대로)
    2. 무료 분석 소진 상태 진입 → 402 화면에 실제 "추가 분석 구매" 버튼이 보이는지
       (이전엔 "준비 중" 텍스트만 있었음)
    3. 구매 버튼 탭 → RevenueCat Test Store 결제 시트가 뜨는지 → 결제 완료 →
       "이용권이 곧 적립돼요" 메시지 → 잠시 후 분석이 자동으로 다시 시작되는지(최대
       30초 폴링)
    4. 결제 시트에서 취소 → 402 화면이 원래 상태로 돌아오는지(에러 얼럿 없이)
    5. 설정 → 데이터 및 분석 → "구매 복원" 탭 → 성공/실패 안내가 뜨는지
    6. 같은 상품을 두 번 연속 빠르게 탭해도(중복 탭) 결제 시트가 한 번만 뜨는지
    7. 기기를 비행기 모드로 두고 구매 시도 → 에러 얼럿이 뜨는지(크래시 없이)
    8. (선택) RevenueCat 대시보드에서 방금 결제를 환불 처리 → 크레딧이 -1 되는지는
       webhook 통합 테스트로 이미 서버 쪽 검증 완료 — 앱에서 별도 확인할 것은 없음
    9. 앱 재설치 시 기존 `com.anonymous.powernap`과 완전히 분리된 새 앱으로 뜨는지
       (낮잠 기록 등 로컬 데이터 없이 시작하는 게 정상)

- **브랜치 통합(`wake-sequence`+`payments`→`main`) + 마이페이지 신설 + 테스트 낮잠
  완전 동일화 + RevenueCat 결제 파이프라인 실증**(`main`에 직접, 사용자 명시 지시로
  세션 진행) — 상세 내러티브는 `docs/daily/2026-07-15.md`, PAR 소재는
  `docs/par-materials.md`, 기술 결정은 `docs/decisions/revenuecat-offerings-vs-getproducts.md`
  / `docs/decisions/test-nap-full-parity-guarded.md`, 트러블슈팅은
  `docs/troubleshooting/expo-public-dynamic-env-access.md` /
  `docs/troubleshooting/revenuecat-test-store-debug-build-required.md` /
  `docs/troubleshooting/expo-router-scans-app-dir-for-tests.md`(후속 갱신) 참고:
  - `wake-sequence`(main 기준) → `main` fast-forward, `payments` → `main` merge
    (충돌은 `settings.tsx` 한 곳, 기상루틴 섹션과 결제 섹션 둘 다 살려서 해소).
  - 기상 체크리스트를 설문 화면 체크박스 4개에서 알람/미션 해제 직후 순차 진입하는
    화면 3개(`/wake-stretch`→`/wake-light`→`/wake-water`)로 재구성.
    `WakeChecklist` 4필드→3필드(`immediate` 제거, 구 레코드는 무시하며 읽음).
    설정에 "기상 루틴" 토글 신설(기본 ON, 명언 미션과 독립).
  - 마이페이지(`/mypage`) 신설 — 토큰 잔량+구매 버튼(동의 후에만), 낮잠 타이밍
    조정(설정에서 이동), 낮잠기록/AI분석기록/결제내역/명언수정 4개 링크.
    `/purchase-history` 신설(빈 상태+구매 복원). 설정 화면은 언어/미션/기상루틴/
    데이터·분석/데이터삭제/약관및정책 6섹션의 동작 전용 화면으로 축소.
  - 테스트 낮잠(홈 화면 10초/1분 버튼)이 미션·기상 루틴·설문 화면까지 실제 알람과
    완전히 동일하게 진입하도록 확장 — 단 설문의 "직접 조정하기"만
    `applyManualAdjustment` 호출을 건너뛰고 "실제로 반영되지 않았다" 토스트로
    대체(과거 테스트 낮잠의 학습값 오염 사고 재발 방지, 결정 기록 참고).
  - 히스토리에 개별 기록 삭제(빨간 버튼+Alert 확인 1회), 홈 화면 상단 레이아웃
    조정(시각 중앙 정렬, 파워냅이란? 좌측 강조, 마이페이지/설정 우측).
  - **RevenueCat 결제 파이프라인 3단계 원인 규명**(전날 "해결됨" 보고가 잘못된
    검증이었음을 자인·재검증):
    1. `src/purchases.ts`의 `process.env[동적변수]` 접근이 babel EXPO_PUBLIC_ 인라인
       플러그인과 안 맞아 키가 항상 undefined였던 것 — 정적 접근으로 수정, APK 번들
       grep으로 값 자체 재확인.
    2. RevenueCat Test Store 키가 릴리즈 빌드에서 SDK 자체 보안 장치로 거부·크래시
       (공식 문서 확인, 우회 불가) — 디버그 빌드(`expo run:android`)로 전환,
       `__DEV__` 런타임 가드 추가.
    3. Offerings 미설정으로 구매 실패 — 상품 1종뿐이라 Offerings/Package 자체를
       제거하고 `getProducts`+`purchaseStoreProduct`로 직접 조회·구매하도록 전환
       (대시보드 설정이 "Product Catalog 상품 1개 등록"으로 단순화).
    - 디버그 빌드+Metro 콘솔 로그(디바이스 logcat보다 안정적)로 실제 구매 성공,
      `CustomerInfo.nonSubscriptionTransactions`에 RevenueCat 서버 발급
      `revenueCatId` 포함까지 확인. **RevenueCat 대시보드에 실제로 표시되는지는
      사용자 확인 대기**(Customers 검색으로 uid
      `f909aa02-9bb3-4886-9b8e-124d3e790cf0` 조회 요청해둔 상태).
  - `app/history.test.ts`가 앱 부팅마다 "Property 'jest' doesn't exist"로
    크래시내던 버그 발견(실기기 디버그 빌드 실재현) — `src/history.test.ts`로 이동해
    해결. **`expo export`가 이 지뢰를 항상 잡아주는 게 아니라는 것도 실증**(옛 파일
    복원 후 ios/android 둘 다 export 통과를 직접 재현) — 트러블슈팅 문서 갱신.
  - jest 124(병합 직후)→125개, tsc/expo-doctor/expo export(ios+android) 4종
    매 변경마다 통과. 커밋 12개로 분리해 push. 릴리즈 빌드 8회 + 디버그 빌드 2회
    재실행·설치.
  - **다음**: RevenueCat 대시보드 Customers 검색 결과 확인, webhook→크레딧 적립
    최종 확인, Play Console DUNS 발급 후 `REVENUECAT_STORE='play'` 전환(+ Product
    Catalog 동일 상품 등록, Offering 불필요), 신규 문구 원어민 검수, 출시 전
    `SHOW_TEST_BUTTONS=false` 확인.

---

**작업 완료 조건**: 앞으로 매 작업을 완료할 때마다 이 파일(STATUS.md)을 갱신한다.
