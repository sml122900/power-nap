# tsconfig.json이 expo start마다 자동으로 되돌아가는 문제

## 문제상황

`tsconfig.json`의 `include` 배열에서 `.expo/types/**/*.ts`와 `expo-env.d.ts` 항목이 자꾸
사라지고, `paths` 객체의 배열 포맷도 한 줄 ↔ 여러 줄로 반복해서 바뀌는 현상이 있었다.
세션 시스템이 처음엔 "사용자 또는 린터가 의도적으로 수정한 변경"이라고 안내해서, 그런
줄로만 알고 매번 되돌리기만 반복했다.

## 시도한 것들

1. `include` 배열을 원래 4개 항목(`**/*.ts`, `**/*.tsx`, `.expo/types/**/*.ts`, `expo-env.d.ts`)으로
   수동 복원 후 커밋 — 다음 `expo start`/`expo run:android` 실행 후 다시 2개 항목으로 줄어듦.
   대증 요법이었을 뿐 재발을 막지 못함.
2. `app.json`/`package.json` 등 같은 시점에 바뀐 다른 prebuild 관련 설정을 검토하며 원인 후보에서
   하나씩 제외.
3. Expo CLI 소스코드를 직접 추적:
   `node_modules/expo/node_modules/@expo/cli/build/src/start/server/type-generation/startTypescriptTypeGeneration.js`에서
   `forceRemovalTSConfig`/`forceUpdateTSConfig` 호출 분기 확인.

## 최종 해결법

`app.json`의 `experiments.typedRoutes`가 `true`가 아니면, Expo CLI는 `expo start`를 실행할 때마다
`.expo/types/**/*.ts`와 `expo-env.d.ts`를 tsconfig의 `include`에서 **의도적으로 강제 제거**하도록
하드코딩되어 있다(`forceRemovalTSConfig`). 이 프로젝트는 typed routes를 켠 적이 없었기 때문에,
아무리 include를 복원해도 다음 실행 때 다시 지워질 수밖에 없는 구조였다.

- `app.json`에 `"experiments": { "typedRoutes": true }` 추가
- `tsconfig.json`의 `include`를 4개 항목 형태로 복원

이후 `forceUpdateTSConfig`가 필요한 항목이 이미 존재한다고 판단해 파일을 다시 쓰지 않는다.
별도 포트로 `expo start`를 한 번 더 실행해 `git status`가 clean하게 유지되는 것으로 검증했다.

## 이력서 소재 한 줄

반복되는 설정 파일 자동 변경을 "린터 탓"으로 넘기지 않고 Expo CLI 소스코드를 직접 추적해
근본 원인(비활성화된 typed-routes 실험 플래그)을 특정하고 영구적으로 해결함.
