'use strict';
const {el,svgEl,wrap}=require('./content-view.cjs');
const {quizResult,formResult,explorerData,numericValue}=require('./interactive-model.cjs');
const {TYPES:RICH_TYPES}=require('./rich-model.cjs');
const {renderRich}=require('./rich-view.cjs');
const {createScenarios}=require('./scenario-view.cjs');
let unique=0;
const format=v=>v===null?'未定义':v!==0&&(Math.abs(v)<1e-4||Math.abs(v)>=1e7)?v.toExponential(4):Number(v.toPrecision(6)).toLocaleString('zh-CN',{maximumFractionDigits:6});
function renderInteractive(doc,model,{stateStore,stateKey}={}){
 if(model.kind==='chart'||RICH_TYPES.includes(model.kind))return renderRich(doc,model,{stateStore,stateKey});
 const view=doc.defaultView,host=el(doc,'div',{class:'dsh-rb-interactive','data-interactive-kind':model.kind});
 let state=stateStore?.load(stateKey)||{},disposed=false,frame;
 const note=el(doc,'p',{class:'dsh-rb-local-note'}),status=el(doc,'div',{class:'dsh-rb-interaction-status',role:'status','aria-live':'polite'});
 function saved(){note.textContent=(stateStore?.persistent(stateKey)?'状态保存在本机。':'状态仅在本次页面保留。')+'结果可复制到对话继续讨论。';}
 function persist(){stateStore?.save(stateKey,state);saved();}
 function button(label,fn){const b=el(doc,'button',{type:'button',class:'dsh-rb-action'},label);b.addEventListener('click',fn);return b;}
 async function copy(value){try{await view.navigator.clipboard.writeText(value);status.textContent='结果已复制，可粘贴到对话继续讨论';}catch{let area=host.querySelector('.dsh-rb-copy-fallback');if(!area){area=el(doc,'textarea',{class:'dsh-rb-copy-fallback',readonly:'','aria-label':'可复制的当前结果'});host.append(area);}area.value=value;area.focus();area.select();status.textContent='请复制选中的结果';}}
 function options(fieldset,options,multiple,selected,onChange,name){const inputs=[];for(const option of options){const label=el(doc,'label',{class:'dsh-rb-option'}),input=el(doc,'input',{type:multiple?'checkbox':'radio',name,value:option.id});input.checked=selected.includes(option.id);input.addEventListener('change',()=>{const values=inputs.filter(i=>i.checked).map(i=>i.value);onChange(values);});inputs.push(input);label.append(input,el(doc,'span',{},option.label));fieldset.append(label);}return inputs;}
 const actions=el(doc,'div',{class:'dsh-rb-interaction-actions'});
 if(model.kind==='quiz'){
  const selections={};for(const q of model.questions){const raw=state.selections?.[q.id];selections[q.id]=Array.isArray(raw)?raw.filter(id=>q.options.some(o=>o.id===id)).slice(0,q.multiple?10:1):[];}
  state={selections,submitted:state.submitted===true};if(quizResult(model,selections).missing.length)state.submitted=false;const feedback=new Map(),fieldsets=new Map();
  function resultText(){const r=quizResult(model,state.selections);return model.title+'\n'+r.answers.map(a=>a.prompt+'\n选择：'+(a.labels.join('、')||'未作答')+(state.submitted&&a.correct!==null?'\n核对：'+(a.correct?'正确':'需复习'):'')+(state.submitted&&a.explanation?'\n说明：'+a.explanation:'')).join('\n\n')+(state.submitted&&r.total?'\n得分：'+r.score+'/'+r.total:'');}
  function showFeedback(){const r=quizResult(model,state.selections);for(const a of r.answers){const node=feedback.get(a.id);node.textContent=state.submitted?(a.correct===null?'已记录你的选择。':a.correct?'回答正确。':'这题还需要复习。')+(a.explanation?' '+a.explanation:''):'';node.dataset.verdict=a.correct===null?'recorded':a.correct?'correct':'incorrect';node.hidden=!state.submitted;}
   if(state.submitted)status.textContent=r.total?`核对完成：${r.score} / ${r.total} 题正确`:'选择已在本地记录，可复制结果继续讨论';
  }
  for(const q of model.questions){const f=el(doc,'fieldset',{class:'dsh-rb-question'});f.append(el(doc,'legend',{},q.prompt));const group='dsh-rb-q-'+(++unique);options(f,q.options,q.multiple,state.selections[q.id],values=>{state.selections[q.id]=values;state.submitted=false;status.textContent='选择已更新，请核对答案';showFeedback();persist();},group);const msg=el(doc,'div',{class:'dsh-rb-answer-feedback',hidden:''});feedback.set(q.id,msg);fieldsets.set(q.id,f);f.append(msg);host.append(f);}
  actions.append(button(model.questions.some(q=>q.correct)?'核对答案':'确认选择',()=>{const r=quizResult(model,state.selections);if(r.missing.length){status.textContent='请先完成所有问题';fieldsets.get(r.missing[0]).querySelector('input')?.focus();return;}state.submitted=true;showFeedback();persist();}),button('复制结果',()=>copy(resultText())),button('重新作答',()=>{state={selections:{},submitted:false};for(const q of model.questions)state.selections[q.id]=[];host.querySelectorAll('input').forEach(i=>i.checked=false);status.textContent='已清空本组件的作答';showFeedback();persist();}));
  showFeedback();
 }else if(model.kind==='form'){
  const values={};for(const f of model.fields){const v=state.values?.[f.id];values[f.id]=f.type==='multiselect'?(Array.isArray(v)?v.filter(id=>f.options.some(o=>o.id===id)):[]):f.type==='select'?(f.options.some(o=>o.id===v)?v:''):f.type==='text'?(typeof v==='string'?v.slice(0,800):''):(typeof v==='number'||typeof v==='string'?v:'');}
  state={values,submitted:state.submitted===true};const inputs=new Map(),errors=new Map(),summary=el(doc,'div',{class:'dsh-rb-form-summary',hidden:''});
  function update(id,value){state.values[id]=value;state.submitted=false;summary.hidden=true;errors.get(id).textContent='';inputs.get(id)?.removeAttribute('aria-invalid');status.textContent='内容已更新，确认后可复制结果';persist();}
  for(const f of model.fields){const field=el(doc,'fieldset',{class:'dsh-rb-question'});field.append(el(doc,'legend',{},f.label+(f.required?'（必填）':'')));const error=el(doc,'div',{class:'dsh-rb-field-error',id:'dsh-rb-error-'+(++unique)});errors.set(f.id,error);
   if(f.type==='select'||f.type==='multiselect'){const a=options(field,f.options,f.type==='multiselect',f.type==='select'?[state.values[f.id]]:state.values[f.id],v=>update(f.id,f.type==='select'?(v[0]||''):v),'dsh-rb-field-'+unique);inputs.set(f.id,a[0]);a.forEach(i=>i.setAttribute('aria-describedby',error.id));}
   else{const input=el(doc,f.type==='text'?'textarea':'input',{'aria-label':f.label,'aria-describedby':error.id,class:'dsh-rb-field-input'});if(f.type==='number'){input.type='number';input.min=f.min;input.max=f.max;input.step=f.step;}else input.maxLength=800;input.value=state.values[f.id];input.addEventListener('input',()=>update(f.id,input.value));inputs.set(f.id,input);field.append(input);}field.append(error);host.append(field);
  }
  function submit(){const r=formResult(model,state.values);for(const f of model.fields){errors.get(f.id).textContent=r.errors[f.id]||'';if(r.errors[f.id])inputs.get(f.id)?.setAttribute('aria-invalid','true');else inputs.get(f.id)?.removeAttribute('aria-invalid');}if(Object.keys(r.errors).length){status.textContent='请检查标记的项目';inputs.get(Object.keys(r.errors)[0])?.focus();return null;}state.submitted=true;summary.hidden=false;summary.textContent='信息已在本地整理完成。';status.textContent='可复制结果到对话，由 DeepSeek 继续处理';persist();return r;}
  function text(){const r=formResult(model,state.values);return model.title+'\n'+model.fields.map(f=>{const value=r.values[f.id];const formatted=f.options?(Array.isArray(value)?value:[value]).map(id=>f.options.find(o=>o.id===id)?.label||'').filter(Boolean).join('、'):value===null?'':String(value);return f.label+'：'+(formatted||'未填写');}).join('\n');}
  actions.append(button('确认填写',submit),button('复制结果',()=>{if(submit())copy(text());}),button('清空填写',()=>{state={values:Object.fromEntries(model.fields.map(f=>[f.id,f.type==='multiselect'?[]:''])),submitted:false};host.querySelectorAll('input,textarea').forEach(i=>{if(i.type==='radio'||i.type==='checkbox')i.checked=false;else i.value='';i.removeAttribute('aria-invalid');});errors.forEach(e=>e.textContent='');summary.hidden=true;status.textContent='已清空本组件的填写';persist();}));host.append(summary);
  if(state.submitted&&Object.keys(formResult(model,state.values).errors).length===0){summary.hidden=false;summary.textContent='已恢复上次在本地确认的信息。';}
 }else if(model.kind==='explorer'){
  state={parameters:explorerData(model,state.parameters).parameters,snapshots:state.snapshots,scenarioCurve:state.scenarioCurve};const controls=el(doc,'div',{class:'dsh-rb-parameters'}),metrics=el(doc,'div',{class:'dsh-rb-metrics'}),chart=el(doc,'div',{class:'dsh-rb-live-chart'}),dataPanel=el(doc,'div',{class:'dsh-rb-explorer-data'}),mapping=new Map();let current;
  const scenarios=createScenarios(doc,model,state,{plot:renderNumericPlot,onRestore:parameters=>{state.parameters=parameters;recompute();},copy,save:persist,button});
  function recompute(){if(disposed)return;current=explorerData(model,state.parameters);state.parameters=current.parameters;for(const [id,{range,number,value,p}] of mapping){range.value=number.value=current.parameters[id];value.textContent=format(current.parameters[id])+(p.unit?' '+p.unit:'');}metrics.replaceChildren(...current.metrics.map(m=>{const item=el(doc,'div',{class:'dsh-rb-metric'});item.append(el(doc,'span',{},m.label),el(doc,'strong',{},format(m.value)+(m.unit?' '+m.unit:'')));return item;}));
   // Data belongs below the whole composition, never inside the chart column.
   const open=dataPanel.querySelector('details')?.open,drawing=renderNumericPlot(doc,model,current),details=drawing.querySelector('details');
   details.open=Boolean(open);dataPanel.replaceChildren(details);chart.replaceChildren(drawing);
   scenarios.update();const missing=current.series.reduce((s,v)=>s+v.values.filter(n=>n===null).length,0);status.textContent=missing?`${missing} 个采样值未定义，曲线在这些位置断开。`:'';persist();}
  function schedule(){if(frame)view.cancelAnimationFrame(frame);frame=view.requestAnimationFrame(()=>{frame=null;recompute();});}
  for(const p of model.parameters){const item=el(doc,'div',{class:'dsh-rb-parameter'}),label=el(doc,'label',{for:'dsh-rb-param-'+(++unique)},p.label),value=el(doc,'output',{}),range=el(doc,'input',{type:'range',id:label.htmlFor,min:p.min,max:p.max,step:p.step,'aria-label':p.label}),number=el(doc,'input',{type:'number',min:p.min,max:p.max,step:p.step,'aria-label':p.label+'数值',class:'dsh-rb-number-input'});range.value=number.value=state.parameters[p.id];range.addEventListener('input',()=>{state.parameters[p.id]=Number(range.value);schedule();});number.addEventListener('change',()=>{const n=number.value.trim()?numericValue(number.value,p.min,p.max,p.step):null;if(n===null){status.textContent='请输入范围内的有限数值';number.value=state.parameters[p.id];return;}state.parameters[p.id]=n;schedule();});mapping.set(p.id,{p,range,number,value});const heading=el(doc,'div',{class:'dsh-rb-parameter-heading'});heading.append(label,value);item.append(heading,range,number);controls.append(item);}
  actions.append(button('恢复参数',()=>{state.parameters=Object.fromEntries(model.parameters.map(p=>[p.id,p.value]));recompute();}),button('复制当前结果',()=>{current=explorerData(model,state.parameters);copy(JSON.stringify({title:model.title,parameters:current.parameters,metrics:current.metrics,x:current.x,series:current.series.map(s=>({name:s.name,values:s.values})),unit:model.unit},null,2));}));
  const explorer=el(doc,'div',{class:'dsh-rb-explorer-body'}),layout=el(doc,'div',{class:'dsh-rb-explorer-layout','data-has-metrics':String(model.metrics.length>0)});
  metrics.setAttribute('role','group');metrics.setAttribute('aria-label','当前指标');metrics.hidden=model.metrics.length===0;
  layout.append(chart,metrics);explorer.append(layout,dataPanel);host.append(controls,explorer,scenarios.node);recompute();
 }
 host.append(actions,status,note);saved();
 return{node:host,cleanup(){disposed=true;if(frame)view.cancelAnimationFrame(frame);stateStore?.save(stateKey,state);}};
}

