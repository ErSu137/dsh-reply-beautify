'use strict';
const {el}=require('./content-view.cjs');
const {artifactDocument,stateCopy}=require('./artifact-model.cjs');
const {createArtifactStore}=require('./artifact-store.cjs');
const TAB_KIND='reply-beautify-artifacts',TAB_ID='dsh-reply-beautify/artifacts';
function createArtifactWorkspace(doc,preferences,{sidebar,storage}={}){
 const view=doc.defaultView,store=createArtifactStore(storage),cleanups=new Set(),modals=new Set();let disposed=false;
 const unmodals=preferences.subscribe(()=>{if(!preferences.getSnapshot().preferences.enabled)for(const end of [...modals])end();});
 function own(cleanup){cleanups.add(cleanup);return()=>{cleanup();cleanups.delete(cleanup);};}
 function openSidebar(key){if(!sidebar?.openTab)throw Error('当前DSH没有可用的作品侧栏接口');store.select(key);sidebar.openTab(TAB_KIND);}
 function fullscreen(key){
  const dialog=el(doc,'dialog',{class:'dsh-rb-artifact-dialog','data-dsh-rb-owned':'','aria-label':'作品全屏预览'}),close=el(doc,'button',{type:'button',class:'dsh-rb-action'},'关闭全屏'),body=el(doc,'div',{class:'dsh-rb-artifact-dialog-body'});
  dialog.append(close,body);doc.body.append(dialog);const preview=previewFor(key,{mode:'fullscreen'});body.append(preview.node);
  const trigger=doc.activeElement;
  let ended=false;const end=()=>{if(ended)return;ended=true;preview.cleanup();dialog.remove();cleanups.delete(end);modals.delete(end);if(trigger?.isConnected)trigger.focus();};cleanups.add(end);modals.add(end);close.addEventListener('click',end);dialog.addEventListener('cancel',e=>{e.preventDefault();end();});
  if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');close.focus();
 }
 function previewFor(key,{mode='inline'}={}){
  const host=el(doc,'section',{class:'dsh-rb-artifact','data-dsh-rb-owned':'','data-mode':mode}),bar=el(doc,'div',{class:'dsh-rb-rich-bar'}),versions=el(doc,'select',{'aria-label':'作品版本',class:'dsh-rb-field-input dsh-rb-rich-select'}),status=el(doc,'p',{class:'dsh-rb-artifact-status',role:'status','aria-live':'polite'}),screen=el(doc,'div',{class:'dsh-rb-artifact-screen'}),editor=el(doc,'div',{class:'dsh-rb-artifact-editor'}),area=el(doc,'textarea',{class:'dsh-rb-field-input',spellcheck:'false','aria-label':'作品HTML源码',maxlength:'30000'});
  let frame=null,channel='',running=false,ended=false,active='',optionStamp='',editorOpen=false,lastState='',lastTheme='',themeObserver;
  const action=(label,fn)=>{const b=el(doc,'button',{type:'button',class:'dsh-rb-action'},label);b.addEventListener('click',()=>{try{fn();}catch(e){status.textContent=e.message;}});return b;};
  function stop(){running=false;view.removeEventListener('message',receive);themeObserver?.disconnect();themeObserver=null;frame?.remove();frame=null;channel='';screen.style.height='';run.textContent='运行预览';screen.textContent='点击“运行预览”打开作品。';}
  function start(){if(!preferences.getSnapshot().preferences.enabled){status.textContent='请先开启美化';return;}const r=store.get(key),v=store.current(key);if(!r||!v)return;stop();running=true;channel=view.crypto?.randomUUID?.()||'rb-'+Date.now()+'-'+Math.random().toString(36).slice(2);frame=el(doc,'iframe',{class:'dsh-rb-artifact-frame',title:r.title,sandbox:'allow-scripts',allow:"camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'; fullscreen 'none'",referrerpolicy:'no-referrer'});
   const p=preferences.getSnapshot().preferences,theme=doc.body.hasAttribute('data-ds-dark-theme')?'dark':'light';lastTheme=theme+'|'+p.preset;lastState=JSON.stringify(r.state);
   view.addEventListener('message',receive);if(view.MutationObserver){themeObserver=new view.MutationObserver(sync);themeObserver.observe(doc.body,{attributes:true,attributeFilter:['data-ds-dark-theme']});}
   frame.srcdoc=artifactDocument({...r,html:v.html},{channel,state:r.state,theme,preset:p.preset});screen.replaceChildren(frame);screen.style.height=mode==='inline'?r.height+'px':'';run.textContent='停止预览';status.textContent='正在载入作品…';
  }
  const run=action('运行预览',()=>running?stop():start()),edit=action('编辑源码',()=>{editorOpen=!editorOpen;editor.hidden=!editorOpen;edit.textContent=editorOpen?'收起源码':'编辑源码';if(editorOpen){area.value=store.get(key)?.draft??store.current(key)?.html??'';area.focus();}});
  bar.append(run,versions,edit);
  if(mode==='inline')bar.append(action('在侧栏打开',()=>{openSidebar(key);stop();}));
  if(mode!=='fullscreen')bar.append(action('全屏预览',()=>{stop();fullscreen(key);}));
  bar.append(action('复制当前源码',async()=>{try{await view.navigator.clipboard.writeText(store.current(key).html);status.textContent='当前源码已复制';}catch{editorOpen=true;editor.hidden=false;edit.textContent='收起源码';area.value=store.current(key).html;area.focus();area.select();status.textContent='请复制选中的源码';}}));
  versions.addEventListener('change',()=>store.activate(key,versions.value));
  const editBar=el(doc,'div',{class:'dsh-rb-rich-bar'});editBar.append(action('应用为新版本',()=>{store.edit(key,area.value);status.textContent=store.persistent()?'已保存本机修改，可通过版本菜单切换':'存储不可用，修改版仅保留在本次页面';}),action('恢复当前版本源码',()=>{area.value=store.current(key).html;store.draft(key,area.value);status.textContent='已恢复当前版本源码';}));
  area.addEventListener('input',()=>{store.draft(key,area.value);if(!store.persistent())status.textContent='存储不可用，源码草稿仅保留在本次页面';});editor.append(area,editBar);editor.hidden=true;host.append(bar,screen,editor,status);stop();
  function sync(){if(ended)return;const r=store.get(key),v=store.current(key);if(!r||!v){stop();status.textContent='此作品已超出本机保留范围，请重新打开原回复';return;}
   const stamp=r.versions.map(v=>v.key).join('|');if(stamp!==optionStamp){versions.replaceChildren(...r.versions.map(v=>el(doc,'option',{value:v.key},v.label)));optionStamp=stamp;}versions.value=r.active;
   const p=preferences.getSnapshot().preferences;host.dataset.preset=p.preset;
   const theme=(doc.body.hasAttribute('data-ds-dark-theme')?'dark':'light')+'|'+p.preset;
   if(active!==v.key||running&&theme!==lastTheme){active=v.key;if(running)start();if(editorOpen&&r.draft===null)area.value=v.html;}
   const state=JSON.stringify(r.state);if(running&&frame&&state!==lastState){lastState=state;frame.contentWindow?.postMessage({dshArtifact:channel,action:'restore',value:stateCopy(r.state)},'*');}
  }
  function receive(e){if(ended||!running||!frame||e.source!==frame.contentWindow||!e.data||e.data.dshArtifact!==channel)return;const d=e.data;
   if(d.action==='state'){try{store.saveState(key,d.value);status.textContent=store.persistent()?'作品状态已保存在本机':'本机存储不可用，状态仅保留在本次页面';}catch(err){status.textContent=err.message;}}
   else if(d.action==='error'&&typeof d.value==='string')status.textContent='作品运行错误：'+d.value.slice(0,300);
   else if(d.action==='ready')status.textContent=store.persistent()?'作品已就绪；已接入状态API的操作可在本机恢复':'作品已就绪；状态仅在本次页面保留';
  }
  const unsub=store.subscribe(sync),unpref=preferences.subscribe(()=>{if(!preferences.getSnapshot().preferences.enabled)stop();sync();});sync();
  const cleanup=own(()=>{if(ended)return;ended=true;stop();unsub();unpref();themeObserver?.disconnect();view.removeEventListener('message',receive);});
  return{node:host,cleanup,setVisible(visible){if(!visible)stop();}};
 }
 function mountSidebar(node,session){
  const shell=el(doc,'section',{class:'dsh-rb-artifact-library','data-dsh-rb-owned':''}),list=el(doc,'div',{class:'dsh-rb-rich-bar'}),body=el(doc,'div');shell.append(el(doc,'h3',{},'作品空间'),list,body);node.append(shell);let mountedKey,preview;
  function sync(){if(disposed)return;const keys=store.list(session),key=store.selected(session);list.replaceChildren();for(const k of keys){const b=el(doc,'button',{type:'button',class:'dsh-rb-action','aria-pressed':String(k===key)},store.get(k).title);b.addEventListener('click',()=>store.select(k));list.append(b);}
   if(key===mountedKey)return;preview?.cleanup();body.replaceChildren();mountedKey=key;
   if(key){preview=previewFor(key,{mode:'sidebar'});body.append(preview.node);}else body.append(el(doc,'p',{},'此对话还没有作品。在回复中的作品卡片选择“在侧栏打开”。'));
  }
  const unsub=store.subscribe(sync);sync();return own(()=>{unsub();preview?.cleanup();shell.remove();});
 }
 return{store,openSidebar,mountSidebar,
  render(model,source){const session=source.closest('[data-dsh-rb-session]')?.getAttribute('data-dsh-rb-session');const key=store.ingest(session,model);return previewFor(key);},
  dispose(){disposed=true;unmodals();for(const cleanup of [...cleanups])cleanup();cleanups.clear();modals.clear();store.dispose();}
 };
}
module.exports={createArtifactWorkspace,TAB_KIND,TAB_ID};
