const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
for(const file of ['lib/core.js','lib/csv.js','lib/chart.js'])vm.runInThisContext(fs.readFileSync(path.join(root,file),'utf8'));
const today=PriceCore.today(),config={publicConfirmed:true,optionMode:'none',firstOptionLabel:'',selectors:{}};
function product(id='1'){return {...PriceCore.parseProduct(`https://www.musinsa.com/products/${id}`),name:'테스트 상품',imageUrl:'',config:structuredClone(config),records:{},createdAt:new Date().toISOString()};}
const cases=[];function test(name,fn){fn();cases.push(name);console.log('PASS '+name);}
test('URL allowlist and canonicalization',()=>{
 assert.equal(PriceCore.parseProduct('https://www.musinsa.com/products/1?tracking=abc').url,'https://www.musinsa.com/products/1');
 assert.equal(PriceCore.parseProduct('https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=B000001006070').id,'B000001006070');
 for(const raw of ['https://www.musinsa.com.attacker.com/products/1','http://www.musinsa.com/products/1','javascript:alert(1)','https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=bad'])assert.equal(PriceCore.parseProduct(raw),null);
});
test('Korean day boundary and date validity',()=>{
 assert.equal(PriceCore.today(new Date('2026-11-22T15:00:00Z')),'2026-11-23');
 assert.equal(PriceCore.today(new Date('2026-11-22T14:59:59Z')),'2026-11-22');
 assert.equal(PriceCore.validDate('2026-02-30'),false);assert.equal(PriceCore.validDate('2024-02-29'),true);
});
test('One daily record with latest timestamp; missing original stays null',()=>{
 const p=product(),date=PriceCore.dateOffset(today,-1);PriceCore.putRecord(p,PriceCore.validateRecord({date,sale:10000,original:null,recordedAt:date+'T00:00:00+09:00'}));
 PriceCore.putRecord(p,PriceCore.validateRecord({date,sale:9000,original:null,recordedAt:date+'T01:00:00+09:00'}));
 PriceCore.putRecord(p,PriceCore.validateRecord({date,sale:11000,original:12000,recordedAt:date+'T00:30:00+09:00'}));
 assert.equal(Object.keys(p.records).length,1);assert.equal(p.records[date].sale,9000);assert.equal(p.records[date].original,null);
});
test('Median threshold, observed 14 dates, all-time min and average',()=>{
 const p=product();
 for(let i=1;i<=13;i++){const date=PriceCore.dateOffset(today,-i);p.records[date]={date,sale:10000,original:12000};}
 assert.equal(PriceCore.stats(p).badge,'데이터 수집 중');
 assert.equal(PriceCore.stats(p).min,null);assert.equal(PriceCore.stats(p).average,null);
 p.records[today]={date:today,sale:9000,original:12000};
 const s=PriceCore.stats(p);assert.equal(s.badge,'진짜 세일');assert.equal(s.median90,10000);assert.equal(s.min,9000);assert.equal(s.count,14);assert.equal(s.average,(130000+9000)/14);
 p.records[today].sale=9001;assert.equal(PriceCore.stats(p).badge,'평소 가격');
});
test('Missing dates are excluded from average and break chart paths',()=>{
 const p=product(),first=PriceCore.dateOffset(today,-2);p.records[first]={date:first,sale:10000,original:null};p.records[today]={date:today,sale:8000,original:null};
 assert.equal(PriceCore.stats(p).average,null);
 const container={innerHTML:''};PriceChart.render(container,p,30,today);
 assert.ok(container.innerHTML.includes('M58')===false);
 const sale=container.innerHTML.match(/<path d="([^"]*)"[^>]*stroke="#128266"/)[1];
 assert.equal((sale.match(/M/g)||[]).length,2);assert.equal((sale.match(/L/g)||[]).length,0);
});
test('Uncertain/different options are not auto-recorded from hidden base price',()=>{
 assert.ok(PriceCore.eligibility({...config,optionMode:'different'},{sale:10000,firstOptionVerified:false}));
 assert.ok(PriceCore.eligibility({...config,optionMode:'different'},{sale:10000,firstOptionVerified:true,saleMethod:'hidden'}));
 assert.equal(PriceCore.eligibility({...config,optionMode:'different'},{sale:10000,firstOptionVerified:true,saleMethod:'click'}),null);
 assert.ok(PriceCore.eligibility(config,{sale:10000,optionPriceDiffers:true}));
});
test('CSV roundtrip: Korean, quotes, newlines, formula prefixes, original null and selectors',()=>{
 for(const name of ['한글, "상품"\n두 번째 줄','=SUM(A1:A2)',"'=원래 이름","''문자열",' @formula']){
  const p=product();p.name=name;p.config.selectors.sale={selector:'div[data-testid="sale"]',tag:'DIV',overrideHidden:true};
  p.records[today]=PriceCore.validateRecord({sale:85500,original:null});
  const decoded=PriceCSV.parse(PriceCSV.encode({[p.key]:p}))[p.key];
  assert.equal(decoded.name,name);assert.equal(decoded.records[today].original,null);assert.equal(decoded.config.selectors.sale.selector,p.config.selectors.sale.selector);
 }
});
test('CSV rejects malformed input, invalid prices, future dates and excessive products',()=>{
 assert.throws(()=>PriceCSV.parse('bad,columns\n1,2'));
 const p=product();p.records[today]=PriceCore.validateRecord({sale:10000});
 const csv=PriceCSV.encode({[p.key]:p});assert.throws(()=>PriceCSV.parse(csv.replace('"10000"','"-1"')));
 assert.throws(()=>PriceCore.validateRecord({sale:10000,date:PriceCore.dateOffset(today,1)}));
 const many=Object.fromEntries(Array.from({length:51},(_,i)=>{const p=product(String(i+1));return[p.key,p];}));
 assert.throws(()=>PriceCSV.parse(PriceCSV.encode(many)),/50/);
 assert.throws(()=>PriceCSV.merge(many,{}),/50/);
});
test('Import merges observations and does not lose newer local records',()=>{
 const p=product(),incoming=product();p.records[today]={...PriceCore.validateRecord({sale:10000}),recordedAt:today+'T02:00:00+09:00'};
 incoming.records[today]={...PriceCore.validateRecord({sale:9000}),recordedAt:today+'T01:00:00+09:00'};
 const merged=PriceCSV.merge({[p.key]:p},{[incoming.key]:incoming});assert.equal(merged[p.key].records[today].sale,10000);assert.equal(p.records[today].sale,10000);
});
test('30 percent boundary in either direction; missing original is not a price jump',()=>{
 assert.equal(PriceCore.priceChanges({sale:10000,original:20000},{sale:7001,original:null}).length,0);
 assert.equal(PriceCore.priceChanges({sale:10000},{sale:7000})[0].field,'sale');
 assert.equal(PriceCore.priceChanges({sale:10000},{sale:13000}).length,1);
 assert.equal(PriceCore.priceChanges({sale:10000,original:20000},{sale:10000,original:26000})[0].field,'original');
 assert.equal(PriceCore.priceChanges(null,{sale:10000}).length,0);
});
test('Rounded currency axis, discount rate and escaped event tooltip',()=>{
 const scale=PriceChart.scale(44500,59400);assert.ok(scale.ticks.includes(50000));assert.ok(scale.ticks.every(x=>x%1000===0));
 assert.ok(scale.ticks.every(x=>Number.isInteger(x)&&x%scale.step===0));
 const p=product();p.records[today]=PriceCore.validateRecord({sale:44500,original:59400,eventName:'올영세일 <겨울>'});
 assert.equal(PriceCore.stats(p).discountRate,25.1);
 const container={innerHTML:''};PriceChart.render(container,p,30,today);assert.ok(container.innerHTML.includes('올영세일 &lt;겨울&gt;'));assert.ok(!container.innerHTML.includes('<겨울>'));
 p.records[today].original=null;assert.equal(PriceCore.stats(p).discountRate,null);
});
test('Event names survive CSV backup; version 1 backups still import',()=>{
 const p=product();p.records[today]=PriceCore.validateRecord({sale:10000,eventName:'무진장, "타임특가"'});
 assert.equal(PriceCSV.parse(PriceCSV.encode({[p.key]:p}))[p.key].records[today].eventName,p.records[today].eventName);
 const headers=PriceCSV.columns.filter(x=>x!=='eventName');
 const raw={format:1,productKey:p.key,site:p.site,url:p.url,name:p.name,imageUrl:'',createdAt:p.createdAt,configJson:JSON.stringify(p.config),date:today,originalPrice:'',salePrice:10000,recordedAt:new Date().toISOString(),source:'auto',loginState:'unknown',method:'hidden'};
 const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';
 const old=headers.map(quote).join(',')+'\r\n'+headers.map(key=>quote(raw[key])).join(',');
 assert.equal(PriceCSV.parse(old)[p.key].records[today].eventName,'');
});
console.log(`${cases.length} core/backup test groups passed.`);
