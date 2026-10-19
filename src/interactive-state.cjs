'use strict';
const KEY='dsh.reply-beautify.interactions.v1',MAX_RECORDS=80,MAX_BYTES=280000,MAX_MEMORY_RECORDS=160,MAX_MEMORY_CHARS=560000;
function fingerprint(s){let a=2166136261,b=3339675911;for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b^s.charCodeAt(i),2246822519);}return(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');}
function createInteractionState(storage){let records=Object.create(null),available=typeof storage?.getItem==='function'&&typeof storage?.setItem==='function',stamp=Date.now(),chars=0;const memory=new Map(),nodes=new WeakMap(),failed=new Set();let seq=0;
 function markFailed(key){if(typeof key==='string'){failed.add(key);if(failed.size>MAX_MEMORY_RECORDS)failed.delete(failed.values().next().value);}return false;}
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
 try{const raw=storage?.getItem(KEY);if(raw&&raw.length<=300000){const parsed=JSON.parse(raw);if(parsed?.schema===1&&object(parsed.entries)){
  const valid=Object.entries(parsed.entries).filter(([k,v])=>k.startsWith('p:')&&object(v)&&Number.isFinite(v.updated)&&object(v.state)).sort((a,b)=>b[1].updated-a[1].updated).slice(0,MAX_RECORDS);
  records=Object.fromEntries(valid);for(const [,v]of valid)stamp=Math.max(stamp,v.updated);
 }}}catch{available=false;}
 function remember(key,text){if(memory.has(key)){chars-=memory.get(key).length;memory.delete(key);}memory.set(key,text);chars+=text.length;
  while(memory.size>MAX_MEMORY_RECORDS||chars>MAX_MEMORY_CHARS){const first=memory.keys().next().value;chars-=memory.get(first).length;memory.delete(first);failed.delete(first);}
 }
 function keyFor(node,source){const session=node.closest('[data-dsh-rb-session]')?.getAttribute('data-dsh-rb-session'),row=node.closest('[data-chat-node-key]');const id=row?.getAttribute('data-chat-node-key');
  if(session&&id){const blocks=[...row.querySelectorAll('.md-code-block,p')].filter(n=>!n.closest('[data-dsh-rb-owned]'));return'p:'+fingerprint(session+'\n'+id+'\n'+blocks.indexOf(node)+'\n'+source);}
  if(!nodes.has(node))nodes.set(node,++seq);return'm:'+nodes.get(node)+':'+fingerprint(source);
 }
 return{keyFor,load(key){try{const cached=memory.get(key);if(cached){remember(key,cached);return JSON.parse(cached);}const value=records[key]?.state;return object(value)?JSON.parse(JSON.stringify(value)):{};}catch{return{};}},
  save(key,state){let text;try{if(typeof key!=='string'||!object(state))return markFailed(key);text=JSON.stringify(state);if(text.length>MAX_BYTES)return markFailed(key);JSON.parse(text);}catch{return markFailed(key);}
   remember(key,text);if(!key.startsWith('p:'))return false;
   stamp=Math.max(stamp+1,Date.now());const next={...records,[key]:{updated:stamp,state:JSON.parse(text)}};
   const sorted=Object.entries(next).sort((a,b)=>b[1].updated-a[1].updated).slice(0,MAX_RECORDS),proposal=Object.fromEntries(sorted);
   try{let value=JSON.stringify({schema:1,entries:proposal});while(value.length>MAX_BYTES&&Object.keys(proposal).length>1){delete proposal[Object.keys(proposal).at(-1)];value=JSON.stringify({schema:1,entries:proposal});}if(value.length>MAX_BYTES)throw Error('state too large');storage.setItem(KEY,value);records=proposal;available=true;failed.delete(key);return true;}catch{available=false;return markFailed(key);}
  },
  persistent(key){if(!available||typeof key!=='string'||!key.startsWith('p:')||failed.has(key))return false;const cached=memory.get(key);return !cached||JSON.stringify(records[key]?.state)===cached;}
 };
}
module.exports={KEY,fingerprint,createInteractionState};
