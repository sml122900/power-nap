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

**마지막 검증된 커밋: `ai-analysis-app` 브랜치, 실기기 통합 검증까지 완료 —
`main` 병합 대기.**

## 브랜치 현황

- `main`: 네이티브 알람 + 학습 모델 v2 + 커피냅 3모드 + A그룹 + B그룹(풀스크린 인텐트) +
  Phase 4-3(학습 로직 단순화 + 설문 후기 + 히스토리 상세 보기) + 기상 직후 체크리스트
  전부 병합 완료. A그룹/B그룹은 실기기 검증까지 끝남, **Phase 4-3·기상 체크리스트는
  실기기 검증 대기**.
- `phase-4-2` / `fullscreen-intent` / `phase-4-3` / `wake-checklist`: 전부 main에 병합
  완료 — 더 이상 별도로 갈 일 없음(정리 대상, 삭제는 사용자 지시 시). `phase-4-3`용
  worktree(`power-nap-phase43`)도 같은 이유로 정리 대상.
- `ai-analysis-app`: Phase C(AI 분석 앱 통합) 완료 + `main`(wake-checklist 포함) 병합
  완료 — 다음은 릴리즈 빌드 → 실기기 설치·검증.

## 지금 단계

**기능 개발 동결(v1) 유지, AI 분석(v1.1)만 사용자 명시 지시로 예외 진행 중.**
`main`에 계획했던 v1 기능(네이티브 알람, 학습 모델 v2, 커피냅 3모드, A/B그룹, Phase 4-3
학습 개편, 기상 직후 체크리스트)은 전부 병합 완료 — 남은 건 이들의 실기기 검증과 출시 전
체크리스트(SHOW_TEST_BUTTONS=false 전환 등, CLAUDE.md 코드 규칙 참고). 그와 별개로 AI 분석
(Phase A~E, AI_ANALYSIS.md)은 사용자가 명시적으로 착수 지시해 Phase C(앱 통합)까지
완료됨(`ai-analysis-app` 브랜치, `main` 병합 완료) — 다음은 릴리즈 빌드 → 실기기 설치·
검증, Phase D(결제)는 별도 지시 대기. 그 외 [BACKLOG.md](BACKLOG.md) 항목은 여전히 요청
없이 착수하지 않는다.

## 미해결 항목

- [ ] tsconfig 안정화 여부 (`experiments.typedRoutes` 적용 후 `expo start` 반복 실행으로 include 배열 되돌아가지 않는지 재확인)
- [ ] `phase-4-2`/`fullscreen-intent`/`phase-4-3` 브랜치 + `power-nap-phase43` worktree
      정리(삭제) — 전부 main 병합 완료로 더 이상 필요 없음, 삭제는 사용자 확인 후
- [ ] 출시 전 체크리스트: `src/config.ts`의 `SHOW_TEST_BUTTONS`를 `false`로(CLAUDE.md
      코드 규칙 참고), 그 외 출시 준비 항목은 사용자 지시로 구체화 예정

---

**작업 완료 조건**: 앞으로 매 작업을 완료할 때마다 이 파일(STATUS.md)을 갱신한다.
