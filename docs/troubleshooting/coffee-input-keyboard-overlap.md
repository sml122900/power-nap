# 커피냅 직접입력 폼이 Android 키보드에 가려 확정 버튼이 안 보이던 문제

## 문제상황

홈 화면에서 커피냅 → 직접입력을 열고 숫자 입력창을 탭하면, 키보드가 올라오면서
입력창·실시간 미리보기·확정 버튼이 전부 화면 아래로 가려졌다. 이미 홈 화면 전체를
`ScrollView` + `KeyboardAvoidingView`로 감싸둔 상태였는데도 재현됐다.

## 시도한 것들

1. **1차 가설 — 스크롤 위치가 안 따라감**: Android는 `windowSoftInputMode=adjustResize`
   설정 덕에 키보드가 뜨면 창 자체가 줄어드는 게 정상 동작이라고 가정했다(실제로
   생성된 매니페스트에도 `adjustResize`가 박혀 있었다). 즉 뷰포트는 줄어드는데,
   스크롤 위치가 그대로라 줄어든 뷰포트 아래쪽(직접입력 패널)이 화면 밖으로 밀려난
   것이라고 보고, 입력창 `onFocus`에서 `scrollToEnd()`를 호출하도록 추가했다.
   → 결과: 사용자가 리로드해서 재확인했는데도 "그대로야"라는 리포트.
2. 재확인 요청에 "정확히 뭘 했는지"를 되짚다가, 애초에 `KeyboardAvoidingView`의
   Android `behavior`를 `undefined`로 둔 채 `adjustResize`에만 의존하고 있었다는
   걸 재확인했다 — 즉 1차 수정(스크롤 보정)이 실제로 반영되긴 했지만, 전제로 깔았던
   "adjustResize가 뷰포트를 줄여준다"는 가정 자체가 이 프로젝트의 빌드/edge-to-edge
   설정 조합에서는 기대만큼 작동하지 않고 있었을 가능성이 높다고 판단했다.

## 최종 해결법

`adjustResize`(네이티브 창 리사이즈)에만 기대지 않고, `KeyboardAvoidingView` 자체가
키보드 높이를 측정해 컨테이너를 줄여주는 `behavior: 'height'`를 Android에도 명시적으로
지정했다(원래는 iOS만 `'padding'`, Android는 `undefined`였다):

```tsx
<KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
```

그리고 `onFocus` 스크롤은 유지하되, 키보드 등장 애니메이션이 끝나 실제 뷰포트가 줄어든
뒤에 스크롤되도록 300ms 지연을 줬다(즉시 호출하면 아직 안 줄어든 크기 기준으로
`scrollToEnd`가 계산돼 여전히 모자랐다). 두 수정을 합치자 실기기에서 입력창·미리보기·
확정 버튼이 키보드 위로 정상적으로 보였다.

## 이력서 소재 한 줄

"방금 그 수정 반영 안 됐다"는 리포트를 곧바로 재수정으로 넘기지 않고 실제 반영된 코드를
되짚어, 근본 원인이 스크롤 타이밍이 아니라 애초에 기대했던 네이티브 리사이즈 동작
자체가 이 빌드 설정에서 충분치 않았다는 걸 재진단해 `KeyboardAvoidingView`의 명시적
`behavior` 지정으로 해결.
