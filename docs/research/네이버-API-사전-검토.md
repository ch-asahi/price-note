# 네이버 쇼핑 검색 API 사전 검토

확인일: 2026-11-23 (한국 시간)

## 결론

요청한 네이버 쇼핑 검색 API 방식은 현재 구현 조건을 통과하지 못한다. 네이버 공식 공지에 따르면 쇼핑 검색 API는 2026-07-31 종료되었으며 NAVER API HUB 이관 대상에서 제외되었다. 기존 키도 호출할 수 없고, NAVER API HUB를 포함한 별도 대체 API도 제공하지 않는다고 명시되어 있다.

공식 공지:
- https://developers.naver.com/notice/article/32564
- https://developers.naver.com/notice/article/32530

현재 HUB API 목록도 확인했다. 쇼핑 인사이트는 검색 클릭 추이를 제공하며 개별 상품의 가격이나 판매처를 반환하는 쇼핑 검색 API와 다르다.

현재 API 목록: https://api.ncloud-docs.com/docs/naver-api-hub-overview

## 요청 항목별 상태

| 요청 | 상태 |
| --- | --- |
| 이전 무신사 상품명으로 API 검색 | 미실행: 해당 API 서비스 종료 |
| 이전 올리브영 상품명으로 API 검색 | 미실행: 해당 API 서비스 종료. 이전 상품 페이지는 403으로 상품명 자체도 확보하지 못했음 |
| mallName이 무신사 또는 올리브영인 결과 확인 | 미확인: 실제 API 검색 응답 없음 |
| API 가격과 실제 상품 페이지 가격 비교 | 미확인: API 응답 없음. 이전 쇼핑몰 HTTP 요청도 403으로 현재 가격 미확보 |
| 실행 환경의 NAVER/NCP 관련 환경변수 | 이름을 검사했으나 발견되지 않음. 비밀 값은 출력하지 않음 |

이 결과는 검색 결과가 0개라는 뜻이 아니다. 실제 인증 API 호출이나 가격 일치 검증을 수행한 결과가 아니라, 서비스 종료를 공식 문서로 확인한 결과다. 무인증 요청의 인증 오류만으로 상품 검색 가능 여부를 판정하지 않았다. 이번에는 쇼핑몰 사이트에 추가 요청하지 않았다.

## 가격 필드에 대한 별도 제한

남아 있는 예전 쇼핑 검색 API 문서에는 lprice가 최저가(가격비교 데이터가 없으면 상품 가격), hprice가 최고가로 설명돼 있다. hprice는 정가가 아니며 원래 요청한 정가·판매가 동시 기록을 충족하는 근거로 사용할 수 없다. 상품명 일치나 mallName만으로 옵션 및 할인 조건까지 같다고 판단할 수도 없다.

예전 명세(현재 서비스 제공을 의미하지 않음): https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md

## API HUB 키 발급 방법 참고

쇼핑 검색용 키는 현재 발급받아 사용할 수 없다. 아래 절차는 HUB에서 현재 지원하는 다른 API의 일반적인 키 발급 방법이다. 이번 가격 추적 프로젝트를 위해 발급할 필요는 없다.

1. https://www.ncloud.com/ 에서 가입 또는 로그인 후 콘솔에 들어간다.
2. Menu → All Services → Application Services → NAVER API HUB로 이동한다.
3. Application → Application 등록을 누른다.
4. 지원되는 API를 선택하고 다음을 누른 뒤, 이름을 입력해 완료한다.
5. 등록한 Application 선택 → API 관리 → 인증 정보에서 Client ID와 Client Secret을 확인한다.

공식 발급 안내: https://api.ncloud-docs.com/docs/naver-api-hub-overview

## 다음 단계

사이트 구현, 패키지 설치, API HUB 애플리케이션 생성 및 배포는 시작하지 않았다. 자동 기록을 유지하려면 두 판매처의 상품 가격을 제공하는 공식 제휴 API 또는 사용 허가를 받은 데이터 제공처를 먼저 확보하고, 그 데이터의 상품 식별·판매처·가격·정가 제공 여부를 검증해야 한다. 다른 데이터 제공 경로를 조사할지 사용자 확인을 기다린다.
