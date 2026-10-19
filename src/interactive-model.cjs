'use strict';
const {compileExpression,evaluateExpression,FUNCTIONS,CONSTANTS}=require('./expression.cjs');
const fail=error=>({error});
const str=(v,max=240)=>typeof v==='string'&&v.trim()&&v.length<=max;
const validId=v=>str(v,60)&&/^[A-Za-z][A-Za-z0-9_-]*$/.test(v)&&!['constructor','prototype','__proto__'].includes(v);
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e9;
function optionsOf(raw){if(!Array.isArray(raw)||raw.length<2||raw.length>10)return null;const ids=new Set(),out=[];for(const o of raw){if(!o||!validId(o.id)||ids.has(o.id)||!str(o.label,300))return null;ids.add(o.id);out.push({id:o.id,label:o.label});}return out;}
function numericValue(raw,min,max,step){const n=typeof raw==='number'?raw:Number(raw);if(!Number.isFinite(n))return null;const v=min+Math.round((Math.max(min,Math.min(max,n))-min)/step)*step;return Math.max(min,Math.min(max,Number(v.toPrecision(15))));}
function normalizeInteractive(data){
 if(!data||typeof data!=='object'||Array.isArray(data))return fail('交互内容需要 JSON 对象');
 if(!str(data.title,160))return fail('交互组件需要标题');
 if(data.description!==undefined&&!str(data.description,600))return fail('组件说明无效');
 const base={title:data.title,description:data.description||'',kind:data.type,version:1};
 if(data.type==='quiz'){
  if(!Array.isArray(data.questions)||!data.questions.length||data.questions.length>12)return fail('选择题需要 1–12 个问题');
  const ids=new Set(),questions=[];
  for(const q of data.questions){const options=optionsOf(q?.options);if(!q||!validId(q.id)||ids.has(q.id)||!str(q.prompt,600)||!options||q.multiple!==undefined&&typeof q.multiple!=='boolean')return fail('题目、选项或编号无效');ids.add(q.id);
   if(q.correct!==undefined&&(!Array.isArray(q.correct)||!q.correct.length||q.correct.some(id=>!options.some(o=>o.id===id))||new Set(q.correct).size!==q.correct.length||!q.multiple&&q.correct.length!==1))return fail('正确答案必须引用有效选项，单选题只能有一个答案');
   if(q.explanation!==undefined&&!str(q.explanation,1200))return fail('答案说明无效');
   questions.push({id:q.id,prompt:q.prompt,options,multiple:q.multiple===true,correct:q.correct?[...q.correct]:null,explanation:q.explanation||''});
  }return{...base,questions};
 }
 if(data.type==='form'){
  if(!Array.isArray(data.fields)||!data.fields.length||data.fields.length>12)return fail('表单需要 1–12 项');
  const ids=new Set(),fields=[];
  for(const f of data.fields){if(!f||!validId(f.id)||ids.has(f.id)||!str(f.label,240)||!['text','number','select','multiselect'].includes(f.type)||f.required!==undefined&&typeof f.required!=='boolean')return fail('表单字段无效');ids.add(f.id);const item={id:f.id,label:f.label,type:f.type,required:f.required===true};
   if(f.type==='select'||f.type==='multiselect'){item.options=optionsOf(f.options);if(!item.options)return fail('表单选项无效');}
   if(f.type==='number'){if(!finite(f.min)||!finite(f.max)||f.min>=f.max||f.step!==undefined&&(!finite(f.step)||f.step<=0))return fail('数值字段需要有效的范围');item.min=f.min;item.max=f.max;item.step=f.step||1;}
   if(f.type==='text')item.maxLength=800;
   fields.push(item);
  }return{...base,fields};
 }
 if(data.type==='explorer'){
  if(!Array.isArray(data.parameters)||!data.parameters.length||data.parameters.length>6)return fail('参数图需要 1–6 个参数');
  const ids=new Set(['x',...Object.keys(FUNCTIONS),...Object.keys(CONSTANTS)]),parameters=[];
  for(const p of data.parameters){if(!p||!validId(p.id)||p.id.includes('-')||ids.has(p.id)||!str(p.label,100)||!finite(p.min)||!finite(p.max)||p.min>=p.max||!finite(p.step)||p.step<=0||p.step<(p.max-p.min)/100000||!finite(p.value)||p.value<p.min||p.value>p.max||p.unit!==undefined&&!str(p.unit,24))return fail('参数的名称、默认值、范围或步长无效');ids.add(p.id);parameters.push({id:p.id,label:p.label,min:p.min,max:p.max,step:p.step,value:numericValue(p.value,p.min,p.max,p.step),unit:p.unit||''});}
  const x=data.x;if(!x||!finite(x.min)||!finite(x.max)||x.min>=x.max||Math.abs(x.min)>1e6||Math.abs(x.max)>1e6||x.label!==undefined&&!str(x.label,80)||x.points!==undefined&&(!Number.isInteger(x.points)||x.points<40||x.points>400))return fail('横轴需要有效范围和 40–400 个采样点');
  if(data.unit!==undefined&&!str(data.unit,32))return fail('纵轴单位无效');
  if(!Array.isArray(data.series)||!data.series.length||data.series.length>4)return fail('需要 1–4 条曲线');
  if(data.metrics!==undefined&&(!Array.isArray(data.metrics)||data.metrics.length>6))return fail('最多提供 6 个计算结果');
  const vars=parameters.map(p=>p.id);
  try{
   const series=data.series.map(s=>{if(!s||!str(s.name,80))throw Error('曲线名称无效');return{name:s.name,expression:s.expression,tree:compileExpression(s.expression,['x',...vars])};});
   const metrics=(data.metrics||[]).map(m=>{if(!m||!str(m.label,100)||m.unit!==undefined&&!str(m.unit,32))throw Error('计算结果标签无效');return{label:m.label,expression:m.expression,tree:compileExpression(m.expression,vars),unit:m.unit||''};});
   return{...base,parameters,x:{min:x.min,max:x.max,label:x.label||'x',points:x.points||160},series,metrics,unit:data.unit||''};
  }catch(e){return fail(e.message);}
 }
 return fail('不支持的交互组件类型');
}
function quizResult(model,selections){const answers=[],missing=[];let score=0,total=0;for(const q of model.questions){const selected=Array.isArray(selections[q.id])?[...new Set(selections[q.id])].filter(id=>q.options.some(o=>o.id===id)):[];if(!selected.length)missing.push(q.id);const correct=q.correct?selected.length===q.correct.length&&selected.every(id=>q.correct.includes(id)):null;if(q.correct){total++;if(correct)score++;}answers.push({id:q.id,prompt:q.prompt,selected,labels:selected.map(id=>q.options.find(o=>o.id===id).label),correct,explanation:q.explanation});}return{answers,missing,score,total};}
function formResult(model,values){const result={},errors={};for(const f of model.fields){const v=values[f.id];if(f.type==='text'){const s=typeof v==='string'?v.trim().slice(0,f.maxLength):'';if(f.required&&!s)errors[f.id]='请填写这一项';result[f.id]=s;}
 else if(f.type==='number'){if(v===''||v===undefined||v===null){if(f.required)errors[f.id]='请填写数值';result[f.id]=null;}else{const n=Number(v);if(!Number.isFinite(n)||n<f.min||n>f.max||Math.abs((n-f.min)/f.step-Math.round((n-f.min)/f.step))>1e-6)errors[f.id]=`请填写 ${f.min}–${f.max} 内符合步长的数值`;result[f.id]=Number.isFinite(n)?n:null;}}
 else{const a=(f.type==='select'?[v]:Array.isArray(v)?v:[]).filter(id=>f.options.some(o=>o.id===id));if(f.required&&!a.length)errors[f.id]='请选择这一项';result[f.id]=f.type==='select'?(a[0]||''):a;}}
 return{values:result,errors};}
function explorerData(model,raw={}){const parameters={};for(const p of model.parameters)parameters[p.id]=numericValue(raw[p.id]??p.value,p.min,p.max,p.step)??p.value;
 const xs=Array.from({length:model.x.points},(_,i)=>model.x.min+(model.x.max-model.x.min)*i/(model.x.points-1));
 const series=model.series.map(s=>({name:s.name,expression:s.expression,values:xs.map(x=>evaluateExpression(s.tree,{...parameters,x}))}));
 const metrics=model.metrics.map(m=>({label:m.label,unit:m.unit,value:evaluateExpression(m.tree,parameters)}));
 return{parameters,x:xs,series,metrics};}
module.exports={normalizeInteractive,numericValue,quizResult,formResult,explorerData};
