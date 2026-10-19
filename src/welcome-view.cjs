'use strict';
const {welcomeLayout}=require('./welcome-model.cjs');
const HERO='[data-conversation-content][data-content-phase="hero"]';
function createWelcomeController(doc,preferences,{assets}={}){
  const view=doc.defaultView;
  if(!view?.MutationObserver||!doc.body||!doc.querySelectorAll)return{dispose(){}};
  assets=assets||require('./welcome-assets.cjs');
  let entry=null,disposed=false,frame=null,observer=null,appearance=0,listening=false;
  const set=(node,name,value)=>{if(node.style.getPropertyValue(name)!==value)node.style.setProperty(name,value);};
  function clear(){
    if(!entry)return;
    const old=entry;entry=null;old.resize?.disconnect();
    view.removeEventListener('scroll',queue,true);
    old.img.removeEventListener('load',old.loaded);old.img.removeEventListener('error',old.failed);
    old.img.removeAttribute('src');old.shell.remove();
    old.seat.removeAttribute('data-dsh-rb-welcome-seat');
    if(old.oldLane)old.seat.style.setProperty('--dsh-rb-welcome-lane',old.oldLane,old.oldPriority);
    else old.seat.style.removeProperty('--dsh-rb-welcome-lane');
  }
  function position(){
    if(!entry||entry.error)return;
    const {content,composer,seat,shell,img,bubble}=entry,r=content.getBoundingClientRect();
    const left=Math.max(0,r.left),top=Math.max(0,r.top),right=Math.min(view.innerWidth,r.right),bottom=Math.min(view.innerHeight,r.bottom);
    const width=right-left,height=bottom-top;
    const protectedNode=width>=900&&height>=520?composer.querySelector('[data-composer-card]')||composer:composer;
    const c=protectedNode.getBoundingClientRect();
    const layout=welcomeLayout(width,height,entry.preset,{x:c.left-left,y:c.top-top,width:c.width,height:c.height});
    shell.hidden=!layout;
    if(!layout){seat.removeAttribute('data-dsh-rb-welcome-seat');return;}
    for(const [name,value]of Object.entries({left,top,width,height}))set(shell,name,value+'px');
    for(const [node,box]of [[img,layout.image],[bubble,layout.bubble]]){
      for(const [name,value]of Object.entries({left:box.x,top:box.y,width:box.width,height:box.height}))set(node,name,value+'px');
    }
    if(layout.lane){set(seat,'--dsh-rb-welcome-lane',layout.lane+'px');if(!seat.hasAttribute('data-dsh-rb-welcome-seat'))seat.setAttribute('data-dsh-rb-welcome-seat','');}
    else seat.removeAttribute('data-dsh-rb-welcome-seat');
  }
  function sync(){
    if(disposed)return;
    const p=preferences.getSnapshot().preferences;
    if(!p.enabled||!p.welcomeMascot){clear();return;}
    const content=[...doc.querySelectorAll(HERO)].find(node=>{
      if(node.classList?.contains('Dc7zOa_embeddedBody')||!node.closest('.Dc7zOa_root[data-phase="hero"]'))return false;
      const r=node.getBoundingClientRect?.();return r&&r.width>0&&r.height>0&&view.getComputedStyle(node).visibility!=='hidden';
    });
    const composer=content?.querySelector('.Dc7zOa_composerHero'),seat=composer?.closest('[data-composer-seat]');
    if(!content||!composer||!seat){clear();return;}
    const session=content.getAttribute('data-conversation-session')||'';
    if(entry&&(entry.content!==content||entry.composer!==composer||entry.preset!==p.preset||entry.session!==session))clear();
    if(!entry){
      const shell=doc.createElement('div'),img=doc.createElement('img'),bubble=doc.createElement('div');
      shell.className='dsh-rb-welcome';shell.setAttribute('data-dsh-rb-owned','');shell.setAttribute('data-dsh-rb-welcome','');shell.setAttribute('data-preset',p.preset);shell.setAttribute('aria-hidden','true');shell.setAttribute('data-appearance',String(++appearance));
      img.className='dsh-rb-welcome-character';img.alt='';img.draggable=false;img.decoding='async';
      bubble.className='dsh-rb-welcome-bubble';for(const text of ['你好，请问','可以怎么帮你']){const line=doc.createElement('span');line.textContent=text;bubble.append(line);}shell.append(img,bubble);
      const current={content,composer,seat,shell,img,bubble,preset:p.preset,session,oldLane:seat.style.getPropertyValue('--dsh-rb-welcome-lane'),oldPriority:seat.style.getPropertyPriority('--dsh-rb-welcome-lane')};
      current.loaded=()=>{if(entry===current&&!current.error)shell.setAttribute('data-ready','');};
      current.failed=()=>{if(entry!==current)return;current.error=true;current.resize?.disconnect();view.removeEventListener('scroll',queue,true);shell.hidden=true;seat.removeAttribute('data-dsh-rb-welcome-seat');};
      img.addEventListener('load',current.loaded);img.addEventListener('error',current.failed);entry=current;
      doc.body.append(shell);
      view.addEventListener('scroll',queue,true);
      if(view.ResizeObserver){current.resize=new view.ResizeObserver(()=>queue());current.resize.observe(content);current.resize.observe(composer);}
      position();img.src=assets[p.preset]||assets.default;
    }else position();
  }
  function queue(){if(disposed||frame!==null)return;frame=view.requestAnimationFrame(()=>{frame=null;sync();});}
  function relevant(record){
    const target=record.target.nodeType===1?record.target:record.target.parentElement;
    if(target?.closest('[data-dsh-rb-owned]'))return false;
    if(record.type==='attributes')return target?.matches('[data-conversation-content],.Dc7zOa_root')||target?.contains(entry?.content)||!entry&&!!target?.querySelector?.(HERO);
    const changed=[...record.addedNodes,...record.removedNodes].filter(n=>n.nodeType===1&&!n.hasAttribute('data-dsh-rb-owned'));
    if(!changed.length)return false;
    if(target?.closest('[data-conversation-content][data-content-phase="active"]'))return false;
    return true;
  }
  function update(){
    const p=preferences.getSnapshot().preferences;
    if(!p.enabled||!p.welcomeMascot){observer?.disconnect();observer=null;if(listening)view.removeEventListener('resize',queue);listening=false;if(frame!==null)view.cancelAnimationFrame(frame);frame=null;clear();return;}
    if(!listening){view.addEventListener('resize',queue);listening=true;}
    if(!observer){observer=new view.MutationObserver(records=>{if(records.some(relevant))queue();});observer.observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-content-phase','data-conversation-session','data-phase','hidden','aria-hidden','class','style']});}
    sync();
  }
  const off=preferences.subscribe(update);update();
  return{dispose(){disposed=true;off();observer?.disconnect();if(frame!==null)view.cancelAnimationFrame(frame);view.removeEventListener('resize',queue);view.removeEventListener('scroll',queue,true);clear();}};
}
module.exports={createWelcomeController};
