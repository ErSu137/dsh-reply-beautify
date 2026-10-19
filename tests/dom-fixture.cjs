// Small DOM contract fixture for renderer events/lifecycle, not a visual browser.
function documentFixture(){
 let next=0;const intervals=new Map(),frames=new Map(),downloads=[];
 class Node{
  constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.attributes={};this.children=[];this.parentElement=null;this.listeners={};this.style={setProperty:(k,v)=>{this.attributes['style:'+k]=v;}};this.value='';this.open=false;this.checked=false;this._text='';}
  setAttribute(k,v){this.attributes[k]=String(v);if(k==='value')this.value=String(v);if(k==='id')this.id=String(v);if(k==='type')this.type=String(v);if(k==='name')this.name=String(v);}
  getAttribute(k){return this.attributes[k]??null;}removeAttribute(k){delete this.attributes[k];}
  toggleAttribute(k,force){const set=force??!Object.hasOwn(this.attributes,k);if(set)this.setAttribute(k,'');else this.removeAttribute(k);return set;}
  get className(){return this.attributes.class||'';}set className(v){this.attributes.class=v;}
  get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}set textContent(v){this.children.forEach(n=>n.parentElement=null);this.children=[];this._text=String(v);}
  append(...nodes){for(let n of nodes){if(typeof n!=='object')n=this.ownerDocument.createTextNode(String(n));n.remove();n.parentElement=this;this.children.push(n);}}
  replaceChildren(...nodes){this.children.forEach(n=>n.parentElement=null);this.children=[];this._text='';this.append(...nodes);}
  remove(){if(this.parentElement){const p=this.parentElement;p.children=p.children.filter(n=>n!==this);this.parentElement=null;}}
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
  dispatch(name,props={}){const e={target:this,button:0,preventDefault(){},...props};for(const fn of this.listeners[name]||[])fn(e);}
  click(){if(this.tagName==='a')downloads.push(this.attributes);this.dispatch('click');}
  focus(){this.ownerDocument.activeElement=this;}select(){}scrollIntoView(){}
  get nextElementSibling(){return this.parentElement?.children[this.parentElement.children.indexOf(this)+1]||null;}
  get isConnected(){let p=this;while(p.parentElement)p=p.parentElement;return p===this.ownerDocument.body;}
  matches(s){if(s==='*')return true;const tag=/^[\w-]+/.exec(s)?.[0];if(tag&&this.tagName!==tag)return false;for(const m of s.matchAll(/\.([\w-]+)|#([\w-]+)|\[([^\]=]+)(?:=["']?([^\]"']*)["']?)?\]/g)){if(m[1]&&!this.className.split(' ').includes(m[1]))return false;if(m[2]&&this.id!==m[2])return false;if(m[3]&&(this.getAttribute(m[3])===null||m[4]!==undefined&&this.getAttribute(m[3])!==m[4]))return false;}return true;}
  querySelectorAll(selector){const out=[];const match=(n,s)=>{const parts=s.trim().split(/\s+/);if(!n.matches(parts.pop()))return false;let p=n.parentElement;while(parts.length){const part=parts.pop();while(p&&!p.matches(part))p=p.parentElement;if(!p)return false;p=p.parentElement;}return true;};const visit=n=>{for(const c of n.children){if(selector.split(',').some(s=>match(c,s)))out.push(c);visit(c);}};visit(this);return out;}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
 }
 const doc={createElement(tag){const n=new Node(tag,doc);if(tag==='canvas')n.getContext=()=>({measureText:s=>({width:s.length*7})});return n;},createElementNS(ns,tag){return this.createElement(tag);},createTextNode(s){const n=new Node('#text',doc);n.textContent=s;return n;}};
 doc.body=doc.createElement('body');doc.defaultView={navigator:{clipboard:{writeText:async v=>{doc.copied=v;}}},Blob:globalThis.Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout:fn=>{fn();return++next;},setInterval:fn=>{const id=++next;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id),requestAnimationFrame:fn=>{const id=++next;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)};
 doc.flush=()=>{for(const [id,fn]of [...frames]){frames.delete(id);fn();}};doc.tick=()=>{for(const fn of [...intervals.values()])fn();};doc.timerCount=()=>intervals.size;doc.downloads=downloads;
 return doc;
}
module.exports={documentFixture};
