(() => {
  if(globalThis.__priceNotebookLoaded)return;
  globalThis.__priceNotebookLoaded=true;
  const send=async(type,payload={})=>{const response=await chrome.runtime.sendMessage({type,payload});if(!response?.ok)throw new Error(response?.error||'확장 프로그램을 다시 로드한 뒤 페이지도 새로고침하세요.');return response.data;};
  let target=null,ctx=null,lastRead=null,busy=false,picking=false,panelOpen=false,host,shadow,button,panel,lastKey='',debounce,visitStarted=Date.now(),toastTimer,toastShownKey='',attentionShown=new Set();
  const clean=PriceReaderDOM.clean;
  const status=text=>{if(shadow?.getElementById('status'))shadow.getElementById('status').textContent=text;};
  const input=id=>shadow.getElementById(id);
  function showSuccess(force=false){
    if(panelOpen&&!force)return;
    panelOpen=false;panel.style.display='none';button.textContent='가격노트';
    const key=target.key+':'+PriceCore.today();
    if(!force&&toastShownKey===key)return;
    toastShownKey=key;clearTimeout(toastTimer);
    input('toast').textContent='오늘 기록 완료';input('toast').style.display='block';
    toastTimer=setTimeout(()=>{if(input('toast'))input('toast').style.display='none';},2500);
  }
  function loginState(){
    const visible=selector=>[...document.querySelectorAll(selector)].some(PriceReaderDOM.visible);
    const loggedIn=visible('a[href*="logout"], a[href*="log-out"]');
    const loggedOut=visible('a[href*="/login"], a[href*="/log-in"]');
    return loggedIn&&!loggedOut?'loggedIn':loggedOut&&!loggedIn?'loggedOut':'unknown';
  }
  function optionEvidence(config,profile){
    let label='',verified=false;
    const root=document.querySelector('main')||document.body;
    const selects=[...root.querySelectorAll('select')].filter(PriceReaderDOM.visible).filter(el=>el.options.length>1 && !/정렬|sort|수량|quantity/i.test((el.name||'')+' '+(el.id||'')));
    if(selects.length){
      const groups=selects.map(el=>{
        const options=[...el.options].filter(x=>x.value && !/선택.*(?:하세요|해주세요)|선택$/.test(clean(x.text)));
        return {first:options[0],current:el.selectedOptions[0]};
      });
      label=groups.map(x=>clean(x.current?.text)).join(' / ');
      verified=groups.every(x=>x.first && !x.first.disabled && !/품절|sold\s*out/i.test(x.first.text) && x.current===x.first);
    }
    if(profile.option){
      try{
        const matches=[...document.querySelectorAll(profile.option.selector)].filter(PriceReaderDOM.visible);
        if(matches.length===1){label=clean(matches[0].tagName==='SELECT'?matches[0].selectedOptions[0]?.text:matches[0].innerText);verified=!!config?.firstOptionLabel && label===config.firstOptionLabel;}
      }catch{/* 위치가 바뀌면 확인 불가로 둔다. */}
    }
    if(config?.firstOptionLabel && label!==config.firstOptionLabel)verified=false;
    return {label,firstOptionVerified:verified};
  }
  async function collect(){
    const page=PriceCore.parseProduct(location.href);if(!page||page.key!==target?.key)throw new Error('상품 페이지가 바뀌었습니다.');
    const context=await send('PAGE_CONTEXT');
    const hidden=await send('PAGE_HIDDEN');
    if(!hidden)throw new Error('페이지 데이터를 받지 못했습니다.');
    let selected=PriceReaderDOM.resolveHidden(hidden);
    const profile={...context.profile};
    if(context.product?.config.optionMode==='different') {
      selected.sale=null;
      if(profile.sale)profile.sale={...profile.sale,overrideHidden:true};
    }
    const mapped=PriceReaderDOM.readMappings(profile,selected);selected=mapped.selected;
    if(selected.name)selected.name.value=selected.name.value.replace(/\s*-\s*사이즈\s*&\s*후기\s*\|\s*무신사.*$|\s*\|\s*(?:올리브영|무신사).*$/,'').trim();
    const options=optionEvidence(context.product?.config,context.profile);
    let anchor=null;
    try{if(profile.sale)anchor=[...document.querySelectorAll(profile.sale.selector)].find(PriceReaderDOM.visible)||null;}catch{/* 구조 변경이면 메인 영역에서 행사 문구를 확인한다. */}
    const eventName=PriceEvents.read(PriceReaderSites[page.site],anchor);
    if(PriceCore.parseProduct(location.href)?.key!==page.key)throw new Error('읽는 중 상품이 바뀌었습니다.');
    return {context,selected,optionLabel:options.label,evidence:{sale:selected.sale?.value||null,saleMethod:selected.sale?.method,original:selected.original?.value??null,eventName,optionPriceDiffers:hidden.optionPriceDiffers,firstOptionVerified:options.firstOptionVerified,loginState:loginState(),method:['sale','original'].map(field=>`${field}:${selected[field]?.method||'none'}/${selected[field]?.kind||'none'}`).join(';')},warnings:mapped.errors.filter(x=>x.field!=='original'),diagnostics:{sources:hidden.sources,truncated:hidden.truncated,skippedBranches:hidden.skippedBranches}};
  }
  function mount(){
    host=document.createElement('div');host.id='__price_notebook__';shadow=host.attachShadow({mode:'open'});
    shadow.innerHTML=`<style>
      :host{all:initial;font:15px/1.6 system-ui,sans-serif;color:#182336}*{box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer;border:0;border-radius:9px;padding:10px 14px;background:#126b58;color:white}button:disabled{opacity:.5;cursor:wait}.secondary{background:#e9f2ef;color:#155346}.bubble{position:fixed;right:22px;bottom:22px;z-index:2147483645;box-shadow:0 5px 24px #102f3833;font-weight:700}.panel{display:none;position:fixed;right:18px;bottom:76px;width:390px;max-width:calc(100vw - 24px);max-height:78vh;overflow:auto;background:#fff;padding:20px;border:1px solid #d6e3df;border-radius:16px;box-shadow:0 10px 44px #102f3833;z-index:2147483645}.head{display:flex;justify-content:space-between;align-items:center}h2{font-size:20px;margin:0}p{margin:10px 0}label{display:block;margin:10px 0}input,select{display:block;width:100%;padding:8px;border:1px solid #aabdb6;border-radius:6px;color:#182336;background:white}.check{display:flex;gap:8px;align-items:flex-start}.check input{width:19px;height:19px;flex:0 0 19px;margin:3px 0}small{font-size:13px;color:#566d65}.row{display:flex;gap:6px;flex-wrap:wrap}.pick{padding:6px 9px;background:#edf3f1;color:#224d41;font-size:14px}.hint{padding:10px;background:#f0f6f3;border-radius:8px}.status{white-space:pre-wrap;font-size:14px;color:#315b4c}.picker{display:none;position:fixed;right:16px;top:16px;max-width:360px;padding:16px;background:#172d28;color:#fff;z-index:2147483647;border-radius:12px}.outline{position:fixed;pointer-events:none;border:3px solid #16a880;z-index:2147483646;display:none}
      .toast{display:none;position:fixed;right:22px;bottom:80px;z-index:2147483646;border-radius:10px;padding:12px 20px;background:#163c30;color:#fff;box-shadow:0 5px 24px #102f3833;pointer-events:none}
      </style><button class="bubble" id="bubble">가격 추적 시작</button><div id="toast" class="toast" role="status"></div>
      <section class="panel" id="panel"><div class="head"><h2>가격노트</h2><button class="secondary" id="close">닫기</button></div>
      <p class="hint">쿠폰·회원등급·카드 할인을 뺀 공통 판매가를 기록합니다. 정가 미표시는 비워두세요.</p>
      <button class="secondary" id="reread">현재 가격 다시 읽기</button><p id="status" class="status" role="status"></p>
      <form id="form"><label>상품명<input id="name" maxlength="300" required></label><input id="image" type="hidden">
      <div class="row"><button type="button" class="pick" data-pick="name">상품명 지정</button><button type="button" class="pick" data-pick="image">이미지 지정</button></div>
      <label>정가 (원 · 미표시는 비워두기)<input id="original" type="number" min="1" max="1000000000" step="1"></label>
      <label>판매가 (원)<input id="sale" type="number" min="1" max="1000000000" step="1" required></label>
      <label>행사명 (못 읽으면 빈칸)<input id="eventName" maxlength="120"></label>
      <div class="row"><button type="button" class="pick" data-pick="original">정가 위치 지정</button><button type="button" class="pick" data-pick="sale">판매가 위치 지정</button></div>
      <label>옵션 가격<select id="optionMode" required><option value="unknown">선택하세요</option><option value="none">옵션 없음</option><option value="same">옵션별 가격 같음</option><option value="different">옵션 가격 다름</option></select></label>
      <label>첫 번째 옵션 이름<input id="optionLabel" maxlength="250" placeholder="가격이 다른 경우 필수"></label>
      <button type="button" class="pick" data-pick="option">현재 선택한 옵션명 위치 지정</button>
      <p><small>옵션 가격이 다르면 첫 번째 옵션을 직접 선택하세요. 자동 기록 때 옵션을 확인하지 못하면 보류합니다. 확장 프로그램이 옵션을 자동 클릭하지 않습니다.</small></p>
      <label>현재 로그인 상태<select id="login"><option value="unknown">미확인</option><option value="loggedOut">비로그인</option><option value="loggedIn">로그인</option></select></label>
      <label class="check"><input id="public" type="checkbox" required> 쿠폰·등급·카드 할인을 제외한 공통 판매가입니다</label>
      <label class="check"><input id="first" type="checkbox"> 옵션 가격이 다르면 첫 번째 옵션 가격임을 확인했습니다</label>
      <button id="save" type="submit">가격 추적 시작</button><p><small>기록은 하루 한 건이며 같은 날에는 마지막 값으로 바뀝니다. 방문하지 않은 날짜는 빈칸입니다.</small></p></form></section>
      <div class="picker" id="picker"><p id="pickMessage"></p><button id="cancelPick">취소 (Esc)</button></div><div class="outline" id="outline"></div>`;
    document.documentElement.append(host);button=input('bubble');panel=input('panel');
    button.addEventListener('click',()=>openPanel().catch(error=>status(error.message)));
    input('close').addEventListener('click',()=>{panelOpen=false;panel.style.display='none';});
    input('reread').addEventListener('click',()=>readForPanel().catch(error=>status(error.message)));
    input('form').addEventListener('submit',event=>{event.preventDefault();saveForm().catch(error=>status(error.message));});
    for(const pick of shadow.querySelectorAll('[data-pick]'))pick.addEventListener('click',()=>startPick(pick.dataset.pick));
  }
  function fillPanel(read){
      lastRead=read;ctx=lastRead.context;
      input('name').value=lastRead.selected.name?.value||ctx.product?.name||'';input('image').value=lastRead.selected.image?.value||ctx.product?.imageUrl||'';
      input('original').value=lastRead.evidence.original??'';input('sale').value=lastRead.evidence.sale??'';
      input('eventName').value=lastRead.evidence.eventName||'';
      input('login').value=lastRead.evidence.loginState;
      const config=ctx.product?.config;
      input('optionMode').value=config?.optionMode || (lastRead.evidence.optionPriceDiffers===true?'different':'unknown');
      input('optionLabel').value=config?.firstOptionLabel||lastRead.optionLabel||'';
      input('public').checked=!!config?.publicConfirmed;
      input('first').checked=!!lastRead.evidence.firstOptionVerified;
      input('save').textContent=ctx.product?'오늘 가격 직접 기록 / 기준 저장':'등록하고 오늘 가격 기록';
      status([lastRead.evidence.optionPriceDiffers===true?'옵션 가격 다름':'',lastRead.warnings.map(x=>x.message).join('\n'),'화면 가격과 비교하고 아래 기준을 확인하세요.'].filter(Boolean).join('\n'));
  }
  async function readForPanel(){
    status('상품 데이터를 읽고 있습니다…');input('reread').disabled=true;
    try{fillPanel(await collect());}
    catch(error){
      const context=await send('PAGE_CONTEXT');
      fillPanel({context,selected:{},evidence:{sale:null,original:null,loginState:loginState(),eventName:''},warnings:[],optionLabel:''});
      status(error.message+' 가격을 직접 입력할 수 있습니다.');
    }finally{input('reread').disabled=false;}
  }
  async function revealAttention(reason,read=null){
    if(panelOpen){status(reason);return;}
    const key=target.key+':'+reason;if(attentionShown.has(key))return;
    attentionShown.add(key);panelOpen=true;panel.style.display='block';
    if(read)fillPanel(read);else await readForPanel();
    status(reason);
  }
  async function openPanel(){panelOpen=true;panel.style.display='block';await readForPanel();}
  async function saveForm(){
    input('save').disabled=true;
    try{
      const config={publicConfirmed:input('public').checked,optionMode:input('optionMode').value,firstOptionLabel:clean(input('optionLabel').value),selectors:{...ctx.profile}};
      if(config.optionMode==='unknown')throw new Error('옵션 가격 여부를 선택하세요.');
      if(config.optionMode==='different'&&!input('first').checked)throw new Error('첫 번째 옵션의 가격인지 확인하세요.');
      const payload={key:ctx.target.key,name:input('name').value,imageUrl:input('image').value,original:input('original').value,sale:input('sale').value,eventName:input('eventName').value,config,publicConfirmed:input('public').checked,firstOptionConfirmed:input('first').checked,loginState:input('login').value};
      if(ctx.product){
        // 자동 기록용 기준은 직접 입력값과 별개로 저장한다.
        await send('PAGE_CONFIGURE',{key:payload.key,config});await send('MANUAL_RECORD',payload);
      }else await send('REGISTER',payload);
      ctx=await send('PAGE_CONTEXT');showSuccess(true);
    }finally{input('save').disabled=false;}
  }
  function startPick(field){
    if(picking)return;picking=true;panel.style.display='none';
    const expectedKey=ctx.target.key,picker=input('picker'),outline=input('outline');picker.style.display='block';
    const labels={name:'상품명',image:'대표 이미지',original:'정가',sale:'판매가',option:'현재 선택한 첫 번째 옵션 이름'};
    input('pickMessage').textContent=`${labels[field]} 영역을 클릭하세요. 정가가 없으면 취소하고 정가 칸을 비워두세요.`;
    const own=event=>event.composedPath().includes(host);
    const cancel=()=>{document.removeEventListener('click',click,true);document.removeEventListener('mousemove',hover,true);document.removeEventListener('keydown',key,true);input('cancelPick').removeEventListener('click',cancel);picker.style.display='none';outline.style.display='none';panel.style.display='block';picking=false;};
    const key=event=>{if(event.key==='Escape'){event.preventDefault();cancel();}};
    const hover=event=>{if(own(event)||!(event.target instanceof Element))return;const rect=event.target.getBoundingClientRect();Object.assign(outline.style,{display:'block',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});};
    let saving=false;
    const click=async event=>{
      if(own(event))return;event.preventDefault();event.stopImmediatePropagation();if(saving)return;saving=true;
      try{
        let read=field==='option'?{value:clean(event.target.tagName==='SELECT'?event.target.selectedOptions[0]?.text:event.target.innerText),element:event.target}:PriceReaderDOM.readElement(event.target,field);
        if(!read.value||String(read.value).length>2000||(field==='option'&&String(read.value).length>250))throw new Error('항목 하나만 있는 작은 영역을 선택하세요.');
        const selector=PriceReaderDOM.selectorFor(read.element),other=ctx.profile[field==='original'?'sale':'original'];
        if(['original','sale'].includes(field)&&other&&(other.selector===selector||document.querySelector(other.selector)===read.element))throw new Error('정가와 판매가는 같은 요소로 지정하지 마세요.');
        await send('SELECTOR',{key:expectedKey,field,mapping:{selector,tag:read.element.tagName,overrideHidden:true}});
        if(field==='option')input('optionLabel').value=read.value;else input(field).value=read.value;
        ctx=await send('PAGE_CONTEXT');cancel();status('위치를 저장했습니다. 가격·옵션 기준을 확인하고 아래 저장 버튼을 누르세요.');
      }catch(error){input('pickMessage').textContent=error.message;}finally{saving=false;}
    };
    input('cancelPick').addEventListener('click',cancel);document.addEventListener('click',click,true);document.addEventListener('mousemove',hover,true);document.addEventListener('keydown',key,true);
  }
  async function autoRecord(){
    if(busy||panelOpen||picking||!target)return;
    busy=true;
    const key=target.key;
    let read=null;
    try{
      const context=await send('PAGE_CONTEXT');if(!context.product){button.textContent='가격 추적 시작';return;}
      const currentRecord=context.product.records[PriceCore.today()];
      if(currentRecord && currentRecord.source!=='auto' && Date.parse(currentRecord.recordedAt)>=visitStarted){button.textContent='가격노트';return;}
      read=await collect();await new Promise(resolve=>setTimeout(resolve,700));
      const second=await collect();
      if(target?.key!==key||panelOpen||picking)return;
      if(read.evidence.sale!==second.evidence.sale||read.evidence.original!==second.evidence.original)throw new Error('가격 표시가 바뀌는 중입니다. 잠시 뒤 다시 확인하세요.');
      read=second;
      const result=await send('AUTO_RECORD',{key,evidence:read.evidence});
      button.textContent=result.saved?'가격노트':'가격 확인 필요 · 가격노트';
      if(result.saved)showSuccess();else await revealAttention(result.reason,read);
    }catch(error){
      if(target?.key===key){button.textContent='가격 읽기 실패 · 직접 입력';send('PAGE_ERROR',{key,message:error.message}).catch(()=>{});await revealAttention(error.message,read).catch(()=>{});}
    }
    finally{busy=false;}
  }
  async function visit(){
    const current=PriceCore.parseProduct(location.href),key=current?.key||'';
    if(key===lastKey)return;lastKey=key;target=current;ctx=null;lastRead=null;panelOpen=false;visitStarted=Date.now();toastShownKey='';attentionShown.clear();clearTimeout(toastTimer);if(shadow?.getElementById('toast'))input('toast').style.display='none';
    if(!current){if(host)host.style.display='none';return;}
    if(!host)mount();host.style.display='block';panel.style.display='none';button.textContent='가격 추적 시작';
    setTimeout(()=>autoRecord(),1200);setTimeout(()=>autoRecord(),5000);
  }
  document.addEventListener('change',event=>{if(event.composedPath().includes(host))return;clearTimeout(debounce);debounce=setTimeout(autoRecord,1000);},true);
  document.addEventListener('click',event=>{if(picking||event.composedPath().includes(host)||!event.isTrusted||!(event.target instanceof Element))return;if(event.target.closest('button,[role="option"],[role="combobox"]')){clearTimeout(debounce);debounce=setTimeout(autoRecord,1000);}},true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')autoRecord();});
  setInterval(()=>visit().catch(()=>{}),1200);visit().catch(()=>{});
})();
