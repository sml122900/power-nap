# 연결된 Chrome 확장이 이 실행 환경의 localhost 서버에 닿지 않음

## 문제상황

실기기 없이 `app/sleep.tsx`의 강아지 캐릭터 배치를 스크린샷으로 확인해야
했다. `app/sleep.tsx`의 실제 스타일 값을 그대로 이식한 정적 HTML 목업을
만들고, `claude-in-chrome` 브라우저 자동화 도구로 그 페이지를 열어 캡처하려
했다.

- `file://` 경로로 직접 네비게이션 → "Can't interact with browser-internal or
  unparseable URLs"로 거부됨.
- 로컬 정적 HTTP 서버(`node`의 `http.createServer`, 포트 5173→5174)를 띄우고
  같은 호스트에서 `curl`로는 200이 정상 응답됐는데도, 확장으로 연결된 Chrome은
  네비게이션 직후 `location.href`가 `chrome-error://chromewebdata/`로 떨어짐
  (tab 메타데이터의 title/url은 요청한 주소를 그대로 보여줘서 처음엔 정상
  로드된 것처럼 착각하기 쉬웠다 — `javascript_tool`로 `location.href`를 직접
  찍어봐야 실제 에러 페이지라는 게 드러남).

## 시도한 것들

1. 포트를 바꿔 재시도 — 동일하게 실패.
2. Bash 도구를 `dangerouslyDisableSandbox: true`로 재실행해 서버를 샌드박스
   밖에서 띄움 — 그래도 동일하게 실패. 이 시점에 "Bash 실행 샌드박스의 네트워크
   격리" 가설을 기각.
3. `https://example.com` 같은 공인 도메인으로 네비게이션 — 정상 로드됨(title이
   "Example Domain"으로 바뀜). → 확장 자체의 네비게이션 기능은 정상이고,
   `localhost`만 특이하게 실패한다는 게 확정됨.
4. Artifact로 우회 시도 — 정적 HTML을 Artifact로 퍼블리시하면 `localhost`가
   아니라 `claude.ai` 도메인이 되니 네트워크 문제를 피할 수 있을 거라 판단.
   하지만 그 브라우저 세션이 `claude.ai`에 로그인돼 있지 않아 "Page not
   found / Sign in" 벽에 막힘. (로그인은 자격증명 입력이 필요해 에이전트가
   대신 할 수 없는 영역이라 사용자에게 직접 로그인할지, 다른 방법을 쓸지 확인)

## 최종 해결법

`claude-in-chrome`으로 연결되는 브라우저는 이 코드 실행 환경과 같은 호스트에
있지 않고 별도로 릴레이되는 인스턴스라, 그 브라우저 기준 "localhost"는 이
환경이 아니라 그 브라우저 자신의 로컬 호스트를 가리킨다 — 애초에 이 환경에서
띄운 서버에 닿을 수 없는 구조였다. 사용자 확인을 받아 세션 스크래치 경로에
`playwright` + Chromium(~200MB, 프로젝트/git과 무관, `npm init -y` 후 로컬
설치)을 직접 설치해, **이 실행 환경과 같은 호스트에서** 헤드리스 브라우저로
로컬 서버를 열고 캡처했다. 같은 호스트이므로 `localhost`가 정상 동작했고,
`page.screenshot({ clip })`으로 카드 단위·3배 확대 크롭까지 문제없이 캡처됨.

## 이력서 소재 한 줄

"tab 메타데이터(title/url)가 정상으로 보여도 실제 렌더링된 프레임은 에러
페이지일 수 있다는 걸 `location.href` 직접 조회로 확인하고, 통제된 변수
교체(공인 도메인 vs localhost, 샌드박스 on/off)로 원인을 브라우저-호스트 간
네트워크 분리로 좁혀낸 뒤, 외부 인증이 필요한 우회로(Artifact) 대신 같은
호스트 안에서 자체 완결되는 헤드리스 브라우저 설치로 전환해 실기기 없이도
UI 변경을 시각적으로 검증하는 파이프라인을 만든 사례."
