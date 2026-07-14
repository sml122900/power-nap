# EXPO_PUBLIC_ 환경변수가 릴리즈 빌드에 안 박히던 문제 — .env가 아니라 동적 접근이 원인

## 문제상황

RevenueCat 결제 기능이 릴리즈 APK에서 "EXPO_PUBLIC_REVENUECAT_KEY_TEST가
.env에 없다"는 에러를 계속 냈다. 어제 세션에서 이미 한 번 조사해 ".env에
값이 정상적으로 있고, 빌드된 APK 번들에도 값이 박혀있다"고 확인·보고했는데,
오늘 다시 똑같은 에러가 재현됐다.

## 시도한 것들

1. 사용자가 "값 존재 여부가 아니라 빌드 주입 자체를 의심하고 실증하라"고
   지적 — `.env` 파일을 바이트 단위로 재점검(BOM 없음, 따옴표 없음, 줄
   끝 공백 없음, 중복 정의 없음)해 파일 자체는 처음부터 문제없었음을
   재확인.
2. 어제 "확인됨"의 근거였던 검증 방법을 되짚었다 —
   `grep -c "EXPO_PUBLIC_REVENUECAT_KEY_TEST\|test_sbpcywpytpHFXINcfQWCDCrEBWx"`
   처럼 OR 패턴으로 변수 **이름**과 실제 **값** 두 문자열을 한 번에
   찾고 있었다. 번들이 거대한 한 줄짜리 압축 텍스트라, 이름 문자열
   (에러 메시지 안에 늘 등장)만 매치해도 카운트가 1로 나와 "통과"로
   착각하기 딱 좋은 구조였다.
3. 값 자체만 따로 grep해보니 실제로는 0건 — 어제 검증이 틀렸다는 게
   확정됐다. 대조군으로 이미 정상 작동 중인 `EXPO_PUBLIC_SUPABASE_URL`
   값을 같은 방식으로 검색해보니 1건 매치 — "인라인 자체가 아예 안
   되는 것"이 아니라 "이 두 개 키만" 안 되는 상황으로 범위를 좁혔다.
4. 두 값이 서로 다른 이유를 코드에서 찾았다 — `src/supabase.ts`는
   `process.env.EXPO_PUBLIC_SUPABASE_URL`(정적 멤버 접근)로 읽는데,
   `src/purchases.ts`는 `process.env[envVar]`(런타임 변수로 계산된
   동적 접근)로 읽고 있었다.
5. `babel-preset-expo`의 인라인 플러그인 소스
   (`node_modules/babel-preset-expo/build/plugins/inline-env-vars.js`)를
   직접 읽어 확정 — 이 플러그인은 AST의 `property`가 문자열 리터럴이거나
   식별자(예: `.FOO`)일 때만 `EXPO_PUBLIC_` 접두사를 인식해 빌드 시점
   리터럴로 치환한다. `process.env[envVar]`의 `envVar`는 값이 아니라
   변수 "이름" 자체가 코드로 넘어가서, 플러그인이 보는 키는
   `'envVar'`이지 `'EXPO_PUBLIC_...'`이 아니다 — 애초에 매칭 자체가
   안 되는 구조였다.

## 최종 해결법

`resolveApiKey()`에서 두 키를 각각 정적으로(`process.env.EXPO_PUBLIC_REVENUECAT_KEY_TEST`,
`process.env.EXPO_PUBLIC_REVENUECAT_KEY_PLAY`) 읽어와 변수에 담아두고,
`REVENUECAT_STORE` 분기는 이미 읽어둔 두 값 중 어느 걸 쓸지 고르는
데만 사용하도록 바꿨다. 수정 후 `gradlew --stop && assembleRelease
--rerun-tasks`로 태스크 캐시까지 우회한 완전히 새 빌드를 만들고, APK 안
`assets/index.android.bundle`에서 두 값 리터럴 문자열 자체를 grep으로
직접 확인해(대조군 Supabase URL과 동일하게 매치) 실제로 인라인됐음을
실증했다.

## 이력서 소재 한 줄

"에러 없음 = 정상"을 곧바로 믿지 않고 전날의 검증 방법론 자체(OR 패턴
grep이 변수 이름만으로도 통과 판정을 낼 수 있었던 결함)를 재점검해
잘못된 결론을 뒤집었고, 번들러 플러그인 소스코드까지 직접 읽어 "정적
멤버 접근만 인라인된다"는 근본 규칙을 확정한 뒤, 수정 후에도 반드시
빌드 산출물에서 리터럴 값 자체를 재검증하는 방식으로 재발을 막음.
