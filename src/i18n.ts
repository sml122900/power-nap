// 다국어 부트스트랩 — DESIGN 결정: locales/ko.json·locales/en.json 단일 파일(화면별 네임스페이스는
// 파일 내부 최상위 키로 분리)에서 정적으로 리소스를 불러와 동기 초기화한다(네트워크 백엔드 없음 —
// init() 호출 직후부터 t()가 바로 동작함, RN에서 로딩 화면 없이 첫 렌더부터 번역 가능).
//
// 언어 결정 우선순위: AsyncStorage 수동 선택('ko'|'en') > 기기 언어(expo-localization) > 'ko' 폴백.
// AsyncStorage는 이 파일 최상단에서 import하지 않는다 — supabase.ts와 같은 이유(getSupabase() 참고):
// 모듈 로드 시점에 네이티브 모듈을 건드리면 이 파일을 그저 import만 하는 순수 함수 테스트까지
// jest.mock 없이는 깨진다. AsyncStorage가 실제로 필요한 함수(get/setLanguagePreference)에서만
// 지연 import한다.
//
// 확장(예: 일본어 추가) 시 SUPPORTED_LANGUAGES에 코드 추가 + locales/{lang}.json 작성 +
// resources에 등록 + format.ts에 해당 언어 포맷터 추가.
import * as Localization from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';
import ko from '../locales/ko.json';

export const SUPPORTED_LANGUAGES = ['ko', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type LanguagePreference = 'system' | AppLanguage;

const LANGUAGE_STORAGE_KEY = 'powernap:languagePreference';

function isAppLanguage(value: string): value is AppLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function resolveDeviceLanguage(): AppLanguage {
  const code = Localization.getLocales()[0]?.languageCode ?? '';
  return isAppLanguage(code) ? code : 'ko';
}

void i18next.use(initReactI18next).init({
  resources: { ko, en },
  lng: resolveDeviceLanguage(),
  fallbackLng: 'ko',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
  initImmediate: false,
});

export async function getLanguagePreference(): Promise<LanguagePreference> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === 'ko' || stored === 'en' ? stored : 'system';
}

export async function setLanguagePreference(pref: LanguagePreference): Promise<void> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  if (pref === 'system') {
    await AsyncStorage.removeItem(LANGUAGE_STORAGE_KEY);
  } else {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, pref);
  }
  await i18next.changeLanguage(pref === 'system' ? resolveDeviceLanguage() : pref);
}

// 앱 부팅 시 1회 호출 — 저장된 수동 선택이 있으면 그 언어로 전환한다. 저장된 값이 없으면
// (= 'system') 위 sync init()이 이미 기기 언어로 초기화해둔 상태 그대로 둔다.
export async function loadPersistedLanguagePreference(): Promise<void> {
  const pref = await getLanguagePreference();
  if (pref === 'system') return;
  if (pref !== i18next.language) await i18next.changeLanguage(pref);
}

export default i18next;
