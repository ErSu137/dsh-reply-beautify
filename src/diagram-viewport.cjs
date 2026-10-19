'use strict';

// Display-only sizing. Never change the SVG viewBox, data or exported geometry.
function automaticSize(width,height,available,screenHeight=1000) {
  const ratio=width/height,extreme=ratio>5||ratio<1/3;
  const heightLimit=Math.max(240,Math.min(720,screenHeight*.72));
  const scale=Math.min(1,8192/width,8192/height,
    extreme?1:Math.min(Math.max(1,available)/width,heightLimit/height));
  return {width:width*scale,height:height*scale,extreme};
}
function zoomFactor(current,delta,base) {
  const maximum=Math.min(4,8192/base.width,8192/base.height);
  return Math.max(.25,Math.min(maximum,current*Math.exp(-Math.max(-240,Math.min(240,delta))*.002)));
}
function wheelDelta(event,pageHeight) {
  return event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?pageHeight:1);
}
function attachDiagramViewports(root) {
  const doc=root.ownerDocument,view=doc.defaultView;
  if(!view?.MutationObserver||typeof root.getBoundingClientRect!=='function')return ()=>{};
  const records=new Map();let disposed=false;
  function create(svg) {
    const box=(svg.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);
    const width=box.length===4?box[2]:Number(svg.getAttribute('width'));
    const height=box.length===4?box[3]:Number(svg.getAttribute('height'));
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return;
    const originalStyle=svg.getAttribute('style');
    const node=(tag,className,text)=>{const n=doc.createElement(tag);n.className=className;if(text)n.textContent=text;return n;};
    const shell=node('div','dsh-rb-diagram-view'),bar=node('div','dsh-rb-zoom-bar');
    bar.setAttribute('role','group');bar.setAttribute('aria-label','图形显示缩放');
    const scroll=node('div','dsh-rb-diagram-scroll');scroll.tabIndex=0;
    scroll.setAttribute('role','region');scroll.setAttribute('aria-label','图形；图上滚轮缩放，双击或自动按钮恢复，放大后可滚动查看');
    const readout=node('output','dsh-rb-zoom-value'),hint=node('span','dsh-rb-zoom-hint','图上滚轮缩放 · 双击恢复');
    readout.setAttribute('aria-label','相对于自动尺寸的缩放比例');
    let factor=1,base,lastWidth=0,lastHeight=0;
    const listeners=[];
    const listen=(target,type,fn,options)=>{target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));};
    function layout() {
      if(disposed||!shell.isConnected||!scroll.clientWidth)return;
      base=automaticSize(width,height,scroll.clientWidth,view.innerHeight);
      factor=Math.min(factor,Math.min(4,8192/base.width,8192/base.height));
      const w=base.width*factor,h=base.height*factor;
      if(w!==lastWidth||h!==lastHeight){
        svg.style.setProperty('width',w+'px');svg.style.setProperty('height',h+'px');
        lastWidth=w;lastHeight=h;
      }
      readout.textContent=Math.round(factor*100)+'%';
      shell.setAttribute('data-extreme',String(base.extreme));
      minus.disabled=factor<=.25001;
      plus.disabled=factor>=Math.min(4,8192/base.width,8192/base.height)-.00001;
      auto.setAttribute('aria-pressed',String(Math.abs(factor-1)<.00001));
    }
    function zoom(next,point) {
      if(!base)return;
      const before=svg.getBoundingClientRect();
      const x=point?.clientX??before.left+Math.min(scroll.clientWidth,before.width)/2;
      const y=point?.clientY??before.top+Math.min(scroll.clientHeight,before.height)/2;
      const fx=(x-before.left)/before.width,fy=(y-before.top)/before.height;
      factor=next;layout();
      const after=svg.getBoundingClientRect();
      scroll.scrollLeft+=after.left+fx*after.width-x;
      scroll.scrollTop+=after.top+fy*after.height-y;
    }
    const button=(text,label,action)=>{const b=node('button','dsh-rb-zoom-button',text);b.type='button';b.setAttribute('aria-label',label);listen(b,'click',action);return b;};
    const minus=button('−','缩小图形',()=>zoom(zoomFactor(factor,100,base)));
    const plus=button('+','放大图形',()=>zoom(zoomFactor(factor,-100,base)));
    const reset=()=>{factor=1;layout();scroll.scrollLeft=0;scroll.scrollTop=0;};
    const auto=button('自动','恢复图形自动尺寸',reset);
    bar.append(minus,readout,plus,auto,hint);shell.append(bar,scroll);
    svg.before(shell);scroll.append(svg);
    svg.setAttribute('data-dsh-rb-sized','');
    listen(svg,'wheel',event=>{
      if(event.ctrlKey||event.metaKey||!Number.isFinite(event.deltaY)||!event.deltaY||!base)return;
      const next=zoomFactor(factor,wheelDelta(event,scroll.clientHeight),base);
      if(Math.abs(next-factor)<.00001)return;
      event.preventDefault();zoom(next,event);
    },{passive:false});
    listen(svg,'dblclick',reset);
    listen(scroll,'keydown',event=>{
      if(event.target!==scroll||event.ctrlKey||event.metaKey||event.altKey||!base)return;
      if(event.key==='+'||event.key==='='){event.preventDefault();zoom(zoomFactor(factor,-100,base));}
      else if(event.key==='-'){event.preventDefault();zoom(zoomFactor(factor,100,base));}
      else if(event.key==='0'){event.preventDefault();reset();}
    });
    const record={layout,dispose(){
      resize?.unobserve(scroll);listeners.forEach(fn=>fn());
      svg.removeAttribute('data-dsh-rb-sized');
      if(originalStyle===null)svg.removeAttribute('style');else svg.setAttribute('style',originalStyle);
      if(shell.parentElement){shell.before(svg);shell.remove();}
    }};
    records.set(svg,record);resize?.observe(scroll);layout();
  }
  const resize=view.ResizeObserver?new view.ResizeObserver(entries=>{
    for(const entry of entries)for(const [svg,record]of records)if(svg.parentElement===entry.target)record.layout();
  }):null;
  function scan() {
    if(disposed)return;
    for(const [svg,record]of records)if(!root.contains(svg)){record.dispose();records.delete(svg);}
    for(const svg of root.querySelectorAll('svg.dsh-rb-svg'))if(!records.has(svg))create(svg);
  }
  const observer=new view.MutationObserver(records=>{
    if(records.some(r=>r.type==='childList'&&[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1)))scan();
  });
  // Observe only this owned component, including plots rebuilt by filtering/sliders.
  observer.observe(root,{subtree:true,childList:true});scan();
  const onResize=()=>{for(const record of records.values())record.layout();};
  view.addEventListener('resize',onResize);
  return ()=>{disposed=true;observer.disconnect();resize?.disconnect();view.removeEventListener('resize',onResize);for(const record of records.values())record.dispose();records.clear();};
}
module.exports={automaticSize,zoomFactor,wheelDelta,attachDiagramViewports};
