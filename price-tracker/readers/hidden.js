// MAIN 환경에서 실행할 자기완결 함수. 상품 후보만 반환하고 페이지 코드는 실행하지 않는다.
globalThis.scanPriceHidden = function (config, productId) {
  const candidates = [], rejected = [], sources = [];
  let nodes = 0, truncated = false, scriptBytes = 0, optionPriceDiffers = null, skippedBranches = 0;
  const normalize = key => String(key).replace(/[^a-z0-9]/gi, '').toLowerCase();
  const keys = role => new Set(config[role].map(normalize));
  const nameKeys = keys('nameKeys'), imageKeys = keys('imageKeys');
  const originalKeys = keys('originalKeys'), saleKeys = keys('saleKeys'), idKeys = keys('idKeys');
  const forbidden = /coupon|benefit|memberprice|cardprice|carddiscount|gradeprice|shipping|delivery|freight|unitprice|priceper|installment|reward|pointprice|쿠폰|카드|등급|배송|적립|포인트|단위|(?:\d\s*(?:ml|kg|g|l|개|매)\s*당)/i;
  const unrelated = /recommend|related|recentview|ranking|bestseller|review|장바구니|추천/i;
  const clean = value => String(value).replace(/\s+/g, ' ').trim();
  const money = value => {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    const raw = clean(value).replace(/[₩원,\s]/g, '');
    if (!/^\d+(?:\.0+)?$/.test(raw)) return null;
    const amount = Number(raw);
    return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
  };
  function add(field, raw, kind, location, identity = 'unspecified', context = '') {
    if (candidates.length + rejected.length >= 400) { truncated = true; return; }
    let value;
    if (field === 'original' || field === 'sale') value = money(raw);
    else if (typeof raw === 'string' && raw.length <= 2000) {
      value = clean(raw);
      if (field === 'image') {
        try { value = new URL(value, document.baseURI).href; } catch { return; }
        if (!/^https?:\/\//.test(value)) return;
      } else if (value.length > 300) return;
    }
    if (!value) return;
    const item = {field, value, method:'hidden', kind, location, productMatch:identity};
    const reason = identity === 'mismatch' ? '다른 상품 ID' : forbidden.test(location + ' ' + context) ? '단위 가격·배송·쿠폰·회원 혜택 등 제외 조건' : unrelated.test(location) ? '추천·연관 상품 영역' : null;
    if (reason) rejected.push({...item, reason}); else candidates.push(item);
  }
  const metas = [...document.querySelectorAll('meta[property], meta[name]')];
  const metaFields = {
    'og:title':'name', 'og:image':'image', 'og:image:secure_url':'image',
    'product:price':'sale', 'product:price:amount':'sale', 'og:price:amount':'sale',
    'product:sale_price:amount':'sale', 'product:original_price:amount':'original'
  };
  const currencies = metas.filter(el => /^(product|og):price:currency$/.test(el.getAttribute('property') || el.getAttribute('name') || '')).map(el => el.content);
  metas.forEach((el, index) => {
    const key = (el.getAttribute('property') || el.getAttribute('name') || '').toLowerCase();
    if (metaFields[key]) add(metaFields[key], el.content, 'meta', `meta[${index}][${key}]@content`, 'unspecified', currencies.some(x => x !== 'KRW') ? 'unitprice non-KRW' : '');
  });
  sources.push({kind:'meta', status:'inspected', tags:metas.length});
  function walk(value, path, kind, inherited = {}) {
    if (++nodes > 40000 || path.length > 1500) { truncated = true; return; }
    if ((inherited.depth || 0) > 20) { truncated = true; return; }
    if (!value || typeof value !== 'object') return;
    let descriptors;
    try { descriptors = Object.getOwnPropertyDescriptors(value); } catch { return; }
    const entries = Object.entries(descriptors).filter(([, descriptor]) => 'value' in descriptor);
    const direct = key => descriptors[key] && 'value' in descriptors[key] ? descriptors[key].value : undefined;
    const type = direct('@type');
    const typeText = typeof type === 'string' ? type : '';
    const isProduct = (Array.isArray(type) ? type : [type]).includes('Product');
    let identity = inherited.identity || 'unspecified';
    const ids = entries.filter(([key, descriptor]) => idKeys.has(normalize(key)) && ['string','number'].includes(typeof descriptor.value)).map(([, descriptor]) => String(descriptor.value));
    if (ids.length) identity = ids.includes(String(productId)) ? 'matched' : 'mismatch';
    const entityUrl = direct('url') || direct('@id');
    if (isProduct && typeof entityUrl === 'string') {
      try {
        const url = new URL(entityUrl, document.baseURI);
        const id = url.searchParams.get('goodsNo') || url.pathname.match(/\/products\/(\d+)/)?.[1];
        if (id) identity = id === String(productId) ? 'matched' : 'mismatch';
      } catch { /* 상품 식별 URL이 아님 */ }
    }
    const productContext = isProduct || inherited.product || ids.length > 0 || /(?:goods|product)(?:info|data|detail)?(?:\.|\[|$)/i.test(path);
    const ownProduct = isProduct || ids.length > 0 || /\["(?:product|goods)(?:info|data|detail)?"\]$/i.test(path) || /window\.(?:goods|product)(?:Info|Data)\$$/i.test(path);
    const currency = direct('priceCurrency');
    const context = [typeof type === 'string' ? type : '', direct('priceType'), direct('label'), direct('name'), direct('referenceQuantity') ? 'unitprice' : '', currency && currency !== 'KRW' ? 'unitprice non-KRW' : '', inherited.context || ''].filter(x => typeof x === 'string').join(' ').slice(0, 800);
    for (const [key, descriptor] of entries) {
      if (nodes > 40000) break;
      const raw = descriptor.value, normalized = normalize(key), location = `${path}[${JSON.stringify(key)}]`;
      if (/curation|recommend|related|snapreview|review|ranking|bestseller|cart|basket|wish|recentview|userInfo|memberInfo|account|orders|shippingAddress|payment/i.test(key)) { skippedBranches++; continue; }
      if (normalized === "optionprices") {
        if (identity === "matched" && raw && typeof raw === "object") {
          const prices = Object.values(Object.getOwnPropertyDescriptors(raw)).filter(x => 'value' in x).map(x => x.value).map(x => x && typeof x === "object" ? money(Object.getOwnPropertyDescriptor(x,"salePrice")?.value) : null).filter(Boolean);
          if (prices.length) optionPriceDiffers = optionPriceDiffers === true || new Set(prices).size > 1;
        }
        continue;
      }
      let field = nameKeys.has(normalized) ? 'name' : imageKeys.has(normalized) ? 'image' : originalKeys.has(normalized) ? 'original' : saleKeys.has(normalized) ? 'sale' : null;
      if ((key === 'name' || key === 'title') && ownProduct) field = 'name';
      if (key === 'image' && productContext) field = 'image';
      if (key === 'price' && productContext && !/AggregateOffer|aggregateoffer/i.test(typeText + path)) field = /ListPrice|OriginalPrice|RegularPrice/i.test(context) ? 'original' : 'sale';
      if (/couponprice|unitprice|deliveryprice|shippingprice|benefitprice|memberprice|priceper/i.test(normalized)) field = 'sale';
      if (field) {
        if (field === 'image' && Array.isArray(raw)) {
          raw.slice(0, 6).forEach((image, index) => {
            const imageValue = typeof image === 'string' ? image : image && Object.getOwnPropertyDescriptor(image, 'url')?.value;
            add(field, imageValue, kind, `${location}[${index}]`, identity, context);
          });
        } else if (field === 'image' && raw && typeof raw === 'object') {
          add(field, Object.getOwnPropertyDescriptor(raw, 'url')?.value, kind, location + '["url"]', identity, context);
        } else add(field, raw, kind, location, identity, context);
      }
      if (raw && typeof raw === 'object') walk(raw, location, kind, {identity, product:productContext, depth:(inherited.depth || 0) + 1, context});
    }
  }
  function assignedJson(text, name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`(?:window\\.|self\\.|(?:var|let|const)\\s+)?${escaped}\\s*=\\s*([\\[{])`).exec(text);
    if (!match) return null;
    const start = match.index + match[0].length - 1;
    let depth = 0, quoted = false, escapedChar = false;
    for (let index = start; index < text.length; index++) {
      const char = text[index];
      if (quoted) { if (escapedChar) escapedChar = false; else if (char === '\\') escapedChar = true; else if (char === '"') quoted = false; continue; }
      if (char === '"') quoted = true;
      else if (char === '{' || char === '[') depth++;
      else if ((char === '}' || char === ']') && --depth === 0) return JSON.parse(text.slice(start, index + 1));
    }
    return null;
  }
  const scripts = [...document.querySelectorAll('script:not([src])')];
  scripts.forEach((script, index) => {
    const text = script.textContent || '', type = (script.type || '').toLowerCase();
    if (text.length > 3000000 || scriptBytes + text.length > 10000000) { sources.push({kind:'page-json', location:`script[${index}]`, status:'skipped-size-limit'}); truncated = true; return; }
    scriptBytes += text.length;
    if (/^application\/(?:ld\+json|json)(?:;|$)/.test(type) || script.id === '__NEXT_DATA__') {
      const kind = type.includes('ld+json') ? 'json-ld' : 'page-json';
      const location = `script[${index}]${script.id ? '#' + script.id : ''}`;
      try { walk(JSON.parse(text), location + '$', kind); sources.push({kind, location, status:'parsed'}); }
      catch { sources.push({kind, location, status:'invalid-json'}); }
    } else {
      for (const name of config.globals) {
        if (!text.includes(name)) continue;
        const location = `script[${index}] assignment:${name}`;
        try {
          const value = assignedJson(text, name);
          if (value) { walk(value, location + '$', 'page-json'); sources.push({kind:'page-json', location, status:'parsed-json-assignment'}); }
          else sources.push({kind:'page-json', location, status:'not-a-json-literal'});
        } catch { sources.push({kind:'page-json', location, status:'not-a-json-literal'}); }
      }
    }
  });
  for (const name of config.globals) {
    const location = `window.${name}`;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(window, name);
      if (!descriptor) { sources.push({kind:'window', location, status:'absent'}); continue; }
      if (!('value' in descriptor)) { sources.push({kind:'window', location, status:'getter-not-executed'}); continue; }
      if (!descriptor.value || typeof descriptor.value !== 'object') { sources.push({kind:'window', location, status:'not-an-object'}); continue; }
      walk(descriptor.value, location + '$', 'window');
      sources.push({kind:'window', location, status:'inspected'});
    } catch { sources.push({kind:'window', location, status:'unreadable'}); }
  }
  return {candidates, rejected, sources, truncated, optionPriceDiffers, skippedBranches, inspectedNodes:nodes,
    limits:'알려진 변수의 데이터 속성과 JSON 리터럴만 검사. getter·함수·실행 코드·Next Flight 스트림은 실행하거나 해석하지 않음. 원본 JSON과 전체 window는 내보내지 않음.'};
};
