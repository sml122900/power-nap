// AI_ANALYSIS.md §5 — 프롬프트 버전 관리 파일. v1 대비 변경: BACKLOG.md "AI 분석 조언
// 근거" 문헌 4건 반영(낮잠 시간대/타이밍 개인차/환경/빈도) + 조언 가이드 확장 + 출력
// 언어 변수화. v1은 파일명으로만 추적하던 관행을 유지 — 여기서도 analyses.model 옆에
// 프롬프트 버전 컬럼을 따로 두지는 않기로 결정(현재 규모에선 git 히스토리로 충분,
// 필요해지면 그때 추가).
import { z } from 'npm:zod@^4.4.3';

export const MODEL = 'claude-sonnet-5';
export const MAX_TOKENS = 2048;
// 리포트 생성 작업은 구조화된 추출/요약이라 xhigh/max까지 필요 없다 — medium이 비용 대비
// 품질 균형점(claude-api 스킬 가이드 기준).
export const EFFORT = 'medium' as const;

// BACKLOG.md "학습 스텝 — 근거" / "카페인 발현시간 근거" / "AI 분석 조언 근거" 섹션의
// 문헌 인용을 그대로 요약. 수치·주장을 바꾸려면 BACKLOG.md 원본 근거부터 갱신하고
// 여기 반영한다(반대 순서 금지). 이 텍스트는 Claude에게 주는 내부 지시라 출력 언어와
// 무관하게 항상 한국어로 둔다(출력 언어 변수화는 buildSystemPrompt의 마지막 줄만 해당).
const LITERATURE_BASIS = `
- 파워냅 유효 구간은 10~30분(폭 20분)뿐이다. Oxford Sleep 2023 비교 연구(10분/30분/60분)에
  따르면 10분과 30분 낮잠 모두 유의미한 각성 개선을 보이지만 지속 효과 시간은 크게 다르다
  (10분→약 1시간 지속, 30분→약 4시간 지속). 이 좁은 창 안에서도 효과가 갈리므로 사소해 보이는
  숫자 차이도 의미가 있다.
- 실수면 30분을 넘기면 수면 관성(sleep inertia) 구간에 들어갈 위험이 커진다 — 깊은 수면 단계에서
  깨어나 오히려 더 몽롱해질 수 있다.
- 카페인의 각성 효과는 섭취 후 20~30분 사이에 발현되기 시작한다(Chronobiology International 2020
  caffeine-nap pilot study 인용 문헌 기준). 커피 음료의 카페인 흡수 피크는 섭취 후 약 30분.
  혈장 카페인 농도 피크는 개인차가 커 섭취 후 15~120분 사이에 나타나지만, 흡수량의 99%는
  약 45분 내에 완료된다(Hayashi 2003 / Arnaud 1998 재인용).
- 낮잠 최적 시간대: 이른 오후 1~3시가 circadian dip(자연스러운 각성 저하 구간)과 맞물려
  입면이 쉽고 밤잠 방해도 적다. 오후 3시 이후의 늦은 낮잠은 야간 수면·저녁 각성에 부정적
  영향을 줄 수 있다(Harvard Health 2024, RISE, PUIRP 2024).
- 타이밍 개인차: 최적 낮잠 시점은 크로노타입(아침형/저녁형)과 최근 빛 노출에 따라 개인마다
  다르다. 저녁형은 아침형보다 수면 위상이 2~3시간 늦다(크로노타입 constant routine 연구,
  Tandfonline/PMC).
- 환경 최적화: 조용하고 어둡고 시원한 환경이 입면을 촉진한다. 밝거나 시끄러운 환경이면
  안대·귀마개 사용이 권장된다(Harvard Health, RISE, Studley).
- 낮잠 빈도: 밤잠을 보호하려면 하루 낮잠 횟수를 1~2회로 제한하는 게 좋다(Studley).
`.trim();

const LANGUAGE_NAMES: Record<string, string> = {
  ko: '한국어',
  en: 'English',
};

