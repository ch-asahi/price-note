const $=id=>document.getElementById(id);
const DEMO=new URLSearchParams(location.search).get('demo')==='1';
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const won=value=>value==null?'—':Math.round(value).toLocaleString('ko-KR')+'원';
let state,selectedKey=null,days=30,missingOnly=false,importText='';
function demoData(){
  const products={},date=PriceCore.today();
  const items=[['musinsa','5453617','수아레 데일리 헨리넥 니트 · 5 COLOR',59000,24400],['oliveyoung','A000001002386','에스트라 아토베리어365 크림 더블 기획',59400,44500],['musinsa','4735306','디스이즈네버댓 SP Backpack 29 Black',149000,134100]];
  items.forEach(([site,id,name,original,sale],number)=>{
    const target=PriceCore.parseProduct(site==='musinsa'?`https://www.musinsa.com/products/${id}`:`https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=${id}`);
    const product={...target,name,imageUrl:'',createdAt:new Date().toISOString(),config:{publicConfirmed:true,optionMode:'none',firstOptionLabel:'',selectors:{}},records:{}};
    for(let index=44;index>=0;index--){if(index===20||index===19||(number===1&&index===0))continue;const day=PriceCore.dateOffset(date,-index);product.records[day]={date:day,original,sale:number===0?(index<4?sale:Math.round((30900+(Math.sin(index/3)*1800))/100)*100):sale,eventName:index<4?(site==='musinsa'?'무진장':'올영세일'):'',recordedAt:day+'T03:00:00Z',source:'auto',loginState:'loggedOut',optionName:'',optionPriceDiffers:false,loginPriceDiffers:false,method:'hidden'};}
    products[target.key]=product;
  });
  return {version:1,products,profiles:{},settings:{reminderEnabled:true,hour:20}};
}
let demoState=DEMO?demoData():null;
async function send(type,payload={}){
  if(DEMO){
    if(type==='GET_STATE')return structuredClone(demoState);
    if(type==='CSV_EXPORTED'){demoState.lastCsvExportAt=new Date().toISOString();return true;}
    if(type==='REMOVE'){delete demoState.products[payload.key];return true;}
    if(type==='SAVE_SETTINGS'){demoState.settings=payload;return true;}
    if(type==='CONFIGURE'){demoState.products[payload.key].config=payload.config;return true;}
    if(type==='MANUAL_RECORD'){const product=demoState.products[payload.key];PriceCore.putRecord(product,PriceCore.validateRecord({...payload,source:'manual'}));return true;}
    if(type==='IMPORT'){demoState.products=PriceCSV.merge(demoState.products,PriceCSV.parse(payload.text));return true;}
    if(type==='OPEN_MISSING')return Object.values(demoState.products).filter(x=>!x.records[PriceCore.today()]).length;
    return true;
  }
  if(!globalThis.chrome?.runtime?.sendMessage)throw new Error('크롬 확장 프로그램으로 설치한 뒤 아이콘을 눌러 주세요.');
  const response=await chrome.runtime.sendMessage({type,payload});
  if(!response?.ok)throw new Error(response?.error||'저장에 실패했습니다. 확장 프로그램을 확인하세요.');
  return response.data;
}
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);}
async function refresh(){state=await send('GET_STATE');if(!state.products[selectedKey])selectedKey=Object.keys(state.products)[0]||null;render();}
function render(){
  renderBackup();
  const products=Object.values(state.products),date=PriceCore.today(),missing=products.filter(x=>!x.records[date]).length;
  $('todayLabel').textContent=date.replaceAll('-','.');
  $('allCount').textContent=products.length;$('missingCount').textContent=missing;
  $('progressCount').innerHTML=`${products.length-missing}<span> / ${products.length}</span>`;
  $('progressText').textContent=products.length?missing?`${missing}개 상품의 오늘 가격이 아직 비어 있어요.`:'모든 상품의 오늘 가격을 기록했어요.':'상품 페이지에서 “가격 추적 시작”을 눌러 보세요.';
  $('openMissing').disabled=!missing;$('export').disabled=!products.length;
  $('limitLabel').textContent=`${products.length} / 50개 · 이 PC에만 저장`;
  $('reminderEnabled').checked=state.settings.reminderEnabled;$('reminderHour').value=state.settings.hour;
  $('productList').replaceChildren();
  const query=$('search').value.trim().toLowerCase();
  const visible=products.filter(x=>(!missingOnly||!x.records[date])&&x.name.toLowerCase().includes(query));
  for(const product of visible){
    const summary=PriceCore.stats(product),button=document.createElement('button');
    button.className='product'+(product.key===selectedKey?' selected':'');button.setAttribute('aria-pressed',String(product.key===selectedKey));
    button.innerHTML=`<span class="mall">${product.site==='musinsa'?'MUSINSA':'OLIVE YOUNG'}</span><div class="product-name">${escapeHTML(product.name)}</div><div class="product-bottom"><strong class="product-price">${won(summary.current?.sale)}</strong><span class="record-status ${summary.recordedToday?'':'missing'}">${summary.recordedToday?'오늘 기록':'오늘 미기록'}</span></div>`;
    button.addEventListener('click',()=>{selectedKey=product.key;render();});$('productList').append(button);
  }
  if(!visible.length){const empty=document.createElement('p');empty.className='empty-list';empty.textContent=products.length?'조건에 맞는 상품이 없습니다.':'아직 등록된 상품이 없습니다.';$('productList').append(empty);}
  renderDetail();
}
function renderDetail(){
  const product=state.products[selectedKey];
  if(!product){$('detail').innerHTML='<section class="detail-card empty"><div class="mark">↗</div><h2>첫 가격을 기록해 보세요</h2><p>무신사·올리브영 상품을 크롬에서 연 뒤<br>오른쪽 아래 “가격 추적 시작”을 누르세요.</p><p class="small">서버·로그인 연결 없이, 내 PC에 최대 50개.<br>페이지를 방문하지 않은 날은 빈칸으로 남습니다.</p></section>';return;}
  const summary=PriceCore.stats(product),record=summary.current,config=product.config;
  const badges=[`<span class="badge ${summary.badge==='진짜 세일'?'sale':''}">${summary.badge}</span>`];
  const errors=product.lastError?`<p class="notice">${escapeHTML(product.lastError.message)}</p>`:'';
  $('detail').innerHTML=`<section class="detail-card"><div class="detail-title"><div><span class="eyebrow">${product.site==='musinsa'?'MUSINSA':'OLIVE YOUNG'}</span><h2>${escapeHTML(product.name)}</h2></div><button id="openProduct" class="link-button">상품 열기</button></div><div class="badges">${badges.join('')}</div>${errors}
    <div class="metrics"><div class="metric"><span>${summary.recordedToday?'현재가':'최근 기록가'}</span><strong>${won(record?.sale)}</strong></div><div class="metric"><span>쇼핑몰 표시 할인율</span><strong>${summary.discountRate==null?'—':summary.discountRate+'%'}</strong></div><div class="metric"><span>역대 최저가</span><strong>${won(summary.min)}</strong></div><div class="metric"><span>기록 평균가</span><strong>${won(summary.average)}</strong></div></div>
    <div class="chart-header"><h3>가격의 흐름</h3><div class="ranges">${[[30,'1개월'],[90,'3개월'],[365,'1년']].map(([number,label])=>`<button class="range ${days===number?'active':''}" data-days="${number}" aria-pressed="${days===number}">${label}</button>`).join('')}</div></div><div class="legend"><span>판매가</span><span>정가</span></div><div id="chart"></div>
    <p class="muted small">${summary.count}일 기록 · ${record?`최근 기록 ${record.date}`:'아직 가격 기록 없음'}<br>${summary.median90?`직전 90일 중앙값 ${won(summary.median90)} · `:''}기록이 없는 날은 선이 끊깁니다.</p>
    <div class="detail-actions"><button id="manualToggle" class="quiet">오늘 가격 직접 입력</button><button id="deleteProduct" class="danger">추적 삭제</button></div>
    <form id="manualForm" class="form-panel" hidden><h3>오늘 가격 보정</h3><label>정가 (미표시는 빈칸)<input id="manualOriginal" type="number" min="1" max="1000000000" step="1" value="${record?.original??''}"></label><label>판매가<input id="manualSale" type="number" min="1" max="1000000000" step="1" required value="${record?.sale??''}"></label><label>행사명<input id="manualEvent" maxlength="120" value="${escapeHTML(summary.recordedToday?record?.eventName||'':'')}"></label><label>현재 로그인 상태<select id="manualLogin"><option value="unknown">미확인</option><option value="loggedOut">비로그인</option><option value="loggedIn">로그인</option></select></label><label class="check"><input id="manualPublic" type="checkbox" required>쿠폰·등급·카드 할인을 제외한 공통 가격입니다</label>${config.optionMode==='different'?'<label class="check"><input id="manualFirst" type="checkbox" required>첫 번째 옵션 가격입니다</label>':''}<button type="submit">오늘 기록 저장</button><p class="muted small">오늘의 기존 기록은 이 값으로 바뀝니다.</p></form>
    <details><summary>상세 정보</summary><dl class="info-list"><dt>오늘 기록</dt><dd>${summary.recordedToday?'완료':'미기록'}</dd><dt>로그인 상태</dt><dd>${record?.loginState==='loggedOut'?'비로그인':record?.loginState==='loggedIn'?'로그인':'미확인'}</dd><dt>로그인 영향</dt><dd>${record?.loginPriceDiffers?'전후 가격 다름 (시간차 영향 가능)':record?.loginComparison==='samePriceObserved'?'전후 같은 가격 관측':'미확인'}</dd><dt>옵션 가격</dt><dd>${config.optionMode==='different'||record?.optionPriceDiffers?'옵션 가격 다름':'차이 미발견'}</dd><dt>기준 옵션</dt><dd>${escapeHTML(config.firstOptionLabel||'없음 / 미지정')}</dd><dt>행사명</dt><dd>${escapeHTML(record?.eventName||'—')}</dd><dt>표시 할인율</dt><dd>저장된 정가 대비 판매가로 계산한 값입니다. 정가 미표시는 —입니다.</dd></dl></details>
    <details><summary>기록과 판정 기준</summary><p class="muted small">서로 다른 날짜의 기록이 14개 미만이면 최저가·평균가는 —로 표시합니다. 판정도 수집 중이며, 14개부터 최근 기록일 직전 90일 중앙값보다 10% 이상 낮으면 진짜 세일, 그 외는 평소 가격입니다. 미기록 날짜는 통계에서 제외합니다. 방문하지 않은 날짜의 가격은 알 수 없습니다.</p><div id="recordTable"></div></details>
    <details><summary>상품의 가격·옵션 기준 변경</summary><form id="configForm"><label class="check"><input id="configPublic" type="checkbox" ${config.publicConfirmed?'checked':''} required>공통 판매가를 추적합니다</label><label>옵션 가격<select id="configMode"><option value="unknown">미확인</option><option value="none">옵션 없음</option><option value="same">옵션별 가격 같음</option><option value="different">옵션 가격 다름</option></select></label><label>첫 번째 옵션 이름<input id="configLabel" maxlength="250" value="${escapeHTML(config.firstOptionLabel)}"></label><button type="submit">기준 저장</button><p class="muted small">위치 지정은 상품 페이지의 가격노트 버튼에서 할 수 있습니다. 옵션 가격이 다른 경우 선택된 첫 번째 옵션을 확인할 수 있어야 자동 기록합니다.</p></form></details>
    <details><summary>저장한 이미지 주소</summary><p class="muted small">추가 요청을 보내지 않도록 상품 이미지를 새로 불러오지 않습니다.</p><p class="small" style="overflow-wrap:anywhere">${escapeHTML(product.imageUrl||'저장한 이미지 주소가 없습니다.')}</p></details></section>`;
  PriceChart.render($('chart'),product,days);
  $('configMode').value=config.optionMode;
  $('manualLogin').value=record?.loginState||'unknown';
  $('openProduct').addEventListener('click',()=>openProduct(product));
  for(const button of document.querySelectorAll('[data-days]'))button.addEventListener('click',()=>{days=Number(button.dataset.days);renderDetail();});
  $('manualToggle').addEventListener('click',()=>{$('manualForm').hidden=!$('manualForm').hidden;});
  $('deleteProduct').addEventListener('click',async()=>{if(!confirm('이 상품과 모든 가격 기록을 삭제할까요? 필요한 경우 CSV로 먼저 백업하세요.'))return;try{await send('REMOVE',{key:product.key});await refresh();message('추적을 삭제했습니다.');}catch(error){message(error.message,true);}});
  $('manualForm').addEventListener('submit',async event=>{event.preventDefault();try{await send('MANUAL_RECORD',{key:product.key,original:$('manualOriginal').value,sale:$('manualSale').value,eventName:$('manualEvent').value,loginState:$('manualLogin').value,publicConfirmed:$('manualPublic').checked,firstOptionConfirmed:$('manualFirst')?.checked||false});await refresh();message('오늘의 가격을 저장했습니다.');}catch(error){message(error.message,true);}});
  $('configForm').addEventListener('submit',async event=>{event.preventDefault();try{await send('CONFIGURE',{key:product.key,config:{...product.config,publicConfirmed:$('configPublic').checked,optionMode:$('configMode').value,firstOptionLabel:$('configLabel').value}});await refresh();message('가격 기준을 저장했습니다.');}catch(error){message(error.message,true);}});
  const rows=Object.values(product.records).sort((a,b)=>b.date.localeCompare(a.date));
  $('recordTable').innerHTML=`<table><thead><tr><th>날짜</th><th>정가</th><th>판매가</th><th>행사명</th><th>방법</th></tr></thead><tbody>${rows.slice(0,366).map(x=>`<tr><td>${x.date}</td><td>${won(x.original)}</td><td>${won(x.sale)}</td><td class="note">${escapeHTML(x.eventName||'')}</td><td class="note">${x.source==='auto'?'자동':x.source==='confirmed'?'등록 확인':'직접 입력'}</td></tr>`).join('')}</tbody></table>`;
}
function renderBackup(){if(state)$('backupNotice').hidden=!PriceCore.backupRecommended(state);}
setInterval(renderBackup,60000);
function openProduct(product){if(DEMO){message('예시 화면에서는 쇼핑몰을 열지 않습니다.');return;}chrome.tabs.create({url:product.url});}
$('search').addEventListener('input',()=>{if(state)render();});
for(const [id,missing] of [['filterAll',false],['filterMissing',true]])$(id).addEventListener('click',()=>{missingOnly=missing;$('filterAll').classList.toggle('active',!missing);$('filterMissing').classList.toggle('active',missing);if(state)render();});
$('openMissing').addEventListener('click',async()=>{try{const count=await send('OPEN_MISSING');message(DEMO?`예시: 미기록 ${count}개. 실제 탭은 열지 않았습니다.`:`오늘 미기록 상품 ${count}개를 열었습니다. 페이지에서 옵션 확인이 필요할 수 있습니다.`);}catch(error){message(error.message,true);}});
$('settingsToggle').addEventListener('click',()=>{const show=$('settings').hidden;$('settings').hidden=!show;$('homeView').hidden=show;$('settingsToggle').setAttribute('aria-expanded',String(show));$('settingsToggle').textContent=show?'돌아가기':'설정';});
$('settingsForm').addEventListener('submit',async event=>{event.preventDefault();try{await send('SAVE_SETTINGS',{hour:Number($('reminderHour').value),reminderEnabled:$('reminderEnabled').checked});await refresh();message('저녁 알림 설정을 저장했습니다.');}catch(error){message(error.message,true);}});
$('testNotification').addEventListener('click',async()=>{try{await send('TEST_NOTIFICATION');message(DEMO?'예시 화면에서는 실제 알림을 보내지 않습니다.':'알림을 보냈습니다. 보이지 않으면 Windows와 Chrome의 알림 설정을 확인하세요.');}catch(error){message(error.message,true);}});
$('full').addEventListener('click',()=>{if(DEMO)return;chrome.tabs.create({url:chrome.runtime.getURL('app.html')});});
$('export').addEventListener('click',async()=>{try{const csv=PriceCSV.encode(state.products),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),link=document.createElement('a');link.href=url;link.download=`가격노트-${DEMO?'예시-':''}${PriceCore.today()}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);await send('CSV_EXPORTED');await refresh();message('CSV 다운로드를 요청했습니다. 다운로드 폴더에 파일이 저장됐는지 확인하세요.');}catch(error){message(error.message,true);}});
$('import').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>18000000)throw new Error('18MB 이하의 CSV 파일을 선택하세요.');importText=await file.text();const products=PriceCSV.parse(importText);PriceCSV.merge(state.products,products);const count=Object.values(products).reduce((sum,x)=>sum+Object.keys(x.records).length,0);$('importSummary').textContent=`상품 ${Object.keys(products).length}개 · 가격 기록 ${count}건을 확인했습니다.`;$('importDialog').showModal();}catch(error){message(error.message,true);}finally{event.target.value='';}});
$('confirmImport').addEventListener('click',async()=>{try{await send('IMPORT',{text:importText});$('importDialog').close();importText='';await refresh();message('CSV 기록을 가져왔습니다.');}catch(error){message(error.message,true);}});
$('cancelImport').addEventListener('click',()=>{$('importDialog').close();importText='';});
$('demoBanner').hidden=!DEMO;
refresh().catch(error=>message(error.message,true));
if(!DEMO&&globalThis.chrome?.storage?.onChanged)chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.priceNotebook){if(!document.querySelector('#manualForm:not([hidden])')&&!document.activeElement?.closest('form'))refresh().catch(error=>message(error.message,true));}});
