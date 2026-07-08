// Supabase 클라이언트 — AI 분석 기능(AI_ANALYSIS.md) 전용, 그 외 기능은 여전히 로컬 전용.
// 신형 publishable key 체계 사용 (레거시 anon key 아님) — RLS 권한 모델은 동일.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

// 지연 초기화 — 모듈 로드 시점이 아니라 실제 호출 시점에 env var를 확인한다(발견 즉시 수정:
// useFreeResetStatus → aiAnalysis.ts로 이어지는 체인을 history.tsx가 끌어오면서, .env 없이
// 순수 함수만 테스트하려는 app/history.test.ts까지 모듈 로드 단계에서 throw에 막혔었음 —
// 화면 컴포넌트를 통해 이 모듈을 끌어오는 테스트 파일은 항상 이 위험이 있으니 즉시 실행
// 대신 지연 초기화로 바꿔 원천 차단한다).
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY가 .env에 없다.');
  }

  client = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export interface AnonymousSession {
  userId: string;
  accessToken: string;
}

// 익명 인증 세션 확보 — 세션이 없을 때만 새로 발급한다(재호출해도 기존 세션 유지).
// accessToken을 함께 반환하는 이유: supabase-js의 functions.invoke()는 세션 JWT를
// 자동으로 Authorization 헤더에 넣어주지 않는다(client.functions는 매번 새 인스턴스를
// 만들고 정적 헤더만 물려받음) — 호출부(aiAnalysis.ts)가 직접 넣어야 한다.
export async function ensureAnonymousSession(): Promise<AnonymousSession> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  if (data.session) return { userId: data.session.user.id, accessToken: data.session.access_token };

  const { data: signInData, error } = await supabase.auth.signInAnonymously();
  if (error || !signInData.session) {
    throw error ?? new Error('익명 로그인 실패');
  }
  return { userId: signInData.session.user.id, accessToken: signInData.session.access_token };
}
