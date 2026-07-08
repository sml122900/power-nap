// Supabase 클라이언트 — AI 분석 기능(AI_ANALYSIS.md) 전용, 그 외 기능은 여전히 로컬 전용.
// 신형 publishable key 체계 사용 (레거시 anon key 아님) — RLS 권한 모델은 동일.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY가 .env에 없다.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// 익명 인증 세션 확보 — 세션이 없을 때만 새로 발급한다(재호출해도 기존 세션 유지).
export async function ensureAnonymousSession(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;

  const { data: signInData, error } = await supabase.auth.signInAnonymously();
  if (error || !signInData.session) {
    throw error ?? new Error('익명 로그인 실패');
  }
  return signInData.session.user.id;
}
