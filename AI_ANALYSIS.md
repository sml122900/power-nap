# AI_ANALYSIS.md — AI 수면 분석 스펙 (v1.1 핵심 기능)

> 확정 결정: 주 1회 무료 / 추가 분석 1회 1,000원(인앱결제) / 리포트 + 후속 질문 최대 3턴.
> 이 기능은 "전부 로컬" 원칙을 처음 깨는 항목 — 서버 도입, 결제, 개인정보 전송 동의가 함께 온다.

---

## 1. 제품 정의

사용자의 낮잠 기록(NapRecord: 시각/모드/오프셋 + 설문 4항목 + 메모 + 기상 루틴)이
쌓이면, 의학 문헌 지식이 담긴 프롬프트로 Claude가 분석해:
- 수면 대기시간 / 카페인 발현시간의 ± 조정 제안 (숫자)
- 낮잠 환경·습관에 대한 전반적 조언 (텍스트)
- 리포트 후 사용자가 후속 질문 최대 3턴 가능

**핵심 원칙: AI는 제안만, 적용은 사용자가.** 제안된 ±값을 앱이 자동 반영하지 않는다.
리포트에 "설정에 반영하기" 버튼을 두되, 누르는 건 사용자다 (Phase 4-3에서 확립한
"시간은 사용자만 바꾼다" 철학 유지).

## 2. 비즈니스 규칙

- 무료: 주 1회 (월요일 00:00 KST 리셋, 서버 기준 시각)
- 추가 분석: 1회 1,000원 — Google Play 인앱결제 소모성 상품 1종
- 분석 1회 = 리포트 1개 + 후속 질문 3턴 포함 (턴 추가 구매 없음 — 단순하게)
- 분석 가능 조건: NapRecord 최소 5개 이상 (데이터가 없으면 분석 버튼 비활성 +
  "낮잠 기록이 5회 쌓이면 분석할 수 있어요" 안내)
- 분석 대상 기간: 요청 화면에서 프리셋 선택 — 최근 1주 / 최근 2주(기본) / 최근 1개월 /
  전체. 선택한 기간 안의 유효 기록(isTest 제외) 개수를 실시간 표시("이 기간 기록 n개"),
  5개 미만이면 그 기간으로는 분석 버튼 비활성
- 서버 상한: Edge Function이 수신 기록을 요청 시각 기준 최신순 50개로 컷(초과분은 에러
  없이 무시) — 토큰 비용 방어선. 응답에 실제 분석에 쓰인 기록 수(recordsUsed) 포함
- 계정: Supabase 익명 인증 (이메일/비번 없음 — 마찰 최소화. 기기 변경 시 기록
  이전 불가함을 안내. 계정 시스템은 필요해지면 후일 승격)

## 3. 아키텍처

```
[앱] ── 익명 auth + NapRecord 전송 ──> [Supabase]
                                        ├─ Postgres: 유저/크레딧 원장/분석 이력
                                        ├─ Edge Function: analyze (Claude API 호출)
                                        └─ 환경변수: ANTHROPIC_API_KEY (서버 전용)
[앱] ── 구매 ──> [Google Play Billing] ──> [RevenueCat] ── webhook ──> [Supabase 크레딧 적립]
```

- API 키는 앱에 절대 미포함 (CLAUDE.md 지뢰 목록에 이미 기록된 원칙)
- 크레딧 잔량·차감·주간 무료 판정의 진실의 원천은 전부 서버
- 앱은 분석 요청 시에만 NapRecord를 전송 (상시 동기화 아님 — 최소 전송 원칙)

## 4. 데이터 모델 (Supabase Postgres)

- users: { id(=supabase auth uid), created_at }
- credits: { user_id, balance, updated_at } — 소모성 크레딧 원장
- credit_events: { user_id, delta, reason('purchase'|'weekly_free'|'analysis'|'refund'),
  external_id(RevenueCat tx id, 중복 적립 방지 unique), created_at }
