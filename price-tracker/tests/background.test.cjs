const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),events=()=>({addListener(){}}),memory={};
const notifications=[],tabs=[],alarms=[];
const sandbox={console,URL,Intl,Date,structuredClone,setTimeout,clearTimeout};
sandbox.chrome={
 runtime:{getURL:file=>'chrome-extension://test/'+file,onMessage:events(),onInstalled:events(),onStartup:events()},
 storage:{local:{async get(key){await new Promise(r=>setTimeout(r,1));return {[key]:structuredClone(memory[key])};},async set(values){await new Promise(r=>setTimeout(r,1));Object.assign(memory,structuredClone(values));},async setAccessLevel(){}}},
 scripting:{async executeScript(){return[{result:{candidates:[]}}];}},
 tabs:{async create(options){tabs.push(options);return {id:tabs.length};}},
 alarms:{onAlarm:events(),async create(name,options){alarms.push({name,...options});},async clear(){}},
 notifications:{onButtonClicked:events(),onClicked:events(),async create(id,options){notifications.push({id,...options});return id;},async clear(){}}
};
vm.createContext(sandbox);sandbox.importScripts=(...files)=>{for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox);};
vm.runInContext(fs.readFileSync(path.join(root,'background.js'),'utf8'),sandbox);
const mutate=vm.runInContext('mutate',sandbox);
const ui={url:'chrome-extension://test/app.html',tab:{id:200}};
const page=id=>({url:`https://www.musinsa.com/products/${id}`,tab:{id:1},frameId:0});
const config={publicConfirmed:true,optionMode:'none',selectors:{}};
const payload={name:'상품',imageUrl:'',sale:10000,original:null,config,publicConfirmed:true,loginState:'loggedOut'};
(async()=>{
 await sandbox.startup();
 await Promise.all([sandbox.route({type:'REGISTER',payload},page('1')),sandbox.route({type:'REGISTER',payload},page('2'))]);
 let state=await sandbox.route({type:'GET_STATE'},ui);assert.equal(Object.keys(state.products).length,2);
 console.log('PASS concurrent registrations preserve both products');
 await Promise.all([sandbox.route({type:'AUTO_RECORD',payload:{key:'musinsa:1',evidence:{sale:9000,original:10000,eventName:'무진장',loginState:'loggedOut'}}},page('1')),sandbox.route({type:'AUTO_RECORD',payload:{key:'musinsa:2',evidence:{sale:8000,original:null,loginState:'loggedOut'}}},page('2'))]);
 state=await sandbox.route({type:'GET_STATE'},ui);assert.equal(Object.keys(state.products['musinsa:1'].records).length,1);assert.equal(Object.values(state.products['musinsa:2'].records)[0].sale,8000);
 console.log('PASS serialized daily updates and null original');
 assert.equal(Object.values(state.products['musinsa:1'].records)[0].eventName,'무진장');
 const denied=await sandbox.route({type:'AUTO_RECORD',payload:{key:'musinsa:1',evidence:{sale:9000,optionPriceDiffers:true}}},page('1'));assert.equal(denied.saved,false);
 await assert.rejects(()=>sandbox.route({type:'AUTO_RECORD',payload:{key:'musinsa:1',evidence:{sale:1}}},page('2')),/달라/);
 state=await sandbox.route({type:'GET_STATE'},ui);assert.ok(state.products['musinsa:1'].lastError);
 await assert.rejects(()=>sandbox.route({type:'GET_STATE'},{url:'https://www.musinsa.com/products/1',tab:{id:1},frameId:0}));
 await assert.rejects(()=>sandbox.route({type:'REGISTER',payload},{url:'https://evil.test/products/3',tab:{id:1},frameId:0}));
 console.log('PASS unsafe option changes and untrusted routes rejected');
 await assert.rejects(()=>sandbox.route({type:'CSV_EXPORTED'},page('1')),/관리 화면/);
 const beforeExport=Date.now();
 await sandbox.route({type:'CSV_EXPORTED'},ui);
 state=await sandbox.route({type:'GET_STATE'},ui);
 const exportedAt=state.lastCsvExportAt;
 assert.ok(Date.parse(exportedAt)>=beforeExport&&Date.parse(exportedAt)<=Date.now());
 await sandbox.route({type:'SAVE_SETTINGS',payload:{hour:20,reminderEnabled:true}},ui);
 state=await sandbox.route({type:'GET_STATE'},ui);
 assert.equal(state.lastCsvExportAt,exportedAt);
 console.log('PASS CSV export timestamp persists across reloads/settings and rejects product page requests');
 await sandbox.route({type:'MANUAL_RECORD',payload:{key:'musinsa:1',sale:7000,original:null,publicConfirmed:true,loginState:'loggedIn'}},ui);
 state=await sandbox.route({type:'GET_STATE'},ui);
 const recent=Object.values(state.products['musinsa:1'].records)[0];
 assert.equal(recent.loginPriceDiffers,true);assert.equal(recent.loginComparison,'differenceObserved');
 console.log('PASS login price differences retained across same-day last-value updates');
 const jump=await sandbox.route({type:'AUTO_RECORD',payload:{key:'musinsa:1',evidence:{sale:4900,original:null}}},page('1'));
 assert.equal(jump.saved,false);assert.equal(jump.requiresConfirmation,true);
 state=await sandbox.route({type:'GET_STATE'},ui);assert.equal(Object.values(state.products['musinsa:1'].records)[0].sale,7000);
 console.log('PASS 30 percent changes require confirmation without overwriting the prior record');
 await mutate(current=>{current.products['musinsa:2'].records={};current.lastReminderDay=null;return true;});
 notifications.length=0;
 await Promise.all([sandbox.notify(),sandbox.notify(),sandbox.notify()]);assert.equal(notifications.length,1);assert.ok(notifications[0].title.includes('1개'));
 await sandbox.notify();assert.equal(notifications.length,1);
 await sandbox.openMissing();assert.equal(tabs.length,1);assert.equal(tabs[0].url,'https://www.musinsa.com/products/2');
 console.log('PASS one evening notification per Korean day; opens only missing products');
 await mutate(current=>{for(let id=3;id<=50;id++)current.products[`musinsa:${id}`]={key:`musinsa:${id}`,records:{}};return true;});
 await assert.rejects(()=>sandbox.route({type:'REGISTER',payload},page('51')),/50/);
 console.log('PASS maximum 50 products enforced in background');
 console.log('Background integration tests passed. Real Chrome notifications require installation testing.');
})().catch(error=>{console.error(error);process.exitCode=1;});
