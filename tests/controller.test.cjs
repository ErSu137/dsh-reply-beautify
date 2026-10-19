'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {controllerFixture}=require('./controller-fixture.cjs');
const {createContentController}=require('../src/content-controller.cjs');
const {createPreferences,REPLY_SELECTOR}=require('../src/core.cjs');
const {SAMPLES}=require('../src/rich-guidance.cjs');
const flow='flowchart LR\nA[输入] --> B{检查}\nB -->|通过| C[完成]\nB -->|不通过| D[返回错误]';
function setup(doc,options){const store=createPreferences(doc.defaultView.localStorage),controller=createContentController(doc,store,options);return{store,controller};}
const figures=doc=>doc.querySelectorAll('.dsh-rb-figure');
test('historical replies batch at most six roots per task with one shared timer',()=>{
 const doc=controllerFixture();for(let i=0;i<1000;i++)doc.reply(flow);
 const {controller}=setup(doc);assert.equal(doc.querySelectorAll(REPLY_SELECTOR).length,1000);assert.equal(doc.pendingTimers(),1);assert.equal(figures(doc).length,0);
 doc.runNext();assert.ok(figures(doc).length>0&&figures(doc).length<=6);assert.equal(doc.pendingTimers(),1);
 doc.advance(0);assert.equal(figures(doc).length,1000);assert.equal(doc.pendingTimers(),0);
 controller.dispose();assert.equal(figures(doc).length,0);assert.equal(doc.observerCount(),0);assert.equal(doc.querySelectorAll('[data-dsh-rb-source]').length,0);
});
test('a streaming update reads only its own reply and reveals stale source immediately',()=>{
 const doc=controllerFixture(),replies=Array.from({length:200},()=>doc.reply(flow));const {controller}=setup(doc);doc.advance(650);
 const descriptor=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(replies[0].code),'textContent');let oldReads=0;
 for(const {code}of replies.slice(0,-1))Object.defineProperty(code,'textContent',{get(){oldReads++;return descriptor.get.call(this);},set(v){descriptor.set.call(this,v);}});
 const last=replies.at(-1);last.code.textContent='flowchart LR';doc.change(last.code);assert.equal(last.block.getAttribute('data-dsh-rb-source'),null);assert.equal(figures(doc).length,199);assert.equal(oldReads,0);
 for(let i=0;i<10;i++){last.code.textContent=flow.slice(0,20+i);doc.change(last.code);doc.advance(100);assert.equal(figures(doc).length,199);}
 last.code.textContent=flow;doc.change(last.code);doc.advance(649);assert.equal(figures(doc).length,199);doc.advance(1);assert.equal(figures(doc).length,200);assert.equal(oldReads,0);controller.dispose();
});
test('owned widget mutations schedule no native rescans or timers',()=>{
 const doc=controllerFixture();doc.reply(flow);const {controller}=setup(doc);doc.advance(650);
 const label=figures(doc)[0].querySelector('.dsh-rb-edge-label');doc.change(label);assert.equal(doc.pendingTimers(),0);
 const figure=figures(doc)[0];doc.notify([{type:'childList',target:figure.parentElement,addedNodes:[figure],removedNodes:[]}]);assert.equal(doc.pendingTimers(),0);controller.dispose();
});
test('recycled rows cannot leave enhancements in reasoning/user/compact content',()=>{
 const doc=controllerFixture(),reply=doc.reply(flow);const {controller}=setup(doc);doc.advance(650);
 for(const [target,attr,value]of [[reply.row,'data-chat-group-part','reasoning'],[reply.row,'data-chat-flow-kind','user'],[reply.md,'data-markdown-variant','compact'],[reply.md,'class','native-new-markdown']]){
  target.setAttribute(attr,value);doc.change(target,'attributes',{attributeName:attr});assert.equal(figures(doc).length,0);assert.equal(reply.block.getAttribute('data-dsh-rb-source'),null);
  reply.row.setAttribute('data-chat-group-part','response');reply.row.setAttribute('data-chat-flow-kind','assistant-step');reply.md.removeAttribute('data-markdown-variant');reply.md.className='_markdown_fixture';doc.change(reply.row,'attributes');doc.advance(650);assert.equal(figures(doc).length,1);
 }
 controller.dispose();
});
test('user/tool/reasoning/code blocks remain native through start and toggles',()=>{
 const doc=controllerFixture();const protectedRows=[doc.reply(flow,{kind:'user'}),doc.reply(flow,{kind:'tool'}),doc.reply(flow,{part:'reasoning'}),doc.reply(flow,{language:'python'})];doc.reply(flow);
 const {store,controller}=setup(doc);doc.advance(650);assert.equal(figures(doc).length,1);
 store.update({enabled:false});assert.equal(figures(doc).length,0);store.update({enabled:true});doc.advance(650);assert.equal(figures(doc).length,1);
 for(const r of protectedRows){assert.equal(r.code.textContent,flow);assert.equal(r.block.getAttribute('data-dsh-rb-source'),null);}controller.dispose();
});
test('removed rows cancel pending work and release active playback',()=>{
 const doc=controllerFixture(),r=doc.reply(JSON.stringify(SAMPLES.steps),{language:'dsh-ui'});const {controller}=setup(doc);doc.advance(650);
 figures(doc)[0].querySelectorAll('button').find(n=>n.textContent==='播放').click();assert.equal(doc.timerCount(),1);
 r.row.remove();doc.notify([{type:'childList',target:doc.session,addedNodes:[],removedNodes:[r.row]}]);assert.equal(doc.timerCount(),0);assert.equal(r.block.getAttribute('data-dsh-rb-source'),null);
 const pending=doc.reply(flow);doc.notify([{type:'childList',target:doc.session,addedNodes:[pending.row],removedNodes:[]}]);assert.equal(doc.pendingTimers(),1);pending.row.remove();doc.notify([{type:'childList',target:doc.session,addedNodes:[],removedNodes:[pending.row]}]);assert.equal(doc.pendingTimers(),0);controller.dispose();
});
test('copy is exact; clipboard denial exposes the native source for manual copying',async()=>{
 const doc=controllerFixture(),r=doc.reply(flow);const {controller}=setup(doc);doc.advance(650);
 let figure=figures(doc)[0];const buttons=figure.querySelectorAll('button');buttons.find(n=>n.textContent==='复制原文').click();await Promise.resolve();assert.equal(doc.copied,flow);
 doc.defaultView.navigator.clipboard.writeText=async()=>{throw Error('denied');};buttons.find(n=>n.textContent==='复制原文').click();await Promise.resolve();assert.equal(r.block.getAttribute('data-dsh-rb-source'),'shown');assert.equal(figure.querySelector('.dsh-rb-viewport').hidden,true);assert.ok(figure.querySelector('.dsh-rb-status').textContent.includes('选择并复制'));assert.equal(r.code.textContent,flow);controller.dispose();
});
test('disable/dispose cancels quiet and math polling timers and restores native content',()=>{
 const doc=controllerFixture(),r=doc.reply('\\frac{1}{n}',{language:'latex'});let unmounts=0;
 const {store,controller}=setup(doc,{mountMath(){return{dispose(){unmounts++;}};}});doc.advance(650);assert.equal(doc.pendingTimers(),1);assert.equal(r.block.getAttribute('data-dsh-rb-source'),null);
 store.update({enabled:false});assert.equal(doc.pendingTimers(),0);assert.equal(unmounts,1);assert.equal(doc.observerCount(),0);assert.equal(figures(doc).length,0);
 store.update({enabled:true});assert.equal(doc.pendingTimers(),1);controller.dispose();doc.advance(5000);assert.equal(doc.pendingTimers(),0);assert.equal(doc.observerCount(),0);assert.equal(figures(doc).length,0);
});
test('session changes recreate widgets in a new state namespace',()=>{
 const doc=controllerFixture(),r=doc.reply(JSON.stringify(SAMPLES.board),{language:'dsh-ui'});const {controller}=setup(doc);doc.advance(650);
 let first=figures(doc)[0];const check=first.querySelector('input[type="checkbox"]');check.checked=true;check.dispatch('change');
 const saved=[...doc.storageValues].find(([k])=>k.includes('interactions'));assert.ok(saved);
 doc.session.setAttribute('data-dsh-rb-session','session-b');doc.change(doc.session,'attributes',{attributeName:'data-dsh-rb-session'});assert.equal(figures(doc).length,0);doc.advance(650);assert.notEqual(figures(doc)[0],first);assert.equal(figures(doc)[0].querySelector('input[type="checkbox"]').checked,false);
 doc.session.setAttribute('data-dsh-rb-session','session-a');doc.change(doc.session,'attributes');doc.advance(650);assert.equal(figures(doc)[0].querySelector('input[type="checkbox"]').checked,true);controller.dispose();
});
test('image alt updates do not stop processing changed code in the same reply',()=>{
 const doc=controllerFixture(),r=doc.reply(flow),p=doc.createElement('p'),img=doc.createElement('img');img.setAttribute('alt','示例说明');p.append(img);r.md.children.unshift(p);p.parentElement=r.md;
 const {controller}=setup(doc);doc.advance(650);assert.equal(doc.querySelectorAll('.dsh-rb-image-caption').length,1);
 r.code.textContent='flowchart TD\nA[新内容] --> B[结束]';img.setAttribute('alt','更新说明');doc.change(r.code);assert.equal(r.block.getAttribute('data-dsh-rb-source'),null);doc.advance(650);assert.equal(doc.querySelector('.dsh-rb-image-caption').textContent,'更新说明');assert.ok(figures(doc)[0].textContent.includes('新内容'));controller.dispose();
});

