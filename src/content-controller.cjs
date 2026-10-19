'use strict';
const { REPLY_SELECTOR } = require('./core.cjs');
const { parseContent } = require('./content-model.cjs');
const { el,renderContent,exportSvg } = require('./content-view.cjs');
const { renderInteractive } = require('./interactive-view.cjs');
const { attachDiagramViewports } = require('./diagram-viewport.cjs');
const { createInteractionState } = require('./interactive-state.cjs');
const {TYPES:RICH_TYPES}=require('./rich-model.cjs');
const LANGUAGE_SELECTOR='[data-code-block-banner] [class*="language"],[data-code-block-banner] [class*="infostring"],[class*="_infostring_"]';

function readBlock(block) {
  const content=block.querySelector('[data-code-block-content]') || block;
  const code=content.querySelector('code');
  // Native highlighted text has nested spans, but textContent retains source.
  const source=(code || content).textContent || '';
  const banner=block.querySelector(LANGUAGE_SELECTOR);
  let language=(banner?.textContent || code?.className?.match(/language-([\w-]+)/)?.[1] || '').trim();
  if(/^(?:代码块|code block)$/i.test(language))language='';
  return {language,source};
}
function createContentController(doc,store,{mountMath,artifactWorkspace,settleMs=650}={}) {
  const view=doc.defaultView;
  if (!view?.MutationObserver) return {dispose(){}};
  const entries=new Map(),byRoot=new Map(),pending=new Map(),blocksByRoot=new Map(),sourcesByFigure=new WeakMap();
  let storage;try{storage=view.localStorage;}catch{}
  const stateStore=createInteractionState(storage);
  let observer,disposed=false,enabled=false,timer=null,lastStyle='';
  const now=()=>view.performance?.now?.()??Date.now();
  function track(node,entry,root) {
    entry.root=root;entries.set(node,entry);sourcesByFigure.set(entry.figure,node);
    if(!byRoot.has(root))byRoot.set(root,new Set());byRoot.get(root).add(node);
  }
  function remove(node) {
    const entry=entries.get(node);if(!entry)return;
    try{entry.cleanup?.();}catch{}finally{
      entry.figure.remove();node.removeAttribute('data-dsh-rb-source');entries.delete(node);sourcesByFigure.delete(entry.figure);
      const nodes=byRoot.get(entry.root);nodes?.delete(node);if(!nodes?.size)byRoot.delete(entry.root);
      const block=blocksByRoot.get(entry.root)?.get(node);if(block){block.done=false;block.due=now()+settleMs;}
    }
  }
  function clear() {
    if(timer!==null)view.clearTimeout(timer);timer=null;pending.clear();
    [...entries.keys()].forEach(remove);byRoot.clear();blocksByRoot.clear();
  }
  function eligible(node) { return node.isConnected && node.closest(REPLY_SELECTOR) && !node.closest('[data-dsh-rb-owned]'); }
  function button(label,callback) { const b=el(doc,'button',{type:'button'},label);b.addEventListener('click',callback);return b; }
  function render(node,language,source) {
    if (!eligible(node) || entries.has(node)) return;
    const model=parseContent(language,source);
    if (!model) return;
    const p=store.getSnapshot().preferences;
    const figure=el(doc,'figure',{class:'dsh-rb-figure','data-dsh-rb-owned':'','data-preset':p.preset,'data-content-kind':model.kind || 'fallback'});
    figure.style.setProperty('--dsh-rb-content-gap',p.paragraph+'px');
    const toolbar=el(doc,'div',{class:'dsh-rb-toolbar'}),status=el(doc,'div',{class:'dsh-rb-status',role:'status','aria-live':'polite'});
    const interactive=['quiz','explorer','form','chart',...RICH_TYPES].includes(model.kind);
    const stateKey=interactive?stateStore.keyFor(node,source):null;
    const kind={fields:'结构图',flow:'流程图',chart:'数据图表',math:'公式',quiz:'选择与自测',explorer:'参数探索',form:'信息表单',table:'交互表格',calculator:'计算器',compare:'方案比较',schedule:'时间与排期',board:'清单与看板',tree:'层级与阅读',steps:'分步演示',wizard:'分支向导',diff:'内容对照',sources:'证据与来源',dashboard:'联动报告'}[model.kind] || '原文';
    toolbar.append(el(doc,'span',{class:'dsh-rb-toolbar-label'},model.kind==='artifact'?'交互作品':model.origin==='ascii'?'文本图 · 结构视图':kind));
    const viewport=el(doc,'div',{class:'dsh-rb-viewport',tabindex:'0','aria-label':`${kind}，宽内容可横向滚动`});
    let showSource=!!model.error,mathCleanup,interactiveCleanup,diagramCleanup;
    const sourceButton=button(showSource?'原文已显示':'查看原文',()=>{
      if(model.error)return;
      showSource=!showSource;
      node.setAttribute('data-dsh-rb-source',showSource?'shown':'hidden');viewport.hidden=showSource;
      entries.get(node)?.setVisible?.(!showSource);
      sourceButton.textContent=showSource?'返回图示':'查看原文';sourceButton.setAttribute('aria-pressed',String(showSource));
    });
    sourceButton.setAttribute('aria-pressed',String(showSource));
    if(model.error)sourceButton.disabled=true;
    toolbar.append(sourceButton,button('复制原文',async()=>{
      try {await view.navigator.clipboard.writeText(source);status.textContent='原文已复制';}
      catch {node.setAttribute('data-dsh-rb-source','shown');viewport.hidden=true;entries.get(node)?.setVisible?.(false);showSource=true;sourceButton.textContent='返回图示';sourceButton.setAttribute('aria-pressed','true');status.textContent='无法自动复制，请在上方原文中选择并复制';}
    }));
    figure.append(toolbar);
    if(model.title)figure.append(el(doc,'figcaption',{class:'dsh-rb-title'},model.title));
    figure.append(viewport,status);
    if(model.description)figure.append(el(doc,'p',{class:'dsh-rb-description'},model.description));
    const entry={figure,source,language,stateKey,cleanup:()=>{diagramCleanup?.();mathCleanup?.();interactiveCleanup?.();}};track(node,entry,node.closest(REPLY_SELECTOR));
    node.after(figure);
    if(model.error) { viewport.hidden=true;status.textContent=model.error;return; }
    try {
      const result=model.kind==='artifact'?artifactWorkspace.render(model,node):interactive?renderInteractive(doc,model,{stateStore,stateKey}):renderContent(doc,model,mountMath);viewport.append(result.node);interactiveCleanup=result.cleanup;entry.setVisible=result.setVisible;
      if(['flow','chart','explorer','table','dashboard'].includes(model.kind))diagramCleanup=attachDiagramViewports(viewport);
      if(model.kind==='math') {
        // Keep source visible until the native renderer has actually produced math.
        const mounted=result.mount?.();mathCleanup=mounted?.dispose;
        let attempts=0;
        const check=()=>{
          if(disposed || entries.get(node)!==entry)return;
          if(result.node.querySelector('.katex-error') || mounted?.failed?.()) {status.textContent='公式无法渲染，原文已保留';viewport.hidden=true;sourceButton.disabled=true;sourceButton.textContent='原文已显示';sourceButton.setAttribute('aria-pressed','true');return;}
          if(result.node.querySelector('.katex')) {if(!showSource)node.setAttribute('data-dsh-rb-source','hidden');return;}
          if(++attempts<20)mathTimer=view.setTimeout(check,50);
          else {status.textContent='公式渲染未完成，原文已保留';viewport.hidden=true;sourceButton.disabled=true;sourceButton.textContent='原文已显示';sourceButton.setAttribute('aria-pressed','true');}
        };
        let mathTimer=view.setTimeout(check,0);
        const disposeRoot=mathCleanup;mathCleanup=()=>{view.clearTimeout(mathTimer);disposeRoot?.();};
      } else node.setAttribute('data-dsh-rb-source','hidden');
      const svg=viewport.querySelector('svg');
      if(svg&&model.kind!=='chart')toolbar.append(button('导出 SVG',()=>{try{exportSvg(viewport.querySelector('svg'));status.textContent='已生成 SVG 文件';}catch{status.textContent='导出失败，仍可查看和复制原文';}}));
    } catch(error) {
      node.removeAttribute('data-dsh-rb-source');viewport.hidden=true;status.textContent=model.kind==='artifact'?'作品无法打开：'+String(error.message).slice(0,200)+'；原文已保留':'增强显示失败，原文已保留';sourceButton.disabled=true;sourceButton.textContent='原文已显示';
    }
  }
  function candidates(root) {
    return [...root.querySelectorAll('.md-code-block'),...root.querySelectorAll('p'),...root.querySelectorAll('img[alt]')].filter(n=>!n.closest('[data-dsh-rb-owned]')&&(n.matches('.md-code-block,img')||(/^\\\[[\s\S]*\\\]$/.test(n.textContent.trim()) && !n.querySelector('code,img,.katex'))));
  }
  function dataFor(node) {
    return node.matches('img')?{language:'image-alt',source:node.getAttribute('alt')||''}:node.matches('.md-code-block')?readBlock(node):{language:'math',source:node.textContent};
  }
  function delayFor(node,data,root) {
    // Structured components are complete only after the whole JSON validates.
    // For non-JSON diagrams, subsequent native Markdown is an end-of-block hint.
    let following=false;
    for(let n=node;n&&n!==root;n=n.parentElement){let s=n.nextElementSibling;while(s){if(!s.hasAttribute('data-dsh-rb-owned')&&s.textContent.trim()){following=true;break;}s=s.nextElementSibling;}if(following)break;}
    if(data.language!=='image-alt'&&(/^\s*\{[\s\S]*\}\s*$/.test(data.source)||following)){
      const model=parseContent(data.language,data.source);
      if(model&&!model.error)return Math.min(120,settleMs);
    }
    return settleMs;
  }
  function schedule(root) {
    if(!enabled || !root)return;
    if(!root.isConnected || !root.matches(REPLY_SELECTOR)) {
      [...(byRoot.get(root)||[])].forEach(remove);pending.delete(root);blocksByRoot.delete(root);return;
    }
    // If streaming updates a previously rendered block, reveal the updated native
    // source immediately; never leave a stale diagram in place.
    for(const node of [...(byRoot.get(root)||[])]) {
      const entry=entries.get(node);
      if(!eligible(node)||node.closest(REPLY_SELECTOR)!==root||!entry.figure.isConnected){remove(node);continue;}
      if(entry.image){if(entry.figure.textContent!==node.getAttribute('alt')?.trim())remove(node);continue;}
      const next=node.matches('.md-code-block')?readBlock(node):{language:'math',source:node.textContent};
      if(next.source!==entry.source || next.language!==entry.language)remove(node);
      else if(entry.stateKey&&entry.stateKey!==stateStore.keyFor(node,next.source))remove(node);
    }
    const blocks=blocksByRoot.get(root)||new Map(),present=new Set(candidates(root));let due=Infinity;
    blocksByRoot.set(root,blocks);
    for(const node of present){
      const data=dataFor(node);let block=blocks.get(node);
      if(!block||block.source!==data.source||block.language!==data.language){block={...data,due:now()+delayFor(node,data,root),done:entries.has(node)};blocks.set(node,block);}
      if(!block.done){
        // A following paragraph can confirm a previously open Mermaid block.
        block.due=Math.min(block.due,now()+delayFor(node,data,root));
        due=Math.min(due,block.due);
      }
    }
    for(const node of blocks.keys())if(!present.has(node)){blocks.delete(node);remove(node);}
    if(due<Infinity)pending.set(root,due);else pending.delete(root);
  }
  function renderRoot(root) {
      if(!enabled || !root.isConnected || !root.matches(REPLY_SELECTOR))return;
      const blocks=blocksByRoot.get(root);if(!blocks)return;
      const started=now();let count=0;
      for(const [node,block] of blocks) {
        if(!eligible(node)){blocks.delete(node);remove(node);continue;}
        if(block.done||block.due>now())continue;
        const data=dataFor(node);
        if(data.source!==block.source||data.language!==block.language){blocks.set(node,{...data,done:false,due:now()+delayFor(node,data,root)});continue;}
        block.done=true;
        if(data.language==='image-alt')renderImage(node,root);else render(node,data.language,data.source);
        if(++count>=8||now()-started>=8)break;
      }
      let due=Infinity;for(const b of blocks.values())if(!b.done)due=Math.min(due,b.due);
      if(due<Infinity)pending.set(root,due);
  }
  function renderImage(img,root) {
      // Preserve native image/lightbox behavior. Add only an adjacent caption.
        if(entries.has(img) || img.closest('[data-dsh-rb-owned]'))return;
        const alt=img.getAttribute('alt')?.trim();
        if(!alt || alt.length>400 || /^(?:(?:image|img|图片|图像)$|https?:\/\/|[\w.-]+\.(?:png|jpg|jpeg|gif|svg|webp)$)/i.test(alt))return;
        const parent=img.closest('p');
        if(!parent || parent.textContent.trim() || parent.querySelectorAll('img').length!==1)return;
        const figure=el(doc,'span',{class:'dsh-rb-image-caption','data-dsh-rb-owned':''},alt);parent.after(figure);track(img,{figure,image:true},root);
  }
  // Per-block deadlines share one timer; prose cannot postpone completed blocks.
  // Historical replies are rendered in
  // bounded batches, yielding between batches instead of blocking one long task.
  function arm() {
    if(timer!==null)view.clearTimeout(timer);timer=null;
    if(!enabled||disposed||!pending.size)return;
    let due=Infinity;for(const t of pending.values())due=Math.min(due,t);
    timer=view.setTimeout(flush,Math.max(0,due-now()));
  }
  function flush() {
    timer=null;if(!enabled||disposed)return;
    const started=now();let count=0;
    for(const [root,due] of pending)if(due<=now()) {
      pending.delete(root);renderRoot(root);
      if(++count>=6||now()-started>=8)break;
    }
    arm();
  }
  function collect(node,roots) {
    const target=node.nodeType===1?node:node.parentElement;
    if(!target || target.closest('[data-dsh-rb-owned]'))return;
    if(byRoot.has(target)||pending.has(target)||blocksByRoot.has(target))roots.add(target);
    const nearest=target.closest(REPLY_SELECTOR);if(nearest)roots.add(nearest);
    target.querySelectorAll?.(REPLY_SELECTOR).forEach(root=>roots.add(root));
    // Native rows/Markdown nodes may be reused with different role/class attrs.
    // Include formerly tracked roots even if the current selector no longer fits.
    target.querySelectorAll?.('[class*="_markdown_"]').forEach(root=>{if(byRoot.has(root)||pending.has(root)||blocksByRoot.has(root))roots.add(root);});
  }
  function detached(node) {
    if(node.isConnected)return;
    for(const item of [node,...(node.querySelectorAll?.('*')||[])]) {
      if(entries.has(item))remove(item);
      if(byRoot.has(item))[...byRoot.get(item)].forEach(remove);
      pending.delete(item);blocksByRoot.delete(item);
    }
  }
  function start() {
    if(observer)return;
    observer=new view.MutationObserver(records=>{
      const roots=new Set();
      for(const record of records) {
        if(record.type==='characterData' || record.type==='attributes')collect(record.target,roots);
        else {
          const changes=[...record.addedNodes,...record.removedNodes];
          if(changes.length && changes.every(n=>n.nodeType===1 && n.hasAttribute('data-dsh-rb-owned'))){
            for(const figure of record.removedNodes){const source=sourcesByFigure.get(figure);if(source&&!figure.isConnected){remove(source);collect(source,roots);}}
            continue;
          }
          collect(record.target,roots);record.addedNodes.forEach(n=>collect(n,roots));record.removedNodes.forEach(detached);
        }
      }
      roots.forEach(schedule);arm();
    });
    observer.observe(doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['alt','class','data-dsh-rb-session','data-chat-flow-kind','data-chat-group-part','data-chat-node-key','data-markdown-variant']});
    doc.querySelectorAll(REPLY_SELECTOR).forEach(schedule);arm();
  }
  function update() {
    const p=store.getSnapshot().preferences;enabled=p.enabled;
    if(!enabled) {observer?.disconnect();observer=null;clear();return;}
    const style=p.preset+'|'+p.paragraph;
    if(style!==lastStyle){entries.forEach(e=>{if(!e.image){e.figure.dataset.preset=p.preset;e.figure.style.setProperty('--dsh-rb-content-gap',p.paragraph+'px');}});lastStyle=style;}
    start();
  }
  const unsubscribe=store.subscribe(update);update();
  return {dispose(){disposed=true;enabled=false;unsubscribe();observer?.disconnect();observer=null;clear();}};
}
module.exports={readBlock,createContentController};
