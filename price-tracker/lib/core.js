(() => {
  const DAY = 86400000, MAX_PRODUCTS = 50;
  function backupRecommended(state,now=Date.now()) {
    if(!Object.values(state.products).some(product=>Object.keys(product.records).length))return false;
    const exported=Date.parse(state.lastCsvExportAt);
    return !Number.isFinite(exported)||now-exported>=7*DAY;
  }
  function parseProduct(raw) {
    let url; try { url = new URL(raw); } catch { return null; }
    if (url.protocol !== 'https:') return null;
    let site, id;
    if (['musinsa.com','www.musinsa.com'].includes(url.hostname)) { site='musinsa'; id=url.pathname.match(/^\/products\/(\d+)\/?$/)?.[1]; }
    else if (['www.oliveyoung.co.kr','m.oliveyoung.co.kr'].includes(url.hostname) && /\/(?:store|m)\/(?:goods\/getGoodsDetail\.do|G\.do)$/.test(url.pathname)) { site='oliveyoung'; id=url.searchParams.get('goodsNo'); if (!/^[A-Z]\d{12}$/.test(id || '')) id=null; }
    if (!id) return null;
    return {site,id,key:`${site}:${id}`,url:site==='musinsa' ? `https://www.musinsa.com/products/${id}` : `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=${id}`};
  }
  const today = (now = new Date()) => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const dayNumber = date => Date.parse(date+'T00:00:00Z') / DAY;
  const validDate = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(dayNumber(value)) && new Date(dayNumber(value)*DAY).toISOString().slice(0,10)===value;
  const dateOffset = (date, days) => new Date((dayNumber(date)+days)*DAY).toISOString().slice(0,10);
  const price = (value, nullable=false) => {
    if (nullable && (value === null || value === '' || value === undefined)) return null;
    const amount = typeof value==='number' ? value : /^\d+$/.test(String(value)) ? Number(value) : NaN;
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000) throw new Error('가격은 1원~10억원 사이의 정수로 입력하세요.');
    return amount;
  };
  const median = values => { if (!values.length) return null; const sorted=[...values].sort((a,b)=>a-b), middle=Math.floor(sorted.length/2); return sorted.length%2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2; };
  function stats(product, date=today()) {
    const rows=Object.values(product.records || {}).filter(x=>x.date<=date).sort((a,b)=>a.date.localeCompare(b.date));
    const current=rows.at(-1) || null, values=rows.map(x=>x.sale);
    const baseline=current ? rows.filter(x=>x.date<current.date && x.date>=dateOffset(current.date,-90)).map(x=>x.sale) : [];
    const reference=median(baseline);
    const badge=rows.length<14 || reference==null ? '데이터 수집 중' : current.sale<=reference*0.9 ? '진짜 세일' : '평소 가격';
    return {current,count:rows.length,min:rows.length>=14?Math.min(...values):null,average:rows.length>=14?values.reduce((a,b)=>a+b,0)/values.length:null,discountRate:current?.original?Math.round((current.original-current.sale)/current.original*1000)/10:null,median90:reference,badge,recordedToday:!!product.records?.[date]};
  }
  function normalizeConfig(raw={}) {
    const optionMode=['none','same','different'].includes(raw.optionMode) ? raw.optionMode : 'unknown';
    const selectors={};
    for (const [field, item] of Object.entries(raw.selectors || {})) {
      if (!['name','image','original','sale','option'].includes(field) || typeof item?.selector!=='string' || item.selector.length>1600) continue;
      selectors[field]={selector:item.selector,tag:String(item.tag||'').slice(0,20),overrideHidden:!!item.overrideHidden};
    }
    return {publicConfirmed:raw.publicConfirmed===true,optionMode,firstOptionLabel:String(raw.firstOptionLabel||'').trim().slice(0,250),selectors};
  }
  function validateRecord(raw, date=today()) {
    if (!validDate(raw.date || date) || (raw.date || date)>today()) throw new Error('기록 날짜가 올바르지 않습니다.');
    const original=price(raw.original,true), sale=price(raw.sale);
    if (original!=null && original<sale) throw new Error('정가가 판매가보다 낮습니다. 값을 확인하세요.');
    const timestamp=raw.recordedAt || new Date().toISOString();
    if (!Number.isFinite(Date.parse(timestamp)) || Date.parse(timestamp)>Date.now()+300000) throw new Error('기록 시간이 올바르지 않습니다.');
    return {date:raw.date||date,original,sale,eventName:String(raw.eventName||'').replace(/\s+/g,' ').trim().slice(0,120),recordedAt:timestamp,source:['auto','manual','confirmed'].includes(raw.source)?raw.source:'manual',loginState:['loggedIn','loggedOut'].includes(raw.loginState)?raw.loginState:'unknown',optionName:String(raw.optionName||'').slice(0,250),optionPriceDiffers:raw.optionPriceDiffers===true?true:raw.optionPriceDiffers===false?false:null,loginPriceDiffers:raw.loginPriceDiffers===true,loginComparison:['differenceObserved','samePriceObserved'].includes(raw.loginComparison)?raw.loginComparison:'unverified',method:String(raw.method||'manual').slice(0,120)};
  }
  function putRecord(product, record) {
    product.records ||= {};
    const prior=product.records[record.date];
    if (!prior || Date.parse(record.recordedAt)>=Date.parse(prior.recordedAt)) product.records[record.date]=record;
    product.lastError=null; return product;
  }
  function eligibility(config, evidence) {
    if (!config.publicConfirmed) return '공통 판매가 기준 확인이 필요합니다.';
    if (evidence.blocked) return evidence.blocked;
    if (!evidence.sale) return '판매가를 읽지 못했습니다. 위치 지정 또는 직접 입력이 필요합니다.';
    if (evidence.optionPriceDiffers===true && config.optionMode!=='different') return '옵션별 가격 차이가 발견됐습니다. 첫 번째 옵션을 확인하세요.';
    if (config.optionMode==='unknown') return '옵션 가격 기준이 미확인입니다.';
    if (config.optionMode==='different' && !evidence.firstOptionVerified) return '첫 번째 옵션이 선택됐는지 확인할 수 없습니다. 첫 번째 옵션을 선택하고 옵션명 위치를 지정하거나 직접 기록하세요.';
    if (config.optionMode==='different' && evidence.saleMethod!=='click') return '옵션별 가격이 다르면 현재 화면의 판매가 위치를 지정해야 합니다. 숨은 기본 가격은 자동 기록하지 않습니다.';
    return null;
  }
  function priceChanges(previous,current){
    if(!previous)return [];
    return ['sale','original'].filter(field=>previous[field]>0&&current[field]>0&&Math.abs(current[field]-previous[field])*100>=previous[field]*30).map(field=>({field,previous:previous[field],current:current[field]}));
  }
  globalThis.PriceCore={DAY,MAX_PRODUCTS,backupRecommended,parseProduct,today,dayNumber,validDate,dateOffset,price,median,stats,normalizeConfig,validateRecord,putRecord,eligibility,priceChanges};
})();
