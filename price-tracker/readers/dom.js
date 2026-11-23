(() => {
  globalThis.PriceReaderDOM?.cancelPick?.();
  const fields = ['name', 'image', 'original', 'sale'];
  const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const amounts = value => [...clean(value).matchAll(/(?:₩\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)|([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*원)/g)].map(match => Number((match[1] || match[2]).replaceAll(',', ''))).filter(x => Number.isSafeInteger(x) && x > 0);
  const blocked = text => /배송|운임|택배|쿠폰|카드|등급|최대\s*혜택|회원\s*(?:가|전용)|적립|포인트|추가금|할부|단위\s*가격|무료|\d+(?:\.\d+)?\s*(?:ml|kg|mg|g|l|개|매|정|포)\s*(?:당|기준)|(?:ml|kg|mg|g|l)\s*당|원\s*\//i.test(text);
  const visible = el => {
    if (!el || !el.getClientRects().length) return false;
    if (el.checkVisibility && !el.checkVisibility({checkOpacity:true, checkVisibilityCSS:true})) return false;
    for (let parent = el; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false;
    }
    return true;
  };
  const resolveHidden = hidden => Object.fromEntries(fields.map(field => {
    const all = hidden.candidates.filter(x => x.field === field);
    const matching = all.filter(x => x.productMatch === 'matched');
    if (field === 'image') {
      const primary = matching.find(x => x.kind === 'json-ld' && /\[0\]$/.test(x.location)) || all.find(x=>x.kind === 'meta');
      if (primary) return [field, primary];
    }
    const pool = matching.length ? matching : all;
    const values = [...new Set(pool.map(x=>x.value))];
    return [field, values.length === 1 ? {...pool[0], evidence:pool.map(x=>({kind:x.kind, location:x.location}))} : null];
  }));
  function readElement(el, field) {
    if (!visible(el)) throw new Error('선택한 요소가 현재 표시되지 않습니다.');
    if (field === 'image') {
      const image = el.tagName === 'IMG' ? el : el.querySelectorAll('img').length === 1 ? el.querySelector('img') : null;
      if (!image || !visible(image) || !image.naturalWidth) throw new Error('로드된 상품 이미지 자체를 클릭해 주세요.');
      const value = image.currentSrc || image.src;
      if (!/^https?:\/\//.test(value)) throw new Error('HTTP(S) 상품 이미지가 아닙니다.');
      return {value, element:image, context:clean(image.alt).slice(0,300)};
    }
    const text = clean(el.innerText);
    if (field === 'name') {
      if (!text || text.length > 250) throw new Error('상품명 텍스트만 있는 작은 영역을 클릭해 주세요.');
      return {value:text, element:el, context:text};
    }
    const contexts = [text, el.getAttribute('aria-label') || ''];
    if (el.previousElementSibling && /^(DT|LABEL)$/.test(el.previousElementSibling.tagName)) contexts.push(clean(el.previousElementSibling.innerText));
    // 동일한 금액만 든 짧은 행의 주변 라벨도 검사한다. 페이지 전체 문구로 판정하지 않는다.
    let parent = el.parentElement;
    for (let index = 0; parent && index < 2; index++, parent = parent.parentElement) {
      const context = clean(parent.innerText);
      if (context.length > 180 || new Set(amounts(context)).size > 1) break;
      contexts.push(context, parent.getAttribute('aria-label') || '');
    }
    const context = contexts.join(' | ');
    if (blocked(context)) throw new Error('단위 가격·배송비·쿠폰/회원 혜택·적립금은 가격으로 선택할 수 없습니다. 일반 상품 가격 숫자를 클릭해 주세요.');
    if (field === 'original') {
      let struck = !!el.closest?.('s, del');
      for (let node = el, depth = 0; node && depth < 3; node = node.parentElement, depth++) {
        if (/line-through/.test(getComputedStyle(node).textDecorationLine || '')) struck = true;
      }
      if (!struck && !/정가|정상가|소비자가|권장\s*가격|original\s*price|regular\s*price|list\s*price/i.test(context)) throw new Error('별도 정가라는 근거가 없습니다. 판매가를 정가로 대신 지정하지 마세요. 정가 미표시는 비워둡니다.');
    }
    let parsed = [...new Set(amounts(text))];
    if (!parsed.length && /^[\d,]+$/.test(text)) parsed = [Number(text.replaceAll(',', ''))];
    if (parsed.length !== 1 || !Number.isSafeInteger(parsed[0]) || parsed[0] <= 0 || text.length > 100) throw new Error('가격 한 개만 있는 숫자 영역을 클릭해 주세요.');
    return {value:parsed[0], element:el, context:text};
  }
  function selectorFor(el) {
    const parts = [];
    for (let current = el; current && current.nodeType === 1; current = current.parentElement) {
      if (current.id && !/\d{5,}|:/.test(current.id)) {
        const selector = '#' + CSS.escape(current.id) + (parts.length ? ' > ' + parts.join(' > ') : '');
        if (document.querySelectorAll(selector).length === 1) return selector;
      }
      let part = current.tagName.toLowerCase();
      const testId = current.getAttribute('data-testid');
      if (testId && !/\d{5,}/.test(testId)) part += `[data-testid="${CSS.escape(testId)}"]`;
      else if (current.parentElement) {
        const siblings = [...current.parentElement.children].filter(x=>x.tagName === current.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current)+1})`;
      }
      parts.unshift(part);
      const selector = parts.join(' > ');
      if (document.querySelectorAll(selector).length === 1) return selector;
    }
    throw new Error('이 요소의 고유 위치를 만들 수 없습니다. 다른 텍스트 영역을 선택해 주세요.');
  }
  function readMappings(mapping, selected) {
    const errors = [];
    for (const field of fields) {
      const saved = mapping[field];
      if (!saved || (selected[field] && !saved.overrideHidden)) continue;
      if (saved.overrideHidden) selected[field] = null;
      try {
        const matches = [...document.querySelectorAll(saved.selector)].filter(visible);
        if (matches.length !== 1) throw new Error('저장 위치가 없거나 여러 개입니다. 다시 지정해 주세요.');
        if (matches[0].tagName !== saved.tag) throw new Error('저장 위치의 요소 종류가 바뀌었습니다.');
        const result = readElement(matches[0], field);
        selected[field] = {field, value:result.value, method:'click', kind:'saved-selector', location:saved.selector, context:result.context, verified:false};
      } catch(error) { errors.push({field, message:error.message}); }
    }
    if (selected.original?.method === 'click' && selected.sale?.method === 'click' && selected.original.location === selected.sale.location) {
      selected.original = null;
      errors.push({field:'original',message:'정가와 판매가가 같은 요소를 가리켜 정가를 비웠습니다.'});
    }
    return {selected, errors};
  }
  globalThis.PriceReaderDOM = {fields, clean, amounts, blocked, visible, resolveHidden, readElement, selectorFor, readMappings};
})();
