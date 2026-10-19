const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('native loader registers a footer control; disposal removes styles and storage listeners', () => {
  let definition, plugin, registration, component, cleanup;
  const mounted = new Set(), listeners = new Map();
  const window = {localStorage:{getItem:()=>null,setItem(){}},
    addEventListener:(name, fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);},
    __ModuleLoader__:{load:value=>{definition=value;}}};
  const document = {createElement:()=>({dataset:{},textContent:'',remove(){mounted.delete(this);}}),head:{append:(...styles)=>styles.forEach(s=>mounted.add(s))}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../lib/client.js'),'utf8'),{window,document});
  assert.equal(definition.id,'dsh-reply-beautify');
  plugin=definition.factory(name=>{
    if(name==='react')return {createElement(){}};
    if(name==='react-dom/client')return {createRoot(){}};
    if(name==='@deepseek-ai/dsh-client-ui-primitives')return {Tooltip(){}};
    throw Error('Unexpected dependency '+name);
  });
  const registered=[];
  plugin.apply({effect:effect=>{cleanup=effect();},slots:{inject:(name,run)=>{assert.ok(['sidebar.footer.action','conversation.composer.dock'].includes(name));run();},register:(value,view)=>{registered.push(value.name);if(value.name==='sidebar.footer.action'){registration=value;component=view;}}}});
  assert.equal(registered.length,2);
  assert.equal(typeof component,'function');assert.equal(mounted.size,5);assert.equal(listeners.size,1);
  const store=registration.inject().preferences;
  const reply=[...mounted].find(style=>style.dataset.pluginCss.endsWith('/reply'));
  const page=[...mounted].find(style=>style.dataset.pluginCss.endsWith('/page'));
  assert.ok(reply.textContent.includes('font-size:15px'));
  store.update({enabled:false});assert.equal(reply.textContent,'');assert.equal(page.textContent,'');
  store.update({enabled:true,font:17});assert.ok(reply.textContent.includes('font-size:17px'));
  cleanup();assert.equal(mounted.size,0);assert.equal(listeners.size,0);
});

test('artifact native sidebar uses the public type/body registries and releases both on disposal',()=>{
 let definition,cleanup,type,seat,disposedType=0,disposedSeat=0;const mounted=new Set();
 const window={localStorage:{getItem:()=>null,setItem(){}},addEventListener(){},removeEventListener(){},__ModuleLoader__:{load:v=>definition=v}};
 const document={createElement:()=>({dataset:{},textContent:'',remove(){mounted.delete(this);}}),head:{append:(...nodes)=>nodes.forEach(n=>mounted.add(n))}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../lib/client.js'),'utf8'),{window,document});
 const plugin=definition.factory(name=>name==='react'?{createElement(){}}:name==='react-dom/client'?{createRoot(){}}:{Tooltip(){}});
 assert.deepEqual([...plugin.inject],['slots','sidebarRight','sidebarRightTabs']);
 const sidebar={openTab(){},mounted:{getSnapshot:()=> 'session-a'}};
 plugin.apply({sidebarRight:sidebar,sidebarRightTabs:{register(v){type=v;return()=>disposedType++;}},effect(fn){cleanup=fn();},slots:{inject(name,fn){fn();if(name==='sidebar.right.pane.tab')return()=>disposedSeat++;},register(v,component){if(v.name==='sidebar.right.pane.tab')seat={...v,component};}}});
 assert.equal(type.id,'dsh-reply-beautify/artifacts');assert.equal(type.kind,'reply-beautify-artifacts');assert.equal(type.keepMounted,false);assert.equal(seat.key,type.id);assert.equal(typeof seat.component,'function');assert.equal(seat.inject().sidebarRight,sidebar);assert.equal(typeof seat.inject().workspace.render,'function');
 cleanup();assert.equal(disposedSeat,1);assert.equal(disposedType,1);assert.equal(mounted.size,0);
});

test('twenty complete plugin lifecycles retain preferences without accumulating runtime resources',()=>{
 const {controllerFixture}=require('./controller-fixture.cjs'),{SAMPLE}=require('../src/artifact-guidance.cjs');
 const document=controllerFixture(),window=document.defaultView;document.head=document.createElement('head');document.reply(JSON.stringify(SAMPLE),{language:'dsh-artifact'});let definition;
 window.__ModuleLoader__={load:v=>definition=v};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../lib/client.js'),'utf8'),{window,document});
 const plugin=definition.factory(name=>name==='react'?{createElement(){}}:name==='react-dom/client'?{createRoot(){}}:{Tooltip(){}});
 for(let i=0;i<20;i++){
  let cleanup,store;const registrations=new Map();
  plugin.apply({sidebarRight:{openTab(){},mounted:{getSnapshot:()=> 'session-a'}},sidebarRightTabs:{register(){return()=>{};}},effect(fn){cleanup=fn();},slots:{inject(name,fn){fn();return()=>{};},register(v,component){registrations.set(v.name,v);if(v.name==='sidebar.footer.action')store=v.inject().preferences;}}});
  if(i===0)store.update({preset:'claude',font:17});else assert.equal(store.getSnapshot().preferences.font,17);
  document.advance(650);const figure=document.querySelector('.dsh-rb-figure');assert.ok(figure);figure.querySelectorAll('button').find(n=>n.textContent==='运行预览').click();assert.ok(figure.querySelector('iframe'));
  cleanup();assert.equal(document.head.children.length,0);assert.equal(document.querySelector('.dsh-rb-figure'),null);assert.equal(document.querySelector('[data-dsh-rb-source]'),null);assert.equal(document.pendingTimers(),0);assert.equal(document.listenerCount(),0);assert.equal(document.observerCount(),0);
 }
});
