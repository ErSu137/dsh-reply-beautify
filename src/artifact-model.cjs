'use strict';
const MAX_HTML=30000,MAX_STATE=24000;
function normalizeArtifact(d){
 if(!d||d.type!=='artifact')return{error:'作品类型无效，保留原文'};
 if(typeof d.id!=='string'||!/^[a-zA-Z][\w-]{0,63}$/.test(d.id))return{error:'作品需要稳定的英文 id'};
 if(typeof d.title!=='string'||!d.title.trim()||d.title.length>120)return{error:'作品标题无效'};
 if(!Number.isInteger(d.version)||d.version<1||d.version>9999)return{error:'作品版本必须是1–9999的整数'};
 if(typeof d.html!=='string'||!d.html.trim()||d.html.length>MAX_HTML)return{error:'作品页面为空或超过30000字符'};
 if(d.description!==undefined&&(typeof d.description!=='string'||d.description.length>600))return{error:'作品说明过长'};
 return{kind:'artifact',id:d.id,title:d.title,version:d.version,html:d.html,description:d.description||'',height:Number.isFinite(d.height)?Math.round(Math.min(900,Math.max(260,d.height))):460};
}
function stateCopy(value){const text=JSON.stringify(value);if(!text||text.length>MAX_STATE)throw Error('作品状态超过24000字符');const result=JSON.parse(text);if(!result||typeof result!=='object'||Array.isArray(result))throw Error('作品状态必须是JSON对象');return result;}
const scriptJSON=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
// Two distinct opaque-origin sandboxes. The trusted outer document restricts
// its child's navigations as well as forwarding only the documented messages.
function artifactDocument(model,{channel,state={},theme='dark',preset='default'}={}){
 const safe=stateCopy(state),colors=theme==='dark'?{bg:'#141414',fg:'#ededed',card:'#262626',line:'#444'}:{bg:'#faf9f6',fg:'#242424',card:'#f0efea',line:'#d8d5ce'};
 const accent=preset==='claude'?'#d97757':preset==='chatgpt'?'#79b89d':'#6b87ec';
 const font=preset==='claude'?'Georgia,"Microsoft YaHei",serif':'Arial,"Microsoft YaHei",sans-serif';
 const innerPolicy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
 const bridge=`(()=>{const channel=${scriptJSON(channel)};let state=${scriptJSON(safe)};const clone=v=>JSON.parse(JSON.stringify(v));const send=(action,value)=>parent.postMessage({dshArtifact:channel,action,value},'*');Object.defineProperty(window,'dshArtifact',{value:Object.freeze({getState:()=>clone(state),setState(value){const s=JSON.stringify(value);if(!s||s.length>${MAX_STATE})throw Error('状态过长');const v=JSON.parse(s);if(!v||typeof v!=='object'||Array.isArray(v))throw Error('状态必须是对象');state=v;send('state',v);}})});addEventListener('message',e=>{if(e.source!==parent||e.data?.dshArtifact!==channel||e.data.action!=='restore')return;state=e.data.value;dispatchEvent(new CustomEvent('dsh-artifact-state',{detail:clone(state)}));});addEventListener('error',e=>send('error',String(e.message).slice(0,300)));addEventListener('unhandledrejection',e=>send('error',String(e.reason?.message||e.reason).slice(0,300)));send('ready',null);})();`;
 const inner=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${innerPolicy}"><style>:root{color-scheme:${theme};--bg:${colors.bg};--fg:${colors.fg};--card:${colors.card};--line:${colors.line};--accent:${accent}}*{box-sizing:border-box}body{margin:0;padding:18px;background:var(--bg);color:var(--fg);font:15px/1.65 ${font}}button,input,select,textarea{font:inherit}button{cursor:pointer}canvas,svg{max-width:100%}</style><script>${bridge}</script></head><body>${model.html}</body></html>`;
 const outerPolicy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; frame-src about:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
 const outer=`(()=>{const channel=${scriptJSON(channel)},frame=document.createElement('iframe');frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('allow',"camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'; fullscreen 'none'");frame.referrerPolicy='no-referrer';frame.title=${scriptJSON(model.title)};frame.style='border:0;width:100%;height:100%;display:block';addEventListener('message',e=>{const d=e.data;if(!d||d.dshArtifact!==channel)return;if(e.source===frame.contentWindow&&['ready','state','error'].includes(d.action)){let value=null;if(d.action==='state'){try{const text=JSON.stringify(d.value);if(!text||text.length>${MAX_STATE})return;value=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value))return;}catch{return;}}else if(d.action==='error'){if(typeof d.value!=='string')return;value=d.value.slice(0,300);}parent.postMessage({dshArtifact:channel,action:d.action,value},'*');}else if(e.source===parent&&d.action==='restore')frame.contentWindow.postMessage({dshArtifact:channel,action:'restore',value:d.value},'*');});frame.srcdoc=${scriptJSON(inner)};document.body.append(frame);})();`;
 return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${outerPolicy}"><style>html,body{height:100%;margin:0;overflow:hidden}</style></head><body><script>${outer}</script></body></html>`;
}
module.exports={normalizeArtifact,artifactDocument,stateCopy,MAX_HTML,MAX_STATE};