// 출력 언어만 변수화한다(다국어 UI 대비, v1.2 실제 전달 전까지는 앱이 항상 'ko'를 보낸다 —
// BACKLOG.md "v1.2" 참고). 문헌 근거/규칙 등 나머지 지시문은 언어와 무관하게 한국어로
// 고정 — Claude에게 주는 내부 지시라 사용자에게 노출되지 않는다.
export function buildSystemPrompt(outputLanguage: string = 'ko'): string {
  const languageName = LANGUAGE_NAMES[outputLanguage] ?? LANGUAGE_NAMES.ko;
  return `
너는 파워냅(PowerNap) 앱의 수면 분석 도우미다. 사용자의 낮잠 기록(시각/모드/사용시간 +
후기 설문 4항목 + 메모 + 기상 루틴 체크리스트)을 분석해 다음 두 가지를 제안한다:
1. 수면 대기시간(latency)/카페인 발현시간(caffeineOnset)의 ± 분 단위 조정 제안(숫자만, 근거는 summary/advice에서 설명)
2. 낮잠 환경·습관에 대한 전반적 조언

# 문헌 근거 (제안의 근거로 삼을 것 — 이 범위를 벗어나는 조정은 제안하지 마라)
${LITERATURE_BASIS}

# 핵심 원칙
- 너는 제안만 한다. 사용자의 설정을 직접 바꾸지 않는다 — 적용 여부는 항상 사용자가 결정한다.
- 조정 제안은 반드시 위 문헌 근거 범위 안에서만 한다. 근거 없이 임의로 큰 폭(예: ±15분 이상)을
  제안하지 마라.
- 데이터가 부족하거나(기록 5개 미만이면 애초에 이 함수가 호출되지 않는다) 패턴이 불분명하면
  confidence를 'low'로, adjust 값은 null로 반환해도 된다. 억지로 숫자를 만들어내지 마라.
- 만성 수면부족 사용자의 "아직 부족해요" 패턴은 낮잠 길이 부족이 아니라 누적된 수면부채
  신호일 수 있다 — 이 경우 낮잠 시간을 늘리라고 제안하지 말고, 그 가능성을 advice에서
  설명해라(PowerNap은 Phase 4-3에서 자동 조정을 폐지하고 수동 조정으로 전환했다 — 같은 이유).

# 조언 가이드 (advice 작성 시 참고)
- 낮잠 기록의 시각(각 기록의 localTimeKst)을 보고 이른 오후(1~3시) 대비 늦은 시간대
  (3시 이후)에 낮잠이 몰려 있으면 짚어줘라. 단, 최적 시점은 크로노타입(아침형/저녁형)과
  최근 빛 노출에 따라 개인차가 크다(저녁형은 아침형보다 수면 위상이 2~3시간 늦다) —
  "이 시간이 무조건 나쁘다"고 단정하지 말고 가능성으로만 제시해라.
- 설문의 소음/빛 점수('하')가 반복되면 조용하고 어둡고 시원한 환경이 입면을 돕는다는
  점과 함께 안대·귀마개 같은 구체적인 개선책을 advice에 제안해라.
- 하루 낮잠 횟수가 많은 패턴(같은 날짜에 기록이 3회 이상)이 보이면 밤잠 보호를 위해
  빈도를 줄이는 게 도움될 수 있다는 점을 언급해라.

# 제외할 것 (advice에 절대 넣지 마라)
- 90분(수면 한 사이클) 낮잠 권장 — 파워냅은 짧은 낮잠(10~30분) 전용 앱이라 앱 정체성과
  정면으로 충돌한다.
- 장기 건강 효과 주장(예: "장기적으로 심혈관 건강에 좋다") — 상관관계를 인과관계처럼
  말하거나 의학적 효능을 주장하는 리스크가 있다.

# 의학적 표현 제한 (반드시 지킬 것)
- "진단", "치료" 등 의학적 처치를 시사하는 표현을 절대 쓰지 마라.
- 너의 조언은 일반적인 수면 위생(sleep hygiene) 정보이며 의학적 조언이 아니다. summary 또는
  advice 마지막 항목에 이 사실을 명시해라.
- 메모나 설문에서 만성 불면, 장기간 지속되는 심각한 피로, 수면무호흡 의심 증상 등 수면장애를
  시사하는 패턴이 보이면, advice에 전문가(수면클리닉/의사) 상담을 권유하는 문구를 반드시
  포함해라.

# 출력
JSON 스키마로 강제되니 자유 텍스트를 섞지 마라. summary는 2~3문장, advice는 2~5개 항목
(각 항목은 한 문장), 전부 ${languageName}로 작성한다.
`.trim();
}

export const AnalysisReportSchema = z.object({
  latencyAdjust: z
    .object({
      fast: z.number().int(),
      slow: z.number().int(),
    })
    .nullable(),
  caffeineOnsetAdjust: z.number().int().nullable(),
  summary: z.string(),
  advice: z.array(z.string()).min(1).max(5),
  confidence: z.enum(['high', 'low']),
});

export type AnalysisReport = z.infer<typeof AnalysisReportSchema>;

interface CurrentSettings {
  latency: { fast: number; slow: number };
  caffeineOnset: number;
}

// KST(UTC+9, DST 없음) 시:분 라벨 — "낮잠 최적 시간대" 조언 가이드가 기록의 시각을
// 정확히 비교하려면 모델이 epoch ms를 직접 변환하는 것보다 미리 계산해 주는 쪽이
// 안정적이다(index.ts의 mondayKstBoundaryUtc와 같은 이유로 여기도 KST 계산을 직접 둔다 —
// Deno 함수는 src/format.ts를 import할 수 없는 별도 런타임이라 작은 유틸은 각자 둔다).
function toKstTimeLabel(epochMs: number): string {
  const kst = new Date(epochMs + 9 * 60 * 60 * 1000);
  const hours = kst.getUTCHours();
  const minutes = kst.getUTCMinutes();
  const ampm = hours < 12 ? '오전' : '오후';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${ampm} ${hour12}:${String(minutes).padStart(2, '0')}`;
}

// NapRecord 스냅샷(src/store.ts와 동일 구조, PII 없음 — 시각/모드/설문/메모/체크리스트뿐)에
// KST 시:분 라벨(localTimeKst)만 덧붙여 그대로 JSON으로 넘긴다. 개인정보(이름/이메일/기기
// 식별자 등)가 원래 이 레코드에 없으므로 별도 익명화 처리는 불필요.
export function buildAnalysisUserMessage(records: unknown[], settings: CurrentSettings): string {
  const enriched = records.map((r) => {
    const record = r as { completedAt?: unknown };
    return typeof record.completedAt === 'number'
      ? { ...record, localTimeKst: toKstTimeLabel(record.completedAt) }
      : record;
  });

  return [
    `현재 설정: latency.fast=${settings.latency.fast}분, latency.slow=${settings.latency.slow}분, caffeineOnset=${settings.caffeineOnset}분`,
    `낮잠 기록 ${records.length}개(JSON, 최신순 아님, localTimeKst는 completedAt을 KST 시:분으로 미리 변환해둔 값):`,
    JSON.stringify(enriched, null, 2),
  ].join('\n\n');
}
