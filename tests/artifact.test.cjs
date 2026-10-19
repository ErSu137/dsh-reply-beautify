'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {normalizeArtifact,artifactDocument}=require('../src/artifact-model.cjs');
const {createArtifactStore,KEY}=require('../src/artifact-store.cjs');
const {createArtifactWorkspace}=require('../src/artifact-view.cjs');
const {parseContent}=require('../src/content-model.cjs');
const {createPreferences}=require('../src/core.cjs');
const {createContentController}=require('../src/content-controller.cjs');
const {SAMPLE,GUIDE}=require('../src/artifact-guidance.cjs');
const {controllerFixture}=require('./controller-fixture.cjs');
const model=patch=>normalizeArtifact({...SAMPLE,...patch});
const memory=()=>{const values=new Map();return{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),values};};
function button(node,label){const b=node.querySelectorAll('button').find(n=>n.textContent===label);assert.ok(b,'missing '+label);return b;}
function setup(){const doc=controllerFixture(),preferences=createPreferences(doc.defaultView.localStorage),calls=[],workspace=createArtifactWorkspace(doc,preferences,{storage:doc.defaultView.localStorage,sidebar:{openTab:kind=>calls.push(kind)}}),source=doc.reply('sample').block;return{doc,preferences,workspace,source,calls};}
function mount(s){const r=s.workspace.render(model(),s.source);s.doc.body.append(r.node);return r;}
function channel(frame){const source=frame.srcdoc.match(/<script>([\s\S]*?)<\/script>/)[1];return JSON.parse(source.match(/const channel=("[^"]+")/)[1]);}
test('artifacts require their schema, while ordinary HTML/JS/JSON code stays native',()=>{
 for(const lang of ['dsh-artifact','dsh-ui',''])assert.equal(parseContent(lang,JSON.stringify(SAMPLE)).kind,'artifact');
 for(const lang of ['html','javascript','json'])assert.equal(parseContent(lang,JSON.stringify(SAMPLE)),null);
 for(const patch of [{id:'../bad'},{version:0},{version:1.5},{html:'x'.repeat(30001)},{title:''}])assert.ok(model(patch).error);
 assert.ok(parseContent('dsh-artifact','{"type":').error);assert.ok(GUIDE.length<8192);
});
test('model revisions, local edits and API state survive recreation and remain session isolated',()=>{
 const storage=memory(),s=createArtifactStore(storage),one=s.ingest('a',model());s.select(one);s.saveState(one,{task:'保留我',importance:8});s.draft(one,'draft');s.edit(one,'<h1>本机修改</h1>');const local=s.current(one).key;
 const two=s.ingest('b',model());assert.notEqual(one,two);assert.deepEqual(s.get(two).state,{});
 const v2=model({version:2,html:SAMPLE.html+'<p>新版</p>'});s.ingest('a',v2);assert.equal(s.current(one).number,2);assert.equal(s.get(one).state.task,'保留我');s.ingest('a',model());assert.equal(s.current(one).number,2,'old message does not replace latest active revision');
 s.activate(one,local);const restored=createArtifactStore(storage);assert.equal(restored.selected('a'),one);assert.equal(restored.current(one).html,'<h1>本机修改</h1>');assert.equal(restored.get(one).state.importance,8);
 assert.throws(()=>s.ingest('a',model({html:'different same version'})),/version|版本/);assert.throws(()=>s.saveState(one,{x:'a'.repeat(24000)}));assert.throws(()=>s.saveState(one,[]));
});
test('artifact retention is bounded and unavailable/corrupt storage leaves memory usable',()=>{
 const storage=memory(),s=createArtifactStore(storage);let last;for(let i=0;i<15;i++)last=s.ingest('a',model({id:'work'+i}));assert.equal(s.list('a').length,12);assert.equal(s.get(last).id,'work14');assert.equal(s.list('a')[0],last);
 const key=s.list('a')[0];for(let i=0;i<10;i++)s.edit(key,'<p>'+i+'</p>');assert.equal(s.get(key).versions.length,6);assert.ok(storage.getItem(KEY).length<1800000);const active=s.current(key).key;s.ingest('a',model({id:'work14'}));assert.equal(s.current(key).key,active,'old pruned model revision cannot displace local work');
 const broken=createArtifactStore({getItem:()=>'{bad',setItem(){throw Error('quota');}}),k=broken.ingest('a',model());broken.saveState(k,{x:1});assert.equal(broken.persistent(),false);assert.equal(broken.get(k).state.x,1);
});
test('two opaque sandboxes encode the work as data and relay only the child protocol',()=>{
 const html=artifactDocument(model({html:'</script><script>parent.document.body.textContent="bad"</script>'}),{channel:'nonce',state:{text:'</script>'}});
 assert.equal((html.match(/<script>/g)||[]).length,1,'untrusted markup cannot end the trusted outer script');assert.ok(html.includes('frame-src about:'));assert.ok(html.includes('connect-src'));
 const handler={},forwarded=[],inner={contentWindow:{messages:[],postMessage(d){this.messages.push(d);}},setAttribute(k,v){this[k]=v;}};
 const parent={postMessage:d=>forwarded.push(d)},ctx={parent,document:{createElement:()=>inner,body:{append(){}}},addEventListener:(k,fn)=>handler[k]=fn};
 vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
 assert.equal(inner.sandbox,'allow-scripts');assert.ok(!inner.sandbox.includes('allow-same-origin'));assert.ok(inner.srcdoc.includes("frame-src 'none'"));assert.ok(inner.srcdoc.includes('dshArtifact'));
 handler.message({source:{},data:{dshArtifact:'nonce',action:'state',value:{x:1}}});assert.equal(forwarded.length,0);
 handler.message({source:inner.contentWindow,data:{dshArtifact:'nonce',action:'navigate',value:'https://x'}});assert.equal(forwarded.length,0);
 handler.message({source:inner.contentWindow,data:{dshArtifact:'nonce',action:'state',value:{x:1}}});assert.equal(forwarded.length,1);
 handler.message({source:parent,data:{dshArtifact:'nonce',action:'restore',value:{x:2}}});assert.equal(inner.contentWindow.messages.length,1);
});
test('in-frame state API restores data and escapes embedded script-closing strings',()=>{
 const html=artifactDocument(model(),{channel:'nonce',state:{task:'</script>',importance:7}}),outer={};
 const outerCtx={parent:{postMessage(){}},document:{createElement:()=>({contentWindow:{},setAttribute(){},set srcdoc(v){outer.inner=v;}}),body:{append(){}}},addEventListener(){}};vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],outerCtx);
 const events={},sent=[],parent={postMessage:d=>sent.push(d)},window={};const innerCtx={window,parent,addEventListener:(k,fn)=>events[k]=fn,dispatchEvent(){},CustomEvent:function(){}};
 vm.runInNewContext(outer.inner.match(/<script>([\s\S]*?)<\/script>/)[1],innerCtx);assert.equal(window.dshArtifact.getState().importance,7);assert.equal(window.dshArtifact.getState().task,'</script>');window.dshArtifact.setState({importance:9});assert.equal(sent.at(-1).action,'state');assert.equal(sent.at(-1).value.importance,9);assert.throws(()=>window.dshArtifact.setState([]));
 events.message({source:parent,data:{dshArtifact:'nonce',action:'restore',value:{importance:3}}});assert.equal(window.dshArtifact.getState().importance,3);
});
test('preview starts on click, validates source/channel, and stops without leaked listeners',()=>{
 const s=setup(),r=mount(s);assert.equal(r.node.querySelectorAll('iframe').length,0);button(r.node,'运行预览').click();const frame=r.node.querySelector('iframe'),token=channel(frame);assert.equal(frame.getAttribute('sandbox'),'allow-scripts');
 const key=s.workspace.store.list('session-a')[0];s.doc.message({}, {dshArtifact:token,action:'state',value:{x:8}});assert.deepEqual(s.workspace.store.get(key).state,{});
 s.doc.message(frame.contentWindow,{dshArtifact:'wrong',action:'state',value:{x:8}});assert.deepEqual(s.workspace.store.get(key).state,{});
 s.doc.message(frame.contentWindow,{dshArtifact:token,action:'state',value:{x:8}});assert.equal(s.workspace.store.get(key).state.x,8);
 r.setVisible(false);assert.equal(r.node.querySelectorAll('iframe').length,0);s.doc.message(frame.contentWindow,{dshArtifact:token,action:'state',value:{x:99}});assert.equal(s.workspace.store.get(key).state.x,8);
 r.cleanup();assert.equal(s.doc.listenerCount(),0);assert.equal(s.doc.observerCount(),0);s.workspace.dispose();
});
test('source edits and version selection reload only a running preview',()=>{
 const s=setup(),r=mount(s);button(r.node,'编辑源码').click();const area=r.node.querySelector('textarea');area.value='<h1>本机新标题</h1>';area.dispatch('input');button(r.node,'应用为新版本').click();assert.equal(r.node.querySelectorAll('iframe').length,0);button(r.node,'运行预览').click();const frame=r.node.querySelector('iframe');
 const key=s.workspace.store.list('session-a')[0];assert.equal(s.workspace.store.current(key).html,'<h1>本机新标题</h1>');const select=r.node.querySelector('select');select.value=s.workspace.store.get(key).versions[0].key;select.dispatch('change');assert.notEqual(r.node.querySelector('iframe'),frame);assert.equal(s.workspace.store.current(key).origin,'model');
 s.preferences.update({enabled:false});assert.equal(r.node.querySelectorAll('iframe').length,0);r.cleanup();s.workspace.dispose();
});
test('native sidebar opens the owned kind and fullscreen cleanup removes its frames',()=>{
 const s=setup(),r=mount(s);button(r.node,'在侧栏打开').click();assert.deepEqual(s.calls,['reply-beautify-artifacts']);
 const container=s.doc.createElement('div');s.doc.body.append(container);const release=s.workspace.mountSidebar(container,'session-a');assert.ok(container.textContent.includes('优先级小工具'));button(container,'运行预览').click();assert.equal(container.querySelectorAll('iframe').length,1);release();assert.equal(container.querySelectorAll('iframe').length,0);
 button(r.node,'全屏预览').click();const dialog=s.doc.querySelector('dialog');assert.ok(dialog);button(dialog,'运行预览').click();assert.equal(dialog.querySelectorAll('iframe').length,1);button(dialog,'关闭全屏').click();assert.equal(s.doc.querySelector('dialog'),null);r.cleanup();s.workspace.dispose();assert.equal(s.doc.listenerCount(),0);
});
test('controller hides original only after a work is mounted and source/disable stop runtime',()=>{
 const s=setup(),reply=s.doc.reply(JSON.stringify(SAMPLE),{language:'dsh-artifact'}),controller=createContentController(s.doc,s.preferences,{artifactWorkspace:s.workspace});s.doc.advance(650);assert.equal(reply.block.getAttribute('data-dsh-rb-source'),'hidden');
 const figure=reply.block.nextElementSibling;button(figure,'运行预览').click();assert.equal(figure.querySelectorAll('iframe').length,1);button(figure,'查看原文').click();assert.equal(figure.querySelectorAll('iframe').length,0);assert.equal(reply.block.getAttribute('data-dsh-rb-source'),'shown');
 s.preferences.update({enabled:false});assert.equal(s.doc.querySelectorAll('.dsh-rb-figure').length,0);assert.equal(reply.block.getAttribute('data-dsh-rb-source'),null);controller.dispose();s.workspace.dispose();assert.equal(s.doc.listenerCount(),0);
});
test('all previews share API state and global off closes the fullscreen runtime',()=>{
 const s=setup(),one=mount(s),two=mount(s);button(one.node,'运行预览').click();button(two.node,'运行预览').click();
 const a=one.node.querySelector('iframe'),b=two.node.querySelector('iframe');s.doc.message(a.contentWindow,{dshArtifact:channel(a),action:'state',value:{task:'同步'}});assert.equal(b.contentWindow.messages.at(-1).value.task,'同步');
 button(one.node,'全屏预览').click();assert.ok(s.doc.querySelector('dialog'));s.preferences.update({enabled:false});assert.equal(s.doc.querySelector('dialog'),null);assert.equal(two.node.querySelector('iframe'),null);button(two.node,'运行预览').click();assert.equal(two.node.querySelector('iframe'),null);one.cleanup();two.cleanup();s.workspace.dispose();assert.equal(s.doc.listenerCount(),0);
});
test('idle artifact cards hold no runtime message listener or theme observer',()=>{
 const s=setup(),views=Array.from({length:30},()=>mount(s));assert.equal(s.doc.listenerCount(),0);assert.equal(s.doc.observerCount(),0);
 const first=views[0];button(first.node,'运行预览').click();assert.equal(s.doc.listenerCount(),1);assert.equal(s.doc.observerCount(),1);button(first.node,'停止预览').click();assert.equal(s.doc.listenerCount(),0);assert.equal(s.doc.observerCount(),0);
 views.forEach(v=>v.cleanup());s.workspace.dispose();
});
test('clipboard failure exposes original and stops the hidden artifact runtime',async()=>{
 const s=setup(),r=s.doc.reply(JSON.stringify(SAMPLE),{language:'dsh-artifact'}),controller=createContentController(s.doc,s.preferences,{artifactWorkspace:s.workspace});s.doc.advance(120);const figure=r.block.nextElementSibling;button(figure,'运行预览').click();assert.ok(figure.querySelector('iframe'));
 s.doc.defaultView.navigator.clipboard.writeText=async()=>{throw Error('denied');};button(figure,'复制原文').click();await Promise.resolve();assert.equal(figure.querySelector('iframe'),null);assert.equal(r.block.getAttribute('data-dsh-rb-source'),'shown');controller.dispose();s.workspace.dispose();
});
