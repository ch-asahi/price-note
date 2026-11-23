(() => {
  const definition = '쿠폰·회원등급·카드 할인을 제외한 공통 할인가. 옵션이 있으면 첫 번째 옵션 기준. 정가 미표시는 null.';
  function evaluate(report) {
    const basis = report.basis || {}, comparison = report.comparison || {}, selected = report.selected || {};
    const flags = [], blockers = [];
    if (selected.original?.method === 'click' && selected.sale?.method === 'click' && selected.original.location && selected.original.location === selected.sale.location) blockers.push('정가와 판매가가 같은 요소임: 별도 정가 확인 필요');
    if (basis.priceKind !== 'public') blockers.push('공통 할인가인지 확인 필요');
    if (!['loggedIn','loggedOut'].includes(basis.loginState)) flags.push('로그인 상태 미확인');
    if (basis.optionCase === 'different') flags.push('옵션 가격 다름');
    if (!['none','same','different'].includes(basis.optionCase)) blockers.push('옵션 가격 확인 필요');
    if (basis.optionCase !== 'none' && (!basis.firstOptionConfirmed || !basis.firstOptionName?.trim())) blockers.push('첫 번째 옵션 선택·이름 확인 필요');
    if (!selected.sale || selected.sale.value !== comparison.salePrice) blockers.push('화면 판매가와 읽은 판매가 일치 확인 필요');
    if (comparison.originalPrice != null && selected.original?.value !== comparison.originalPrice) blockers.push('화면 정가와 읽은 정가 불일치');
    if (selected.original && comparison.originalPrice == null) blockers.push('읽은 정가의 화면 확인 필요');
    if (!['pass','partial'].includes(comparison.verdict)) blockers.push('전체 비교 결과 확인 필요');
    if (!selected.name || !selected.image) blockers.push('상품명·이미지 읽기 필요');
    return {definition, flags, blockers, publicPriceConfirmed:basis.priceKind === 'public',
      optionPriceDiffers:basis.optionCase === 'different' ? true : ['none','same'].includes(basis.optionCase) ? false : null,
      optionBasis:basis.optionCase === 'none' ? 'no-options' : basis.firstOptionConfirmed ? 'first-option' : 'unconfirmed',
      optionLabel:basis.firstOptionName?.trim() || null, loginState:basis.loginState || 'unknown',
      priceFieldsMatchScreen:!!selected.sale && selected.sale.value === comparison.salePrice && (comparison.originalPrice == null ? !selected.original : selected.original?.value === comparison.originalPrice),
      priceBasisChecksPassed:blockers.length === 0,
      note:'가격 기준 검사 통과는 여러 상품 테스트 전체 통과를 의미하지 않습니다. 상품명·이미지 및 사이트별 안정성은 보고서를 검토해 판단합니다.'};
  }
  function loginComparison(current, observations) {
    const basis = current.basis || {}, policy = evaluate(current);
    if (!policy.priceBasisChecksPassed || !['loggedIn','loggedOut'].includes(basis.loginState)) return {status:'unverified', label:'로그인 전후 가격 차이 미확인'};
    const optionKey = basis.optionCase === 'none' ? 'no-options' : basis.firstOptionName.trim();
    const opposite = basis.loginState === 'loggedIn' ? 'loggedOut' : 'loggedIn';
    const prior = observations.find(x => x.site === current.site && x.productId === current.productId && x.optionKey === optionKey && x.loginState === opposite && Math.abs(Date.parse(current.checkedAt)-Date.parse(x.checkedAt)) <= 15*60*1000);
    if (!prior) return {status:'unverified', label:'같은 상품·옵션의 로그인 반대 상태 기록 없음 (15분 이내 비교)'};
    const different = current.selected.sale.value !== prior.salePrice;
    return {status:different ? 'differenceObserved' : 'samePriceObserved', label:different ? '로그인 전후 가격 다름 (시간차 영향 가능)' : '로그인 전후 같은 가격 관측',
      current:{loginState:basis.loginState,salePrice:current.selected.sale.value,checkedAt:current.checkedAt},
      other:{loginState:prior.loginState,salePrice:prior.salePrice,checkedAt:prior.checkedAt}, optionKey,
      note:'동시 측정이 아니므로 차이의 원인이 로그인이라고 단정하지 않습니다. 쿠키나 계정 정보는 읽지 않으며 로그인 상태는 사용자가 확인합니다.'};
  }
  function observation(report) {
    const basis = report.basis || {};
    if (!evaluate(report).priceBasisChecksPassed || !['loggedIn','loggedOut'].includes(basis.loginState)) return null;
    return {site:report.site, productId:report.productId, optionKey:basis.optionCase === 'none' ? 'no-options' : basis.firstOptionName.trim(), loginState:basis.loginState, salePrice:report.selected.sale.value, checkedAt:report.checkedAt};
  }
  globalThis.PriceTestPolicy = {evaluate, loginComparison, observation};
})();