function renderNumericPlot(doc,model,data){
 const width=640,left=70,right=24,top=28,height=336,bottom=76,pw=width-left-right,ph=height-top-bottom;
 const values=data.series.flatMap(s=>s.values).filter(v=>v!==null),min=Math.min(0,...values),rawMax=Math.max(0,...values),max=rawMax===min?min+1:rawMax;
 const scale=Math.max(Math.abs(min),Math.abs(max),1e-300),low=min/scale,high=max/scale;
 const x=v=>left+(v-model.x.min)/(model.x.max-model.x.min)*pw,y=v=>top+(high-v/scale)/(high-low)*ph;
 const svg=svgEl(doc,'svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-label':model.title,class:'dsh-rb-svg dsh-rb-numeric-plot'});svg.append(svgEl(doc,'title',{},model.title));
 for(let i=0;i<=4;i++){const v=(low+(high-low)*i/4)*scale,py=y(v);svg.append(svgEl(doc,'line',{x1:left,y1:py,x2:width-right,y2:py,class:'dsh-rb-gridline'}));const t=svgEl(doc,'text',{x:left-9,y:py+4,'text-anchor':'end',class:'dsh-rb-axis-text'},format(v));svg.append(t);}
 for(let i=0;i<=4;i++){const v=model.x.min+(model.x.max-model.x.min)*i/4;svg.append(svgEl(doc,'text',{x:x(v),y:top+ph+23,'text-anchor':'middle',class:'dsh-rb-axis-text'},format(v)));}
 svg.append(svgEl(doc,'line',{x1:left,y1:y(0),x2:width-right,y2:y(0),class:'dsh-rb-zero-line'}));svg.append(svgEl(doc,'text',{x:left+pw/2,y:height-34,'text-anchor':'middle',class:'dsh-rb-axis-text'},model.x.label));if(model.unit)svg.append(svgEl(doc,'text',{x:left,y:16,class:'dsh-rb-axis-text'},model.unit));
 data.series.forEach((s,index)=>{let segment=[];const flush=()=>{if(segment.length)svg.append(svgEl(doc,'polyline',{points:segment.join(' '),fill:'none',class:'dsh-rb-series-line','data-series':index}));segment=[];};s.values.forEach((v,i)=>{if(v===null){flush();return;}segment.push(x(data.x[i])+','+y(v));});flush();});
 const ctx=doc.createElement('canvas').getContext('2d');if(ctx)ctx.font='12px Arial,"Microsoft YaHei",sans-serif';
 const legendWidths=data.series.map(s=>Math.max(...wrap(s.name,24).map(l=>ctx?ctx.measureText(l).width:l.length*12))+20);
 let legendY=height+12,row=[],sum=0,maxLines=1;
 const legendRow=()=>{if(!row.length)return;let px=left+(pw-sum)/2;for(const {s,index,w} of row){svg.append(svgEl(doc,'rect',{x:px,y:legendY-8,width:12,height:8,rx:2,class:'dsh-rb-series-point','data-series':index}));const t=svgEl(doc,'text',{x:px+20,y:legendY,class:'dsh-rb-axis-text'});wrap(s.name,24).forEach((line,i)=>t.append(svgEl(doc,'tspan',{x:px+20,dy:i?16:0},line)));svg.append(t);px+=w+24;}legendY+=maxLines*16+16;row=[];sum=0;maxLines=1;};
 data.series.forEach((s,index)=>{const w=legendWidths[index];if(sum+(row.length?24:0)+w>pw)legendRow();sum+=(row.length?24:0)+w;row.push({s,index,w});maxLines=Math.max(maxLines,wrap(s.name,24).length);});legendRow();svg.setAttribute('height',legendY+8);svg.setAttribute('viewBox',`0 0 ${width} ${legendY+8}`);
 const root=el(doc,'div'),scroll=el(doc,'div',{class:'dsh-rb-plot-scroll',tabindex:'0','aria-label':'参数曲线，可横向滚动'});scroll.append(svg);root.append(scroll);
 const details=el(doc,'details',{class:'dsh-rb-chart-data'});details.append(el(doc,'summary',{},'查看采样数据'));const table=el(doc,'table'),thead=el(doc,'thead'),head=el(doc,'tr');head.append(el(doc,'th',{},model.x.label));data.series.forEach(s=>head.append(el(doc,'th',{},s.name)));thead.append(head);table.append(thead);const body=el(doc,'tbody');
 const stride=Math.max(1,Math.ceil(data.x.length/25));for(let i=0;i<data.x.length;i+=stride){const r=el(doc,'tr');r.append(el(doc,'td',{},format(data.x[i])));data.series.forEach(s=>r.append(el(doc,'td',{},format(s.values[i]))));body.append(r);}table.append(body);details.append(el(doc,'p',{},'下表为抽样展示；复制当前结果可获取全部采样点。'),table);root.append(details);return root;
}
module.exports={renderInteractive,renderNumericPlot};
