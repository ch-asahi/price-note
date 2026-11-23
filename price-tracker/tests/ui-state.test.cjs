// 실제 브라우저 배치를 대체하지 않는 DOM 모의 상태 전이 검사.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
class Node {
 constructor(document){this.document=document;this.style={};this.events={};this.hidden=false;this.value='';this.checked=false;this.children=[];this.dataset={};this.classList={toggle(){}};}
 set innerHTML(text){this.html=text;for(const match of text.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)){const node=new Node(this.document);node.hidden=/\bhidden(?:\s|>)/.test(match[0]);this.document.nodes[match[1]]=node;}}
 get innerHTML(){return this.html||'';}
 getElementById(id){return this.document.nodes[id]||null;}
 attachShadow(){const document={nodes:{}};this.shadow=new Node(document);return this.shadow;}
 addEventListener(type,fn){(this.events[type] ||= []).push(fn);}
 removeEventListener(){}
 setAttribute(){}
 querySelectorAll(){return [];}
 append(node){this.children.push(node);}
 replaceChildren(){this.children=[];}
 click(){if(this.document.failDownload)throw new Error('다운로드 요청 실패');}
 async fire(type){for(const fn of this.events[type]||[])await fn({preventDefault(){},composedPath:()=>[]});}
}
function documentStub(){const document={nodes:{},activeElement:null,addEventListener(){},removeEventListener(){},getElementById(id){return this.nodes[id]||null;},createElement(){return new Node(document);},querySelectorAll(){return [];},querySelector(){return null;}};document.body=new Node(document);document.documentElement=new Node(document);return document;}
function load(sandbox,file){vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox);}
async function dashboard(){
 const document=documentStub();new Node(document).innerHTML=fs.readFileSync(path.join(root,'app.html'),'utf8');
 class DownloadURL extends URL {static createObjectURL(){return 'blob:test';}static revokeObjectURL(){}}
 const sandbox={document,location:{search:'?demo=1'},URLSearchParams,URL:DownloadURL,Blob,Intl,Date,structuredClone,console,setTimeout(fn,delay){if(delay===10000)return 0;return setTimeout(fn,delay);},clearTimeout,setInterval(){}};vm.createContext(sandbox);
 for(const file of ['lib/core.js','lib/csv.js','lib/chart.js','app.js'])load(sandbox,file);
 await vm.runInContext('refresh()',sandbox);
 assert.equal(document.nodes.settings.hidden,true);assert.equal(document.nodes.homeView.hidden,false);
 assert.equal(document.nodes.backupNotice.hidden,false);
 document.failDownload=true;
 await document.nodes.export.fire('click');
 assert.equal(document.nodes.backupNotice.hidden,false);
 assert.equal(vm.runInContext('demoState.lastCsvExportAt',sandbox),undefined);
 document.failDownload=false;
 await document.nodes.export.fire('click');
 assert.equal(document.nodes.backupNotice.hidden,true);
 await vm.runInContext("demoState.lastCsvExportAt=new Date(Date.now()-7*PriceCore.DAY).toISOString();refresh()",sandbox);
 assert.equal(document.nodes.backupNotice.hidden,false);
 console.log('PASS backup notice appears, clears after export, and returns after seven days');
 await document.nodes.settingsToggle.fire('click');assert.equal(document.nodes.settings.hidden,false);assert.equal(document.nodes.homeView.hidden,true);
 await document.nodes.settingsToggle.fire('click');assert.equal(document.nodes.settings.hidden,true);assert.equal(document.nodes.homeView.hidden,false);
 const html=document.nodes.detail.innerHTML;
 assert.equal((html.match(/class="badge(?: |")/g)||[]).length,1);assert.ok(html.includes('쇼핑몰 표시 할인율'));assert.ok(html.includes('<summary>상세 정보</summary>'));
 console.log('PASS home/settings navigation and one judgment badge with secondary detail information');
}
async function productPage(mode){
 const document=documentStub(),rootNode=new Node(document),timers=new Map(),messages=[];let timerId=0;
 document.querySelector=()=>rootNode;
 const sandbox={document,location:{href:'https://www.musinsa.com/products/1'},URL,Intl,Date,structuredClone,console,Element:Node,setInterval(){},clearTimeout:id=>timers.delete(id),setTimeout(fn,delay){const id=++timerId;if(delay===700)fn();else timers.set(id,{fn,delay});return id;}};
 vm.createContext(sandbox);load(sandbox,'lib/core.js');load(sandbox,'readers/dom.js');load(sandbox,'readers/musinsa.js');
 const target=sandbox.PriceCore.parseProduct(sandbox.location.href),date=sandbox.PriceCore.today();
 const product={...target,name:'상품',imageUrl:'',config:{publicConfirmed:true,optionMode:'none',firstOptionLabel:'',selectors:{}},records:{[date]:{date,source:'auto',sale:10000,original:12000}}};
 sandbox.PriceEvents={read:()=> '무진장'};
 sandbox.chrome={runtime:{async sendMessage(message){messages.push(message);if(message.type==='PAGE_CONTEXT')return {ok:true,data:{target,product,profile:{}}};if(message.type==='PAGE_HIDDEN'){if(mode==='error')throw new Error('읽기 실패');const value=mode==='jump'?15000:10000;return {ok:true,data:{sources:[],candidates:[{field:'name',value:'상품',method:'hidden',kind:'meta',location:'meta-name'},...(mode==='missing'?[]:[{field:'sale',value,method:'hidden',kind:'meta',location:'meta-price'}])]}};}if(message.type==='AUTO_RECORD')return {ok:true,data:mode==='normal'?{saved:true}:{saved:false,reason:mode==='jump'?'이전 기록 대비 30% 이상 변동':'판매가를 읽지 못했습니다.'}};return {ok:true,data:true};}}};
 load(sandbox,'content.js');
 const timer=[...timers.values()].find(x=>x.delay===1200);assert.ok(timer);await timer.fn();
 const shadow=document.documentElement.children[0].shadow;
 if(mode==='normal'){
  assert.equal(shadow.getElementById('panel').style.display,'none');assert.equal(shadow.getElementById('toast').style.display,'block');
  const toast=[...timers.values()].find(x=>x.delay===2500);assert.ok(toast);toast.fn();assert.equal(shadow.getElementById('toast').style.display,'none');
  await [...timers.values()].find(x=>x.delay===5000).fn();assert.equal(shadow.getElementById('toast').style.display,'none');
  assert.equal(messages.find(x=>x.type==='AUTO_RECORD').payload.evidence.eventName,'무진장');
 }else{assert.equal(shadow.getElementById('panel').style.display,'block');assert.notEqual(shadow.getElementById('toast').style.display,'block');}
 console.log(`PASS product panel state: ${mode}`);
}
(async()=>{await dashboard();for(const mode of ['normal','missing','jump','error'])await productPage(mode);})().catch(error=>{console.error(error);process.exitCode=1;});