- analyses: { id, user_id, requested_at, records_snapshot(jsonb),
  report(jsonb), turns(jsonb), followup_turns_used(0~3), model, tokens_in/out(비용 추적),
  locale(text, 기본 'ko') — 리포트가 실제로 작성된 언어. 요청 시점의 앱 언어를 그대로
  저장(migrations/0004)
- 주 1회 무료 판정: 이번 주(월요일 기준) reason='weekly_free' 이벤트 존재 여부

## 5. AI 파이프라인

- 프롬프트는 /supabase/functions/analyze/prompts/analysis-v1.ts 로 버전 관리
  (Handee/Lifebook에서 쓰는 패턴 그대로)
- 프롬프트에 포함: BACKLOG.md의 문헌 근거(파워냅 유효구간 10~30분, 수면 관성,
  카페인 발현 20~30분/흡수 피크/개인차) + NapRecord 스냅샷(§2 상한 적용된 최신순
  50개 이하) + 현재 설정값
- 출력은 `output_config.format`(구 `output_format` 아님) + `zodOutputFormat`으로 JSON 스키마
  강제와 zod 검증을 서버 사이드에서 한 번에 처리(`client.messages.parse()`), 실패 시 1회
  재시도 후 실패 처리(크레딧 미차감):
  { latencyAdjust: {fast, slow} | null, caffeineOnsetAdjust: number | null,
    summary: string, advice: string[], confidence: 'high'|'low' }
- 의학적 표현 수위: "진단/치료" 금지, "일반적인 수면 위생 정보이며 의학적 조언이
  아님" 고지를 리포트 하단 고정 표기. 수면장애 의심 패턴(만성 불면 언급 등)이
  메모에 보이면 전문가 상담 권유 문구로 대응 — 프롬프트에 명시
- 후속 질문: 리포트 + 이전 턴을 컨텍스트로 재호출, 3턴 도달 시 입력창 비활성
- 모델: claude-sonnet-5(환경변수로 교체 가능) — 작성 시점 최신 Sonnet, structured outputs
  지원 모델. max_tokens 상한 명시로 비용 캡
- 출력 언어: 앱이 보낸 `locale`('ko'|'en')을 `buildSystemPrompt(locale)`이 그대로 받아
  요약/조언 텍스트만 그 언어로 쓴다(analysis-v2.ts, 프롬프트 지시문 자체는 항상 한국어
  고정 — 문헌 근거·규칙은 언어와 무관). 서버는 이 파라미터 외에는 언어를 전혀 모른다
  (에러 응답도 마찬가지로 언어 불변 — CLAUDE.md "다국어(i18n)" 원칙 참고).
- **지난 리포트 재번역은 하지 않는다.** 이미 저장된 `analyses.report`는 요청 당시
  언어로 영구히 고정된다 — 사용자가 나중에 앱 언어를 바꿔도 과거 리포트를 다른
  언어로 다시 생성하지 않는다. 근거: 재번역도 결국 Claude API를 다시 호출하는 것과
  같은 비용 구조(생성 비용과 동일한 토큰 요금)인데, "이미 낸 크레딧으로 받은 리포트를
  나중에 공짜로 재작성"해주는 셈이 되어 크레딧 원장 모델과 충돌한다. 대신 목록/상세
  화면에 리포트가 어느 언어로 작성됐는지만 표시(`app/analysis-history.tsx` 언어 배지,
  `app/analysis.tsx`는 현재 앱 언어와 다를 때만 안내 문구). BACKLOG.md에 "필요 시
  크레딧 차감 옵션으로 재번역 제공" 여지를 남겨둠.

## 6. 앱 쪽 변경

- 히스토리 화면 상단에 "AI 분석" 진입점 (기록 5개 미만이면 비활성 + 안내) +
  "지난 분석 보기" 진입점(별도 목록 화면)
- 분석 화면: 최초 진입 시 전송 동의 (한 번만, 철회 가능):
  "분석을 위해 낮잠 기록이 서버로 전송됩니다" + 처리방침 링크
- 기간 선택 화면(동의 다음 단계): 프리셋 칩(1주/2주 기본/1개월/전체) + 선택 기간의
  유효 기록 수 실시간 표시 + 분석하기 버튼(5개 미만이면 비활성)
- 리포트 화면: 사용된 기록 수 + 요약/조언/± 제안 + "설정에 반영하기" 버튼(각 항목별) +
  하단 고지문 + 후속 질문 입력(남은 턴 표시)
- 지난 분석 목록/상세: analyses 테이블을 RLS(본인 행만)로 직접 조회, 탭하면 리포트
  전체(제안/조언/고지문 + 저장된 후속 질문 대화)를 다시 볼 수 있다. 후속 질문도 남은
  턴이 있으면 계속 가능. "설정에 반영하기"는 지난 리포트에서도 동일하게 동작(재탭
  방지 등 별도 가드 없음 — 수동 조정과 동일하게 취급). 수신한 목록/상세는 로컬
  (AsyncStorage)에 캐시해 오프라인에서도 마지막으로 본 내용은 열람 가능 — 서버가
  진실의 원천이고 캐시는 실패 시 폴백일 뿐
- 결제 화면: 무료 소진 시 "이번 주 무료 분석을 사용했어요 — 추가 분석 1,000원"
- 설정에 "데이터 및 분석" 섹션: 동의 철회, **서버 데이터 삭제(구현 완료 — 아래 참고)**

### 서버 데이터 삭제 (구현 완료, PRIVACY_POLICY.md §5 대응)

- Edge Function `delete-my-data`: 인증된 유저의 `auth.users` 행을 `admin.auth.admin.deleteUser()`로
  삭제한다. `public.users`/`credits`/`credit_events`/`analyses` 네 테이블은 전부
  `on delete cascade`로 `auth.users`를 최종 참조하도록 이미 설계돼 있어(migrations/0001),
  이 한 번의 삭제가 단일 Postgres 트랜잭션으로 전부 정리한다 — 별도 마이그레이션/RPC
  불필요. `credit-ledger.test.ts`/`analyze.test.ts`의 테스트 유저 정리(`deleteTestUser`)가
  이미 같은 전제로 동작 중이던 검증된 메커니즘을 그대로 정식 기능으로 승격한 것.
- 익명 계정 자체도 삭제한다(신원까지 완전 삭제) — 이메일/비번 없는 익명 계정이라 신원만
  남겨봐야 재사용 가치가 없고, 세션 무효화로 다음 사용 시 새 익명 계정이 자동 발급되는
  것도 §8의 기존 트레이드오프(기기 분실 시 크레딧 소실)와 같은 성격이라 자연스럽다고 판단.
- 앱: 설정 화면에서 크레딧 잔액을 조회해(있으면) "남은 이용권 n회가 함께 삭제되며 복구할
  수 없다" 경고를 포함한 2단계 확인(Alert.alert, 안내 → 최종 확인) 후 요청. 성공 시 로컬의
  AI 동의 상태·분석 목록/상세 캐시만 초기화(`clearAiLocalData`) — 로컬 낮잠 기록(NapRecord)은
  서버 데이터가 아니므로 건드리지 않는다.
- 재시도 안전성: 삭제된 유저의 JWT로 같은 엔드포인트를 다시 불러도 `admin.auth.getUser(jwt)`가
  "user not found"로 거부해 자연스럽게 401이 난다 — 별도 idempotency 처리 불필요.

## 7. Phase 분할

- **Phase A — 서버 기반**: Supabase 프로젝트, 스키마, 익명 auth, 크레딧 원장 +
  주간 무료 판정 로직, jest/pgTAP 수준 검증. (결제·AI 없이 크레딧 차감까지 동작)
- **Phase B — AI 파이프라인**: Edge Function analyze, 프롬프트 v1, zod 검증,
  비용 기록. 로컬 테스트 데이터로 리포트 품질 확인 (사용자 실기록으로 튜닝)
- **Phase C — 앱 통합**: 동의 UI, 분석 진입점, 리포트 화면, 후속 질문 3턴
- **Phase D — 결제**: Play Console 인앱상품 등록(1,000원 소모성 1종), RevenueCat
  연동, webhook → 크레딧 적립, 라이선스 테스터로 검증
  - **전략: RevenueCat Test Store로 전체 파이프라인을 먼저 검증하고, Play Console
    계정(DUNS) 발급 후 상수 하나만 바꿔 실스토어로 전환한다.** 코드·서버·webhook은
    완료, 실결제(Play) 검증만 DUNS 대기로 보류. 지금까지:
    - `react-native-purchases`(RevenueCat SDK) 설치, `src/purchases.ts` 신규 —
      `purchaseExtraAnalysis()`/`restorePurchases()`. 익명 Supabase uid를 그대로
      `appUserID`로 넘겨 RevenueCat 자체 익명 ID와 이중화되지 않게 함(첫 호출 시점까지
      지연 초기화 — 동의 전 화면 로드만으로 네트워크가 나가지 않게, 세션 수립 후
      configure 순서 보장).
    - **키 전략**: `src/config.ts`의 `REVENUECAT_STORE`(`'test'|'play'`, 기본
      `'test'`)가 `EXPO_PUBLIC_REVENUECAT_KEY_TEST`/`_PLAY` 중 하나를 고른다(둘 다
      `.env`에 실제 값 등록됨). `'test'`로 초기화되면 콘솔에 경고를 남겨 이 상태
      그대로 실스토어 빌드가 나가지 않게 함(하드 assert는 아님 — Test Store 검증용
      릴리즈 빌드도 의도적으로 `'test'`를 쓰기 때문). 실스토어 전환은 이 상수를
      `'play'`로 바꾸는 것뿐 — 코드 변경 불필요.
    - `app/analysis.tsx` 402(무료 소진) 화면의 결제 버튼을 실제 구매 플로우로 교체 —
      성공 시 "이용권이 곧 적립돼요" 안내 후 크레딧 잔액을 2초 간격 최대 30초 폴링,
      적립 확인되면 분석을 자동 재시도(webhook 반영 지연 대응), 30초 내 미확인 시
      "적립이 지연되고 있어요. 잠시 후 다시 확인해주세요". 취소는 원상복구, 실패는
      Alert. 이중탭은 `purchasing`/`purchasePending` 상태로 가드.
    - `app/settings.tsx` "데이터 및 분석" 섹션에 "구매 복원" 링크 추가.
    - `supabase/functions/revenuecat-webhook` 신규 — RevenueCat 대시보드의 고정
      Authorization 헤더 값으로 인증(HMAC 아님), `INITIAL_PURCHASE`/`NON_RENEWING_PURCHASE`
      + 상품 ID(`powernap_extra_analysis_1000`) 일치 → `credit_events` purchase +1,
      `REFUND`/`CANCELLATION` → refund -1. `${event.transaction_id}:${reason}`을
      `external_id`로 써서 재전송 중복 적립을 막는다(23505 → 200 ack) — reason별
      네임스페이스를 나눈 이유: 같은 거래의 구매/환불 이벤트가 같은 transaction_id를
      공유해서, 나누지 않으면 환불 insert가 구매의 unique 제약과 충돌해 "중복"으로
      잘못 무시된다(회귀 테스트로 확인). 이미 소진한 크레딧의 환불로 잔액이 음수가
      되는 케이스는 `credits.balance` check 제약이 insert를 롤백시키는 걸 그대로
      활용해 거부하고 로그만 남긴다(23514 → 200 ack,
      `refund_rejected_insufficient_balance` — 자동 처리 대신 운영자 판단 사항으로
      남김, §8 리스크 메모 참고). `app_user_id`가 우리 유저 테이블에 없으면(23503 FK
      위반) 202로 ack하고 로그만 남겨 RevenueCat의 무한 재시도를 유도하지 않는다.
    - `supabase/tests/revenuecat-webhook.test.ts`: 실제 배포된 함수를 합성 RevenueCat
      페이로드로 호출하는 통합 테스트 9개(미인증/오인증 401, 구매 적립, 재전송 중복
      무시, 상품 ID 불일치 무시, 환불 차감, 같은 transaction_id의 구매+환불 둘 다
      정상 반영(dedup 네임스페이스 회귀 테스트), 잔액 부족 환불 거부, 존재하지 않는
      유저 202, 무관 이벤트 무시) — Play Console/RevenueCat 프로젝트 없이도 웹훅
      로직 자체는 실서버로 검증 완료.
    - 패키지명을 `com.anonymous.powernap` → `com.lifebook.powernap`로 변경(app.json,
      Play Console 최초 앱 등록 전 마지막 기회라 사용자 확정) — 소스 전수 검색 결과
      다른 곳은 전부 패키지명을 동적으로 참조해(딥링크의 `Constants.expoConfig`,
      config plugin의 `AndroidConfig` 헬퍼) 하드코딩된 곳이 없었음, `ios.bundleIdentifier`도
      아직 미설정이라 맞출 대상 없음. `prebuild --clean` 후 `aapt`로 최종 APK
      패키지명 확인 완료. 기기의 기존 `com.anonymous.powernap` 설치본과는 별개
      앱이 되므로(로컬 낮잠 기록 미이전) 검증 후 수동 삭제 필요.
    - **남은 것(DUNS 발급 후)**: Play Console 앱 등록 + 소모성 상품
      `powernap_extra_analysis_1000` 등록(가격 1,000원), RevenueCat의 Play Store
      앱에 Google Play 서비스 계정(영수증 검증용) 연동, `src/config.ts`의
      `REVENUECAT_STORE`를 `'play'`로 전환, 라이선스 테스터 계정으로 실구매 →
      실기기 크레딧 반영 확인.
- **Phase E — 정책 문서**: 개인정보처리방침 초안 `PRIVACY_POLICY.md`(레포 루트) +
  서버 데이터 삭제 기능 구현 완료(위 §6 참고, 법률 검토 및 영어판은 아직 — 문서
  상단 주의문 참고). 남은 항목: Play 데이터 안전 섹션 갱신, 동의 플로우 최종 점검,
  개인정보처리방침 법률 검토·시행일 확정

각 Phase 완료 기준: 검증 통과 + 실기기(또는 실서버) 확인 후 다음 Phase.
Phase D는 Play Console 계정(DUNS 대기 중)이 있어야 완결 — A~C를 먼저 진행하고
D는 계정 준비되는 시점과 맞물리게.

## 8. 리스크 메모

- 후속 3턴 상한 = 비용 방어선. 상한 해제 요구가 와도 v1.1에서는 유지
- 익명 auth는 기기 분실 시 크레딧 소실 — 구매 복원(RevenueCat restore)으로
  결제분은 복구 가능하나 무료 이력은 소실. FAQ로 고지
- Claude API 장애 시: 실패 처리 + 크레딧 미차감 + 재시도 안내 (환불 이슈 방지)
- 심사: 결제 포함 업데이트라 v1보다 꼼꼼함 — Phase E를 형식적으로 하지 말 것
- 성공 후 차감 채택 — 무료권 동시 요청 레이스로 드물게 무료 분석 2회가 나갈 수 있음
  (피해=API 비용 1회분, 감수). 남용 패턴 발견 시 요청 단위 잠금 도입.
