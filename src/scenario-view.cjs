'use strict';
const {el}=require('./content-view.cjs');
const {explorerData}=require('./interactive-model.cjs');
function createScenarios(doc,model,state,{plot,onRestore,copy,save,button}){
 state.snapshots=(Array.isArray(state.snapshots)?state.snapshots:[]).slice(0,3).filter(s=>s&&typeof s.name==='string'&&s.name.length<=60&&s.parameters&&typeof s.parameters==='object').map((s,i)=>({id:'case'+i,name:s.name,parameters:explorerData(model,s.parameters).parameters}));
 state.scenarioCurve=Number.isInteger(state.scenarioCurve)?Math.max(0,Math.min(model.series.length-1,state.scenarioCurve)):0;
 const node=el(doc,'details',{class:'dsh-rb-scenarios'}),summary=el(doc,'summary',{},'情景快照与比较（最多3组）'),bar=el(doc,'div',{class:'dsh-rb-rich-bar'}),name=el(doc,'input',{class:'dsh-rb-field-input','aria-label':'情景名称',maxlength:60,placeholder:'例如：方案A'}),body=el(doc,'div'),status=el(doc,'p',{class:'dsh-rb-rich-hint',role:'status'});
 const choose=el(doc,'select',{class:'dsh-rb-field-input','aria-label':'选择要比较的曲线'});model.series.forEach((s,i)=>choose.append(el(doc,'option',{value:i},s.name)));choose.value=state.scenarioCurve;choose.addEventListener('change',()=>{state.scenarioCurve=Number(choose.value);update();save();});
 bar.append(name,button('保存当前情景',()=>{if(state.snapshots.length>=3){status.textContent='已保存3组，请先移除一组再保存。';return;}state.snapshots.push({id:'case'+Date.now(),name:name.value.trim()||'情景'+(state.snapshots.length+1),parameters:{...state.parameters}});name.value='';status.textContent='快照已保存在本机';update();save();}),choose,button('复制情景比较',()=>copy({title:model.title,current:explorerData(model,state.parameters),snapshots:state.snapshots.map(s=>({name:s.name,...explorerData(model,s.parameters)}))})));
 node.append(summary,bar,status,body);
 function update(){body.replaceChildren();if(!state.snapshots.length){body.append(el(doc,'p',{class:'dsh-rb-rich-hint'},'调整参数后保存，可将当前曲线与A/B/C情景叠加比较。'));return;}
  const cards=el(doc,'div',{class:'dsh-rb-rich-grid'});state.snapshots.forEach(s=>{const c=el(doc,'section',{class:'dsh-rb-rich-card'});c.append(el(doc,'strong',{},s.name),el(doc,'p',{},model.parameters.map(p=>p.label+'='+s.parameters[p.id]+(p.unit?' '+p.unit:'')).join('；')),button('载入 '+s.name,()=>onRestore({...s.parameters})),button('移除 '+s.name,()=>{state.snapshots=state.snapshots.filter(i=>i!==s);update();save();}));cards.append(c);});
  const current=explorerData(model,state.parameters),cases=state.snapshots.map(s=>({name:s.name,data:explorerData(model,s.parameters)}));
  const series=[{...current.series[state.scenarioCurve],name:'当前：'+model.series[state.scenarioCurve].name},...cases.map(s=>({...s.data.series[state.scenarioCurve],name:s.name}))];
  body.append(cards,el(doc,'p',{class:'dsh-rb-rich-hint'},'叠加比较：'+model.series[state.scenarioCurve].name+'；当前结果与快照使用同一横轴和纵轴。'),plot(doc,{...model,title:model.title+' · 情景比较'},{...current,series}));
  if(model.metrics.length){const scroll=el(doc,'div',{class:'dsh-rb-table-scroll'}),table=el(doc,'table',{class:'dsh-rb-data-table'}),head=el(doc,'tr');head.append(el(doc,'th',{},'情景'));model.metrics.forEach(m=>head.append(el(doc,'th',{},m.label+(m.unit?' ('+m.unit+')':''))));table.append(head);[{name:'当前',data:current},...cases].forEach(c=>{const row=el(doc,'tr');row.append(el(doc,'th',{},c.name));c.data.metrics.forEach(m=>row.append(el(doc,'td',{},m.value===null?'未定义':String(Number(m.value.toPrecision(7))))));table.append(row);});scroll.append(table);body.append(scroll);}
 }
 return{node,update};
}
module.exports={createScenarios};
