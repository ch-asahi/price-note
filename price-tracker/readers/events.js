(() => {
  // 메타/상품명에서 추측하지 않고, 상품 영역의 표시된 행사 문구만 읽는다.
  function read(config, anchor=null){
    const excluded='header,nav,footer,aside,[class*="recommend" i],[class*="related" i],[class*="review" i],[class*="curation" i],[data-testid*="recommend" i],[data-testid*="related" i]';
    const root=document.querySelector('main')||document.body;
    const groups=[];
    if(anchor){
      let ancestor=anchor;
      for(let depth=0;ancestor&&depth<6;depth++,ancestor=ancestor.parentElement){
        if(ancestor===document.body||ancestor===document.documentElement)break;
        if(PriceReaderDOM.clean(ancestor.innerText).length>14000)break;
        groups.push(ancestor);
      }
    }
    if(!groups.length)groups.push(root);
    const names=[];
    const inspect=element=>{
      if(element.closest(excluded))return;
      const text=PriceReaderDOM.clean(element.innerText);
      if(!text||text.length>120||/^(H1|H2)$/.test(element.tagName))return;
      if(!(config.eventNames||[]).some(name=>text.includes(name))||!PriceReaderDOM.visible(element))return;
      for(const name of config.eventNames||[]){if(text.includes(name)&&!names.some(x=>x.includes(name)))names.push(name);}
    };
    for(const group of groups){
      for(const selector of config.eventSelectors||[])for(const element of group.querySelectorAll(selector))inspect(element);
      if(names.length)break;
    }
    // 표준 배지 선택자가 없는 구조는 가격 주변의 짧은 표시 문구만 제한적으로 확인한다.
    if(!names.length){
      const group=groups.at(-1);
      const elements=[...group.querySelectorAll('span,strong,em,p,a,button')].slice(0,1600);
      for(const element of elements)inspect(element);
    }
    return [...new Set(names)].slice(0,3).join(' · ').slice(0,120);
  }
  globalThis.PriceEvents={read};
})();
