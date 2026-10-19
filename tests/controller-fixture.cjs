'use strict';
// Deterministic DOM/observer/clock contracts. No browser or visual rendering.
const {documentFixture}=require('./dom-fixture.cjs');
function controllerFixture(){
 const doc=documentFixture(),proto=Object.getPrototypeOf(doc.body);
 const split=(s,comma=false)=>{let depth=0,quote='',part='',out=[];for(const c of s){if(quote){part+=c;if(c===quote)quote='';continue;}if(c==='"'||c==="'"){quote=c;part+=c;continue;}if(c==='['||c==='(')depth++;if(c===']'||c===')')depth--;if(!depth&&(comma?c===',':/\s/.test(c))){if(part)out.push(part);part='';}else part+=c;}if(part)out.push(part);return out;};
 function simple(n,s){let rejected=false;s=s.replace(/:not\(([^()]*)\)/g,(_,v)=>{if(simple(n,v))rejected=true;return'';});if(rejected)return false;
  const tag=/^[\w-]+/.exec(s)?.[0];if(tag&&n.tagName!==tag)return false;
  for(const m of s.matchAll(/\[([\w-]+)(?:([*^$]?=)(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/g)){const v=n.getAttribute(m[1]),want=m[3]??m[4]??m[5];if(v===null)return false;if(m[2]==='='&&v!==want||m[2]==='^='&&!v.startsWith(want)||m[2]==='$='&&!v.endsWith(want)||m[2]==='*='&&!v.includes(want))return false;}
  s=s.replace(/\[[^\]]*\]/g,'');for(const m of s.matchAll(/\.([\w-]+)|#([\w-]+)/g)){if(m[1]&&!n.className.split(' ').includes(m[1])||m[2]&&n.getAttribute('id')!==m[2])return false;}return true;
 }
 proto.matches=function(selector){return split(selector,true).some(s=>{const parts=split(s);if(!simple(this,parts.pop()))return false;let p=this.parentElement;while(parts.length){const part=parts.pop();while(p&&!simple(p,part))p=p.parentElement;if(!p)return false;p=p.parentElement;}return true;});};
 proto.querySelectorAll=function(selector){const out=[];function visit(n){for(const child of n.children){if(child.matches(selector))out.push(child);visit(child);}}visit(this);return out;};
 proto.closest=function(s){let n=this;while(n){if(n.matches(s))return n;n=n.parentElement;}return null;};
 proto.hasAttribute=function(k){return this.getAttribute(k)!==null;};
 proto.contains=function(n){while(n){if(n===this)return true;n=n.parentElement;}return false;};
 proto.after=function(n){const p=this.parentElement;if(!p)return;n.remove();n.parentElement=p;p.children.splice(p.children.indexOf(this)+1,0,n);};
 Object.defineProperty(proto,'nodeType',{get(){return this.tagName==='#text'?3:1;}});
 Object.defineProperty(proto,'dataset',{get(){const n=this;return new Proxy({},{get:(_,k)=>n.getAttribute('data-'+k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())),set:(_,k,v)=>{n.setAttribute('data-'+k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),v);return true;}});}});
 doc.querySelectorAll=s=>[...(doc.body.matches(s)?[doc.body]:[]),...doc.body.querySelectorAll(s)];doc.querySelector=s=>doc.querySelectorAll(s)[0]||null;
 let clock=0,next=0;const timers=new Map(),observers=new Set(),values=new Map(),events=new Map();
 const createElement=doc.createElement;doc.createElement=tag=>{const n=createElement(tag);if(tag==='iframe')n.contentWindow={messages:[],postMessage(value){this.messages.push(value);}};return n;};
 Object.assign(doc.defaultView,{performance:{now:()=>clock},localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},
  addEventListener(type,fn){if(!events.has(type))events.set(type,new Set());events.get(type).add(fn);},removeEventListener(type,fn){events.get(type)?.delete(fn);},
  setTimeout(fn,ms=0){const id=++next;timers.set(id,{at:clock+ms,fn});return id;},clearTimeout:id=>timers.delete(id),
  MutationObserver:class{constructor(fn){this.fn=fn;}observe(target,options){this.target=target;this.options=options;observers.add(this);}disconnect(){observers.delete(this);}}
 });
 const firstTimer=()=>[...timers].sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
 doc.runNext=()=>{const item=firstTimer();if(!item)return false;timers.delete(item[0]);clock=item[1].at;item[1].fn();return true;};
 doc.advance=ms=>{const end=clock+ms;let guard=10000;while(firstTimer()?.[1].at<=end){if(!--guard)throw Error('timer loop');doc.runNext();}clock=end;};
 doc.pendingTimers=()=>timers.size;doc.observerCount=()=>observers.size;doc.notify=records=>{for(const o of [...observers])o.fn(records);};doc.storageValues=values;
 doc.message=(source,data)=>{for(const fn of [...(events.get('message')||[])])fn({source,data});};doc.listenerCount=()=>[...events.values()].reduce((n,s)=>n+s.size,0);
 doc.change=(target,type='characterData',extra={})=>doc.notify([{type,target,addedNodes:[],removedNodes:[],...extra}]);
 doc.session=doc.createElement('main');doc.session.setAttribute('data-dsh-rb-session','session-a');doc.body.append(doc.session);
 let seq=0;
 doc.reply=(source,{kind='assistant-step',part='response',language='mermaid'}={})=>{
  const row=doc.createElement('section');row.setAttribute('data-chat-flow-kind',kind);row.setAttribute('data-chat-group-part',part);row.setAttribute('data-chat-node-key','node-'+(++seq));
  const md=doc.createElement('div');md.className='_markdown_fixture';row.append(md);doc.session.append(row);
  const block=doc.createElement('div');block.className='md-code-block';const banner=doc.createElement('div');banner.setAttribute('data-code-block-banner','');const info=doc.createElement('span');info.className='_infostring_fixture';info.textContent=language;banner.append(info);
  const content=doc.createElement('div');content.setAttribute('data-code-block-content','');const code=doc.createElement('code');code.textContent=source;content.append(code);block.append(banner,content);md.append(block);
  return{row,md,block,code,info};
 };
 return doc;
}
module.exports={controllerFixture};