const chart={type:'bar',title:'工时',labels:['甲','乙'],series:[{name:'预算',values:[12,18]}]};
function proseAfter(doc,r){const p=doc.createElement('p');r.md.append(p);doc.notify([{type:'childList',target:r.md,addedNodes:[p],removedNodes:[]}]);return p;}
test('completed chart converts during continuously streaming prose and keeps the same live widget',()=>{
 const doc=controllerFixture(),r=doc.reply(JSON.stringify(chart),{language:'dsh-chart'}),{controller}=setup(doc),p=proseAfter(doc,r);
 for(let i=0;i<60;i++){p.textContent+='下文';doc.change(p);doc.advance(40);if(i===2)assert.equal(figures(doc).length,1,'chart ready at120ms before prose completes');}
 const figure=figures(doc)[0];assert.equal(r.block.getAttribute('data-dsh-rb-source'),'hidden');
 for(let i=0;i<20;i++){p.textContent+='继续解释';doc.change(p);doc.advance(40);assert.equal(figures(doc)[0],figure,'later text must not recreate the widget');}
 controller.dispose();
});
test('incomplete JSON waits; complete valid component converts within its own short deadline',()=>{
 const doc=controllerFixture(),r=doc.reply('{"type":"bar","title":"工时",',{language:'dsh-chart'}),{controller}=setup(doc),p=proseAfter(doc,r);
 for(let i=0;i<10;i++){r.code.textContent+=' ';doc.change(r.code);p.textContent+='文字';doc.change(p);doc.advance(80);assert.equal(figures(doc).length,0);}
 r.code.textContent=JSON.stringify(chart);doc.change(r.code);doc.advance(119);assert.equal(figures(doc).length,0);p.textContent+='还没写完';doc.change(p);doc.advance(1);assert.equal(figures(doc).length,1);controller.dispose();
});
test('two blocks in one reply have independent deadlines while the second is streaming',()=>{
 const doc=controllerFixture(),r=doc.reply(JSON.stringify(chart),{language:'dsh-chart'}),second=doc.reply('{"type":',{language:'dsh-ui'});r.md.append(second.block);second.row.remove();const {controller}=setup(doc);
 for(let i=0;i<15;i++){second.code.textContent+=' ';doc.change(second.code);doc.advance(40);if(i>=2)assert.equal(figures(doc).length,1);}
 second.code.textContent=JSON.stringify(SAMPLES.table);doc.change(second.code);doc.advance(120);assert.equal(figures(doc).length,2);assert.equal(second.block.getAttribute('data-dsh-rb-source'),'hidden');controller.dispose();
});
test('following native Markdown confirms a flow block without waiting for the rest of the reply',()=>{
 const doc=controllerFixture(),r=doc.reply(flow),{controller}=setup(doc);doc.advance(80);const p=proseAfter(doc,r);p.textContent='继续分析';doc.change(p);
 for(let i=0;i<5;i++){p.textContent+='后文';doc.change(p);doc.advance(40);if(i===2)assert.equal(figures(doc).length,1);}
 controller.dispose();
});
test('malformed structured block keeps original and cannot take the fast rendering path',()=>{
 const doc=controllerFixture(),r=doc.reply('{"type":"bar","labels":["甲"]}',{language:'dsh-chart'}),{controller}=setup(doc),p=proseAfter(doc,r);
 for(let i=0;i<16;i++){p.textContent+='说明';doc.change(p);doc.advance(40);assert.equal(r.block.getAttribute('data-dsh-rb-source'),null);assert.equal(figures(doc).length,0);}
 doc.advance(10);assert.equal(figures(doc).length,1);assert.equal(r.block.getAttribute('data-dsh-rb-source'),null);assert.ok(figures(doc)[0].querySelector('.dsh-rb-status').textContent);controller.dispose();
});
test('editing an already displayed block restores source immediately then redraws independently',()=>{
 const doc=controllerFixture(),r=doc.reply(JSON.stringify(chart),{language:'dsh-chart'}),{controller}=setup(doc),p=proseAfter(doc,r);doc.advance(120);const old=figures(doc)[0];assert.ok(old);
 r.code.textContent='{"type":"bar",';doc.change(r.code);assert.equal(r.block.getAttribute('data-dsh-rb-source'),null);assert.equal(figures(doc).length,0);
 r.code.textContent=JSON.stringify({...chart,title:'修订图表'});doc.change(r.code);for(let i=0;i<3;i++){p.textContent+='后文';doc.change(p);doc.advance(40);}assert.equal(figures(doc).length,1);assert.notEqual(figures(doc)[0],old);assert.ok(figures(doc)[0].textContent.includes('修订图表'));controller.dispose();
});
test('a native renderer removing only the generated figure restores source and rebuilds once',()=>{
 const doc=controllerFixture(),r=doc.reply(flow),{controller}=setup(doc);doc.advance(650);const old=figures(doc)[0];old.remove();doc.notify([{type:'childList',target:r.md,addedNodes:[],removedNodes:[old]}]);assert.equal(r.block.getAttribute('data-dsh-rb-source'),null);doc.advance(650);assert.equal(figures(doc).length,1);assert.notEqual(figures(doc)[0],old);controller.dispose();
});
test('a single reply containing many blocks yields between conversion batches',()=>{
 const doc=controllerFixture(),r=doc.reply(flow);for(let i=0;i<100;i++){const extra=doc.reply(flow);r.md.append(extra.block);extra.row.remove();}const {controller}=setup(doc);doc.runNext();assert.ok(figures(doc).length>0&&figures(doc).length<=48);assert.equal(doc.pendingTimers(),1);doc.advance(0);assert.equal(figures(doc).length,100,'last open block keeps its own longer deadline');doc.advance(650);assert.equal(figures(doc).length,101);controller.dispose();assert.equal(doc.pendingTimers(),0);
});
