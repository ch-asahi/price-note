importScripts('lib/core.js','lib/csv.js','readers/musinsa.js','readers/oliveyoung.js','readers/hidden.js');
let mutationQueue=Promise.resolve();
const initial=()=>({version:1,products:{},profiles:{},settings:{reminderEnabled:true,hour:20},lastReminderDay:null});
const load=async()=> (await chrome.storage.local.get('priceNotebook')).priceNotebook || initial();
const mutate=fn=>{
  const operation=mutationQueue.then(async()=>{const state=await load();const result=await fn(state);await chrome.storage.local.set({priceNotebook:state});return result;});
  mutationQueue=operation.catch(()=>{});return operation;
};
const uiSender=sender=>sender.url?.split(/[?#]/)[0]===chrome.runtime.getURL('app.html');
const pageTarget=sender=>{
  const target=PriceCore.parseProduct(sender.url || '');
  if (!sender.tab || sender.frameId!==0 || !target) throw new Error('지원하는 상품 페이지에서만 실행할 수 있습니다.');
  return target;
};
function validateName(name){if(typeof name!=='string'||!name.trim()||name.length>300)throw new Error('상품명을 확인하세요.');return name.trim();}
function manualRecord(payload,product){
  if(payload.publicConfirmed!==true)throw new Error('쿠폰·등급·카드 할인을 제외한 가격인지 확인하세요.');
  if(product.config.optionMode==='different' && payload.firstOptionConfirmed!==true)throw new Error('첫 번째 옵션 가격인지 확인하세요.');
  return PriceCore.validateRecord({sale:payload.sale,original:payload.original,eventName:payload.eventName??product.records[PriceCore.today()]?.eventName??'',source:'manual',loginState:payload.loginState,optionName:product.config.firstOptionLabel,optionPriceDiffers:product.config.optionMode==='different',method:'manual'});
}
function withLoginObservation(product,record){
  product.loginObservations ||= {};
  if(record.loginState==='unknown')return;
  const opposite=record.loginState==='loggedIn'?'loggedOut':'loggedIn', prior=product.loginObservations[opposite];
  if(prior && prior.optionName===record.optionName && Math.abs(Date.parse(record.recordedAt)-Date.parse(prior.recordedAt))<=900000){record.loginPriceDiffers=prior.sale!==record.sale;record.loginComparison=record.loginPriceDiffers?'differenceObserved':'samePriceObserved';}
  product.loginObservations[record.loginState]={sale:record.sale,optionName:record.optionName,recordedAt:record.recordedAt};
}
async function route(message,sender){
  const {type,payload={}}=message || {};
  if(type==='PAGE_CONTEXT'){
    const target=pageTarget(sender),state=await load(),product=state.products[target.key] || null;
    return {target,product,profile:{...PriceReaderSites[target.site].defaults,...state.profiles[new URL(sender.url).hostname],...product?.config.selectors}};
  }
  if(type==='PAGE_HIDDEN'){
    const target=pageTarget(sender);
    const [response]=await chrome.scripting.executeScript({target:{tabId:sender.tab.id},world:'MAIN',func:scanPriceHidden,args:[PriceReaderSites[target.site],target.id]});
    return response.result;
  }
  if(type==='SELECTOR'){
    const target=pageTarget(sender),field=payload.field;
    if(payload.key && payload.key!==target.key)throw new Error('상품 페이지가 바뀌었습니다. 다시 읽으세요.');
    const config=PriceCore.normalizeConfig({selectors:{[field]:payload.mapping}});
    if(!config.selectors[field])throw new Error('위치 정보가 올바르지 않습니다.');
    return mutate(state=>{
      const host=new URL(sender.url).hostname;
      state.profiles[host] ||= {};state.profiles[host][field]=config.selectors[field];
      const product=state.products[target.key];if(product)product.config.selectors[field]=config.selectors[field];
      return true;
    });
  }
  if(type==='REGISTER'){
    const target=pageTarget(sender),config=PriceCore.normalizeConfig(payload.config);
    if(payload.key && payload.key!==target.key)throw new Error('상품 페이지가 바뀌었습니다. 다시 읽으세요.');
    if(!config.publicConfirmed||config.optionMode==='unknown')throw new Error('가격 기준과 옵션 여부를 확인하세요.');
    if(config.optionMode==='different'&&!config.firstOptionLabel)throw new Error('첫 번째 옵션 이름을 입력하세요.');
    return mutate(state=>{
      if(state.products[target.key])throw new Error('이미 등록한 상품입니다.');
      if(Object.keys(state.products).length>=PriceCore.MAX_PRODUCTS)throw new Error('등록 가능한 상품은 최대 50개입니다.');
      const product={...target,name:validateName(payload.name),imageUrl:/^https?:\/\//.test(payload.imageUrl||'')?String(payload.imageUrl).slice(0,2000):'',createdAt:new Date().toISOString(),config,records:{}};
      const record=manualRecord({...payload,firstOptionConfirmed:payload.firstOptionConfirmed},product);record.source='confirmed';
      withLoginObservation(product,record);PriceCore.putRecord(product,record);state.products[target.key]=product;return product;
    });
  }
  if(type==='AUTO_RECORD'){
    const target=pageTarget(sender);
    if(payload.key!==target.key)throw new Error('읽은 상품과 현재 페이지가 달라 저장하지 않았습니다.');
    return mutate(state=>{
      const product=state.products[target.key];if(!product)throw new Error('등록되지 않은 상품입니다.');
      const evidence=payload.evidence || {},reason=PriceCore.eligibility(product.config,evidence);
      if(reason){product.lastError={message:reason,at:new Date().toISOString()};return {saved:false,reason};}
      const previous=PriceCore.stats(product).current;
      const changes=PriceCore.priceChanges(previous,evidence);
      if(changes.length){
        const reason=changes.map(change=>`${change.field==='sale'?'판매가':'정가'} ${change.previous.toLocaleString('ko-KR')}원 → ${change.current.toLocaleString('ko-KR')}원`).join(' / ')+' · 이전 기록 대비 30% 이상 변동했습니다. 화면을 확인하고 저장하세요.';
        product.lastError={message:reason,at:new Date().toISOString()};return {saved:false,reason,requiresConfirmation:true};
      }
      const record=PriceCore.validateRecord({sale:evidence.sale,original:evidence.original,eventName:evidence.eventName,source:'auto',loginState:evidence.loginState,optionName:product.config.firstOptionLabel,optionPriceDiffers:evidence.optionPriceDiffers ?? (product.config.optionMode==='different'),method:evidence.method});
      withLoginObservation(product,record);PriceCore.putRecord(product,record);return {saved:true,record};
    });
  }
  if(type==='PAGE_ERROR'){
    const target=pageTarget(sender);if(payload.key&&payload.key!==target.key)return false;return mutate(state=>{if(state.products[target.key])state.products[target.key].lastError={message:String(payload.message||'읽기 실패').slice(0,500),at:new Date().toISOString()};return true;});
  }
  if(type==='PAGE_CONFIGURE'){
    const target=pageTarget(sender),config=PriceCore.normalizeConfig(payload.config);
    if(payload.key && payload.key!==target.key)throw new Error('상품 페이지가 바뀌었습니다. 다시 읽으세요.');
    if(!config.publicConfirmed||config.optionMode==='unknown')throw new Error('가격 기준을 확인하세요.');
    if(config.optionMode==='different'&&!config.firstOptionLabel)throw new Error('첫 번째 옵션 이름이 필요합니다.');
    return mutate(state=>{const product=state.products[target.key];if(!product)throw new Error('상품을 찾지 못했습니다.');product.config=config;return true;});
  }
  if(type==='MANUAL_RECORD'){
    const key=uiSender(sender)?payload.key:pageTarget(sender).key;
    if(!uiSender(sender)&&payload.key && payload.key!==key)throw new Error('상품 페이지가 바뀌었습니다. 다시 읽으세요.');
    return mutate(state=>{const product=state.products[key];if(!product)throw new Error('상품을 찾지 못했습니다.');const record=manualRecord(payload,product);withLoginObservation(product,record);PriceCore.putRecord(product,record);return record;});
  }
  if(!uiSender(sender))throw new Error('관리 화면에서 실행하세요.');
  if(type==='GET_STATE')return load();
  if(type==='CSV_EXPORTED')return mutate(state=>{state.lastCsvExportAt=new Date().toISOString();return true;});
  if(type==='REMOVE')return mutate(state=>{delete state.products[payload.key];return true;});
  if(type==='SAVE_SETTINGS'){
    const hour=Number(payload.hour);if(!Number.isInteger(hour)||hour<17||hour>23)throw new Error('저녁 알림은 17~23시 중 선택하세요.');
    await mutate(state=>{state.settings={hour,reminderEnabled:!!payload.reminderEnabled};return true;});await scheduleAlarm();return true;
  }
  if(type==='CONFIGURE')return mutate(state=>{const product=state.products[payload.key];if(!product)throw new Error('상품을 찾지 못했습니다.');const config=PriceCore.normalizeConfig(payload.config);if(!config.publicConfirmed||config.optionMode==='unknown')throw new Error('가격 기준을 확인하세요.');if(config.optionMode==='different'&&!config.firstOptionLabel)throw new Error('첫 번째 옵션 이름이 필요합니다.');product.config=config;return true;});
  if(type==='IMPORT'){
    const incoming=PriceCSV.parse(payload.text);
    return mutate(state=>{state.products=PriceCSV.merge(state.products,incoming);return {count:Object.keys(incoming).length};});
  }
  if(type==='OPEN_MISSING')return openMissing();
  if(type==='TEST_NOTIFICATION'){await notify(true);return true;}
  throw new Error('지원하지 않는 작업입니다.');
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  route(message,sender).then(data=>respond({ok:true,data})).catch(error=>respond({ok:false,error:error.message}));return true;
});
async function openMissing(){
  const state=await load(),date=PriceCore.today(),products=Object.values(state.products).filter(x=>!x.records[date]);
  for(const product of products){const target=PriceCore.parseProduct(product.url);if(target)await chrome.tabs.create({url:target.url,active:false});}
  return products.length;
}
let reminderQueue=Promise.resolve();
function notify(test=false){const result=reminderQueue.then(()=>sendReminder(test));reminderQueue=result.catch(()=>{});return result;}
async function sendReminder(test=false){
  const date=PriceCore.today(),state=await load();
  const missing=Object.values(state.products).filter(x=>!x.records[date]).length;
  if(!test&&(!state.settings.reminderEnabled||state.lastReminderDay===date||!missing))return;
  await chrome.notifications.create(test?'price-notebook-test':'price-notebook-evening',{type:'basic',iconUrl:'icons/icon128.png',title:test?'가격노트 알림 테스트':`오늘 기록 안 된 상품 ${missing}개`,message:test?'알림이 정상적으로 표시됩니다.':'상품을 열면 가격을 기록합니다. 옵션 확인이 필요한 상품은 페이지 안내를 확인하세요.',buttons:test?[]:[{title:'전부 열기'}],priority:0});
  if(!test)await mutate(current=>{current.lastReminderDay=date;return true;});
}
async function scheduleAlarm(){
  const state=await load();
  if(!state.settings.reminderEnabled){await chrome.alarms.clear('price-evening');return;}
  const now=new Date(),today=PriceCore.today(now),at=Date.parse(`${today}T${String(state.settings.hour).padStart(2,'0')}:00:00+09:00`);
  await chrome.alarms.create('price-evening',{when:at>Date.now()?at:at+PriceCore.DAY});
}
async function startup(){
  await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  await mutationQueue;
  const state=await load(),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
  if(hour>=state.settings.hour)await notify();
  await scheduleAlarm();
}
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='price-evening')notify().then(scheduleAlarm).catch(console.error);});
chrome.runtime.onInstalled.addListener(()=>startup().catch(console.error));
chrome.runtime.onStartup.addListener(()=>startup().catch(console.error));
chrome.notifications.onButtonClicked.addListener((id,index)=>{if(id==='price-notebook-evening'&&index===0)openMissing().then(()=>chrome.notifications.clear(id)).catch(console.error);});
chrome.notifications.onClicked.addListener(id=>{if(id==='price-notebook-evening')chrome.tabs.create({url:chrome.runtime.getURL('app.html')});});
startup().catch(console.error);
