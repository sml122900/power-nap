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
  report(jsonb), followup_turns_used(0~3), model, tokens_in/out(비용 추적) }
- 주 1회 무료 판정: 이번 주(월요일 기준) reason='weekly_free' 이벤트 존재 여부

## 5. AI 파이프라인

- 프롬프트는 /supabase/functions/analyze/prompts/analysis-v1.ts 로 버전 관리
  (Handee/Lifebook에서 쓰는 패턴 그대로)
- 프롬프트에 포함: BACKLOG.md의 문헌 근거(파워냅 유효구간 10~30분, 수면 관성,
  카페인 발현 20~30분/흡수 피크/개인차) + NapRecord 스냅샷 + 현재 설정값
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

## 6. 앱 쪽 변경

- 히스토리 화면 상단에 "AI 분석" 진입점 (기록 5개 미만이면 비활성 + 안내)
- 분석 화면: 최초 진입 시 전송 동의 (한 번만, 철회 가능):
  "분석을 위해 낮잠 기록이 서버로 전송됩니다" + 처리방침 링크
- 리포트 화면: 요약/조언/± 제안 + "설정에 반영하기" 버튼(각 항목별) +
  하단 고지문 + 후속 질문 입력(남은 턴 표시)
- 결제 화면: 무료 소진 시 "이번 주 무료 분석을 사용했어요 — 추가 분석 1,000원"
- 설정에 "데이터 및 분석" 섹션: 동의 철회, 서버 기록 삭제 요청

## 7. Phase 분할

- **Phase A — 서버 기반**: Supabase 프로젝트, 스키마, 익명 auth, 크레딧 원장 +
  주간 무료 판정 로직, jest/pgTAP 수준 검증. (결제·AI 없이 크레딧 차감까지 동작)
- **Phase B — AI 파이프라인**: Edge Function analyze, 프롬프트 v1, zod 검증,
  비용 기록. 로컬 테스트 데이터로 리포트 품질 확인 (사용자 실기록으로 튜닝)
- **Phase C — 앱 통합**: 동의 UI, 분석 진입점, 리포트 화면, 후속 질문 3턴
- **Phase D — 결제**: Play Console 인앱상품 등록(1,000원 소모성 1종), RevenueCat
  연동, webhook → 크레딧 적립, 라이선스 테스터로 검증
- **Phase E — 정책 문서**: 개인정보처리방침 개정(전송 항목 명시), Play 데이터
  안전 섹션 갱신, 동의 플로우 최종 점검

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
