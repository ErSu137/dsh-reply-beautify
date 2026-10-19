'use strict';
const {normalizeArtifact,stateCopy,MAX_HTML}=require('./artifact-model.cjs');
const {fingerprint}=require('./interactive-state.cjs');
const KEY='dsh.reply-beautify.artifacts.v1';
function createArtifactStore(storage){
 let records=Object.create(null),selected=Object.create(null),available=!!storage,snapshot=0,stamp=Date.now();const listeners=new Set();
 try{const raw=storage?.getItem(KEY);if(raw&&raw.length<=1800000){const d=JSON.parse(raw);if(d?.schema===1&&d.records&&typeof d.records==='object'){
  for(const [key,r]of Object.entries(d.records).slice(0,12)){
   if(!r||typeof r.session!=='string'||typeof r.id!=='string'||key!=='a:'+fingerprint(r.session+'\n'+r.id)||!Array.isArray(r.versions)||!r.versions.length)continue;
   const versions=r.versions.filter(v=>v&&typeof v.key==='string'&&typeof v.html==='string'&&v.html.length<=MAX_HTML&&typeof v.label==='string'&&['model','local'].includes(v.origin)&&Number.isInteger(v.number)).slice(-6);
   if(!versions.length)continue;const model=normalizeArtifact({type:'artifact',id:r.id,title:r.title,version:1,html:versions[0].html,height:r.height,description:r.description});if(model.error)continue;
   let state={};try{state=stateCopy(r.state||{});}catch{}
   records[key]={id:model.id,title:model.title,description:model.description,height:model.height,session:r.session,versions,latestModel:Math.max(Number.isInteger(r.latestModel)?r.latestModel:0,...versions.filter(v=>v.origin==='model').map(v=>v.number)),active:versions.some(v=>v.key===r.active)?r.active:versions.at(-1).key,state,draft:typeof r.draft==='string'&&r.draft.length<=MAX_HTML?r.draft:null,updated:Number.isFinite(r.updated)?r.updated:0};
   stamp=Math.max(stamp,records[key].updated);
  }
  if(d.selected&&typeof d.selected==='object')for(const [session,key]of Object.entries(d.selected))if(records[key]?.session===session)selected[session]=key;
 }}}catch{available=false;}
 function notify(){snapshot++;for(const fn of [...listeners])fn();}
 function touch(){stamp=Math.max(stamp+1,Date.now());return stamp;}
 function commit(){
  const sorted=Object.keys(records).sort((a,b)=>records[b].updated-records[a].updated);for(const key of sorted.slice(12))delete records[key];
  for(const r of Object.values(records))while(r.versions.length>6){const i=r.versions.findIndex(v=>v.key!==r.active);r.versions.splice(i,1);}
  let text;for(;;){for(const [s,k]of Object.entries(selected))if(!records[k])delete selected[s];text=JSON.stringify({schema:1,records,selected});if(text.length<=1800000)break;const key=Object.keys(records).sort((a,b)=>records[a].updated-records[b].updated)[0];if(Object.keys(records).length<=1)break;delete records[key];}
  try{storage.setItem(KEY,text);available=true;}catch{available=false;}notify();
 }
 function get(key){return records[key];}
 function current(key){const r=get(key);return r?.versions.find(v=>v.key===r.active);}
 return{get,current,getSnapshot:()=>snapshot,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},persistent:()=>available,
  list(session){return Object.keys(records).filter(k=>records[k].session===session).sort((a,b)=>records[b].updated-records[a].updated);},
  selected(session){return records[selected[session]]?selected[session]:this.list(session)[0];},
  select(key){const r=get(key);if(r){selected[r.session]=key;r.updated=touch();commit();}},
  ingest(session,model){if(typeof session!=='string'||!session)throw Error('尚未取得会话标记，原文已保留');const key='a:'+fingerprint(session+'\n'+model.id),versionKey='m:'+model.version+':'+fingerprint(model.html);let r=get(key);
   if(r?.versions.some(v=>v.key===versionKey))return key;
   if(r?.versions.some(v=>v.origin==='model'&&v.number===model.version))throw Error('相同作品版本包含不同内容，请让模型增加version后重新输出');
   if(!r){r={id:model.id,title:model.title,description:model.description,height:model.height,session,versions:[],latestModel:0,active:null,state:{},draft:null,updated:0};records[key]=r;}
   const newer=model.version>r.latestModel;r.latestModel=Math.max(r.latestModel,model.version);
   r.versions.push({key:versionKey,number:model.version,origin:'model',label:'模型 v'+model.version,html:model.html});
   if(newer){r.active=versionKey;r.title=model.title;r.description=model.description;r.height=model.height;}
   r.updated=touch();commit();return key;
  },
  activate(key,version){const r=get(key);if(r?.versions.some(v=>v.key===version)){r.active=version;r.updated=touch();commit();}},
  edit(key,html){if(typeof html!=='string'||!html.trim()||html.length>MAX_HTML)throw Error('源码须为1–30000字符');const r=get(key);if(!r)throw Error('作品不存在');const number=Math.max(0,...r.versions.filter(v=>v.origin==='local').map(v=>v.number))+1,v={key:'l:'+number+':'+fingerprint(html),number,origin:'local',label:'本机修改 '+number,html};r.versions.push(v);r.active=v.key;r.draft=null;r.updated=touch();commit();},
  draft(key,value){const r=get(key);if(r&&typeof value==='string'&&value.length<=MAX_HTML){r.draft=value;r.updated=touch();commit();}},
  saveState(key,value){const r=get(key);if(!r)return false;const safe=stateCopy(value);if(JSON.stringify(r.state)===JSON.stringify(safe))return false;r.state=safe;r.updated=touch();commit();return true;},
  dispose(){listeners.clear();}
 };
}
module.exports={KEY,createArtifactStore};
