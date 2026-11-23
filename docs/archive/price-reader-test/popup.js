let report, context;
const byId = id => document.getElementById(id);
const labels = {name:'상품명', image:'대표 이미지', original:'정가', sale:'판매가'};
async function getContext() {
  const [tab] = await chrome.tabs.query({active:true, currentWindow:true});
  const url = new URL(tab.url);
  const musinsa = ['www.musinsa.com', 'musinsa.com'].includes(url.hostname) && /^\/products\/\d+\/?$/.test(url.pathname);
  const oliveyoung = ['www.oliveyoung.co.kr', 'm.oliveyoung.co.kr'].includes(url.hostname) && /\/(?:store|m)\/(?:goods\/getGoodsDetail\.do|G\.do)$/.test(url.pathname) && !!url.searchParams.get('goodsNo');
  if (url.protocol !== 'https:' || (!musinsa && !oliveyoung)) throw new Error('무신사 또는 올리브영 상품 상세 페이지에서 실행해 주세요.');
  const site = musinsa ? 'musinsa' : 'oliveyoung';
  return {tab, url, site, config:PriceReaderSites[site], productId:musinsa ? url.pathname.match(/\d+/)[0] : url.searchParams.get('goodsNo'), mappingKey:`mapping:${url.hostname}`, reportKey:`report:${url.hostname}`};
}
const fail = error => { byId('status').textContent = error.message; };
async function persistComparison() {
  if (!report || !context) return;
  report.comparison = {verdict:byId('verdict').value, originalPrice:byId('original').value ? Number(byId('original').value) : null, salePrice:byId('sale').value ? Number(byId('sale').value) : null, notes:byId('notes').value};
  report.basis = {priceKind:byId('priceKind').value, loginState:byId('loginState').value, optionCase:byId('optionCase').value, firstOptionName:byId('firstOptionName').value.trim(), firstOptionConfirmed:byId('firstOptionConfirmed').checked};
  report.pricePolicy = PriceTestPolicy.evaluate(report);
  const observations = (await chrome.storage.local.get('loginObservations')).loginObservations || [];
  report.loginComparison = PriceTestPolicy.loginComparison(report, observations);
  byId('policyStatus').textContent = [...report.pricePolicy.flags, ...report.pricePolicy.blockers, report.loginComparison.label].join(' · ') || '가격 기준 확인됨';
  await chrome.storage.local.set({[context.reportKey]:report});
}
function render() {
  byId('fields').replaceChildren();
  byId('results').replaceChildren();
  byId('review').hidden = !report;
  if (!report) return;
  for (const field of PriceReaderDOM.fields) {
    const selected = report.selected[field];
    const card = document.createElement('section'); card.className = 'field';
    const title = document.createElement('div'); title.textContent = labels[field];
    const value = document.createElement('div'); value.className = 'value'; value.textContent = selected ? String(selected.value) : '못 찾음 / 후보 충돌';
    const source = document.createElement('div'); source.className = 'source';
    source.textContent = selected ? `${selected.method === 'hidden' ? '숨은 데이터' : '클릭'} · ${selected.kind} · ${selected.location}` : '숨은 데이터에서 확정할 수 없습니다. 클릭으로 지정하세요. 정가 미표시는 비워둡니다.';
    card.append(title, value, source);
    const button = document.createElement('button'); button.className = 'secondary';
    button.textContent = selected ? '이 값이 다름 · 클릭으로 수정' : `${labels[field]} 클릭 지정`;
    button.addEventListener('click', () => startPick(field, !!selected).catch(fail));
    card.append(button); byId('fields').append(card);
  }
  const comparison = report.comparison || {};
  byId('verdict').value = comparison.verdict || 'unverified';
  byId('original').value = comparison.originalPrice ?? '';
  byId('sale').value = comparison.salePrice ?? '';
  byId('notes').value = comparison.notes || '';
  const basis = report.basis || {};
  byId('priceKind').value = basis.priceKind || 'unknown';
  byId('loginState').value = basis.loginState || 'unknown';
  byId('optionCase').value = basis.optionCase || 'unknown';
  byId('firstOptionName').value = basis.firstOptionName || '';
  byId('firstOptionConfirmed').checked = !!basis.firstOptionConfirmed;
  report.pricePolicy = PriceTestPolicy.evaluate(report);
  byId('policyStatus').textContent = [...report.pricePolicy.flags,...report.pricePolicy.blockers,report.loginComparison?.label || '로그인 전후 차이 미확인'].join(' · ');
  const pre = document.createElement('pre'); pre.textContent = JSON.stringify(report, null, 2); byId('results').append(pre);
  const count = Object.values(report.selected).filter(Boolean).length;
  byId('status').textContent = `${count}/4항목 읽음 · 숨은 데이터 후보 ${report.hidden.candidates.length}개. 화면 비교 필요.${report.hidden.truncated ? ' 검사 범위 제한에 도달했습니다.' : ''}`;
}
async function startPick(field, overrideHidden) {
  await persistComparison();
  const current = await getContext();
  if (current.productId !== report.productId || current.tab.url !== report.pageUrl) throw new Error('상품 페이지가 바뀌었습니다. 먼저 다시 검사해 주세요.');
  await chrome.scripting.executeScript({target:{tabId:context.tab.id}, files:['readers/dom.js']});
  await chrome.scripting.executeScript({target:{tabId:context.tab.id}, func:options => globalThis.PriceReaderDOM.pick(options), args:[{field, mappingKey:context.mappingKey, reportKey:context.reportKey, productId:context.productId, overrideHidden}]});
  window.close();
}
byId('read').addEventListener('click', async () => {
  byId('read').disabled = true;
  try {
    await persistComparison();
    context = await getContext();
    byId('status').textContent = '실제 열린 페이지의 숨은 데이터를 검사하고 있습니다…';
    const [response] = await chrome.scripting.executeScript({target:{tabId:context.tab.id}, world:'MAIN', func:scanPriceHidden, args:[context.config, context.productId]});
    if (!response.result) throw new Error('검사 결과가 없습니다. 상품 화면이 로드된 뒤 다시 시도해 주세요.');
    const hidden = response.result;
    const stored = await chrome.storage.local.get([context.mappingKey, context.reportKey]);
    const mapping = stored[context.mappingKey] || {};
    const selected = PriceReaderDOM.resolveHidden(hidden);
    await chrome.scripting.executeScript({target:{tabId:context.tab.id}, files:['readers/dom.js']});
    const [mapped] = await chrome.scripting.executeScript({target:{tabId:context.tab.id}, func:(mapping, selected) => globalThis.PriceReaderDOM.readMappings(mapping, selected), args:[mapping, selected]});
    report = {version:'0.3.0', site:context.config.label, productId:context.productId, pageUrl:context.tab.url, checkedAt:new Date().toISOString(), hidden, selected:mapped.result.selected, mappingErrors:mapped.result.errors,
      note:'실제 열린 페이지의 데이터입니다. 숨은 데이터도 옵션·갱신 시점이 화면과 다를 수 있으므로 직접 비교해야 합니다. 정가를 판매가로 채우지 않습니다. 가격 기록 이력은 아직 저장하지 않습니다.'};
    if (report.selected.original && report.selected.sale && report.selected.original.value < report.selected.sale.value) report.warnings = ['정가가 판매가보다 낮습니다. 항목 의미와 옵션을 확인하세요.'];
    await chrome.storage.local.set({[context.reportKey]:report});
    render();
  } catch(error) { fail(error); }
  finally { byId('read').disabled = false; }
});
byId('reset').addEventListener('click', async () => {
  try {
    context = await getContext();
    await chrome.storage.local.remove(context.mappingKey);
    if (report) { for (const field of PriceReaderDOM.fields) if (report.selected[field]?.method === 'click') report.selected[field] = null; delete report.clickSelections; await chrome.storage.local.set({[context.reportKey]:report}); render(); }
    byId('status').textContent = '이 사이트의 클릭 위치를 지웠습니다. 숨은 데이터 검사 버튼을 다시 누르세요.';
  } catch(error) { fail(error); }
});
byId('review').addEventListener('input', () => { persistComparison().catch(fail); });
byId('review').addEventListener('submit', async event => {
  event.preventDefault();
  if (!report) return;
  try {
    await persistComparison();
    const observation = PriceTestPolicy.observation(report);
    if (observation) {
      const stored = (await chrome.storage.local.get('loginObservations')).loginObservations || [];
      const retained = stored.filter(x => !(x.site === observation.site && x.productId === observation.productId && x.optionKey === observation.optionKey && x.loginState === observation.loginState));
      await chrome.storage.local.set({loginObservations:[observation,...retained].slice(0,100)});
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], {type:'application/json'});
    const blobUrl = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = blobUrl; link.download = `price-read-test-${report.site}-${Date.now()}.json`; link.click();
    setTimeout(()=>URL.revokeObjectURL(blobUrl), 10000);
  } catch(error) { fail(error); }
});
(async () => {
  try {
    context = await getContext();
    const saved = (await chrome.storage.local.get(context.reportKey))[context.reportKey];
    if (saved?.version === '0.3.0' && saved.productId === context.productId && saved.pageUrl === context.tab.url) { report = saved; render(); }
    else byId('status').textContent = '이 상품에서 숨은 데이터 검사 버튼을 먼저 누르세요.';
  } catch(error) { fail(error); }
})();
