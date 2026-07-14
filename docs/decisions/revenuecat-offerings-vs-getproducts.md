# RevenueCat 상품 조회 — Offerings API 대신 getProducts 직접 조회

## Problem

RevenueCat Test Store로 결제 파이프라인을 검증하던 중 구매 버튼을 누르면
"no Test Store products registered in the dashboard for your offerings"
에러가 났다. 코드는 `Purchases.getOfferings()`로 현재 Offering을 가져와
그 안의 Package에서 상품을 찾는 방식(`offerings.current?.availablePackages.find(...)`)
이었는데, RevenueCat 대시보드에 Product는 등록했지만 그걸 감싸는 Offering을
만들고 "Current"로 지정한 뒤 Package로 묶는 절차는 안 밟은 상태였다.

## Action

에러 메시지만 보고 "Offering을 마저 만들면 되겠다"고 바로 대시보드 설정에
들어가는 대신, 먼저 이 앱의 실제 요구사항을 되짚었다 — 상품은
`powernap_extra_analysis_1000` 1종뿐이고, 여러 상품을 지역/실험별로 묶어
진열하는 Offering/Package 추상화가 애초에 값어치를 낼 상황이 아니었다.
RevenueCat 공식 문서와 설치된 SDK(`react-native-purchases@10.4.2`)의 타입
정의를 직접 확인해, `Purchases.getProducts(ids, type)` +
`Purchases.purchaseStoreProduct(product)`로 Offerings 계층을 완전히 우회할
수 있음을 확인했다. 이 경로는 RevenueCat의 Product Catalog에 상품 하나만
등록하면 끝나고, Offering을 만들고 Current로 지정하고 Package를 붙이는
절차가 아예 없어진다.

전환하면서 SDK 문서에서 놓치기 쉬운 함정 하나를 발견했다 — `getProducts`의
두 번째 인자(`PRODUCT_CATEGORY`)는 생략 시 기본값이 `SUBSCRIPTION`이라,
우리 상품처럼 소모성(`NON_SUBSCRIPTION`)인 경우 인자를 빠뜨리면 에러 없이
그냥 빈 배열만 돌아온다. 반드시 `PRODUCT_CATEGORY.NON_SUBSCRIPTION`을
명시하도록 코드에 남기고 CLAUDE.md 지뢰 목록에도 기록했다.

`restorePurchases()`는 그대로 둬도 되는지 별도로 확인했다 — SDK 문서상
이 함수는 스토어에 실제로 기록된 구매 이력(`CustomerInfo`)을 복원하는
것이라 상품을 Offerings로 조회했든 getProducts로 조회했든 무관하게
동작한다.

## Result

구매 플로우가 `getProducts`로 상품 존재를 확인하고 `purchaseStoreProduct`로
직접 구매하는 두 호출로 단순해졌다. 실기기 디버그 빌드에서 진단 로그를
추가해 실제로 `purchaseStoreProduct`가 성공 응답을 반환하고
`CustomerInfo.nonSubscriptionTransactions`에 RevenueCat 서버가 발급한
`revenueCatId`까지 포함된 트랜잭션이 쌓이는 걸 확인했다.

AI_ANALYSIS.md의 Phase D 문서도 갱신해, 나중에 Play Console 실상품으로
전환할 때도 "Product Catalog에 같은 상품 ID 등록"만 하면 되고 Offering을
만들 필요가 없다는 걸 명시했다 — 앞으로 이 프로젝트를 다시 열어보는 사람이
같은 Offerings 미설정 에러를 다시 겪지 않도록.

핵심 교훈: 에러 메시지가 가리키는 "누락된 설정을 채우는" 방향으로 바로
가기 전에, 그 설정(Offerings)이 애초에 이 앱의 요구사항(상품 1종)에
필요한 추상화인지부터 재확인했다. 대시보드 설정을 하나 더 만드는 것보다,
필요 없는 계층 자체를 코드에서 제거하는 쪽이 실패 지점을 하나 줄이는
더 근본적인 해결이었다.
