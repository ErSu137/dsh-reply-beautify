'use strict';
const { visualWidth } = require('./content-model.cjs');
const { layoutFlow } = require('./flow-layout.cjs');
let sequence=0;
const SVG_NS='http://www.w3.org/2000/svg';
function el(doc,tag,attrs={},value) {
  const node=doc.createElement(tag);
  for (const [key,v] of Object.entries(attrs)) if(v!==undefined)node.setAttribute(key,String(v));
  if(value!==undefined)node.textContent=String(value);
  return node;
}
function svgEl(doc,tag,attrs={},value) {
  const node=doc.createElementNS(SVG_NS,tag);
  for (const [key,v] of Object.entries(attrs))node.setAttribute(key,String(v));
  if(value!==undefined)node.textContent=String(value);
  return node;
}
function wrap(value,width=23) {
  const result=[];
  for (const paragraph of value.split('\n')) {
    let line='';
    for(const c of paragraph) {if(visualWidth(line+c)>width&&line){result.push(line);line='';}line+=c;}
    result.push(line);
  }
  return result;
}
function svgText(doc,parent,value,x,y,{width=24,line=20,anchor='middle',className='dsh-rb-svg-text'}={}) {
  const lines=wrap(value,width),node=svgEl(doc,'text',{x,y,'text-anchor':anchor,class:className});
  lines.forEach((s,i)=>node.append(svgEl(doc,'tspan',{x,dy:i===0?0:line},s)));
  parent.append(node);return lines.length;
}
function makeSvg(doc,width,height,title,description) {
  const id='dsh-rb-visual-'+(++sequence);
  const svg=svgEl(doc,'svg',{viewBox:`0 0 ${width} ${height}`,width,height,role:'img','aria-labelledby':id,class:'dsh-rb-svg'});
  svg.append(svgEl(doc,'title',{id},title || '图示'));
  if(description)svg.append(svgEl(doc,'desc',{},description));
  return svg;
}
function renderFields(doc,model) {
  const body=el(doc,'div',{class:'dsh-rb-fields'});
  if(model.prefix)body.append(el(doc,'pre',{class:'dsh-rb-ruler'},model.prefix));
  const table=el(doc,'div',{class:'dsh-rb-field-grid',role:'table','aria-label':model.title || '字段结构图'});
  // Narrow fields retain legible labels. Overflow stays inside this figure.
  const min=Math.max(300,...model.rows.map(r=>r.cells.length*68));
  table.style.minWidth=min+'px';
  model.rows.forEach((row,index)=>{
    const group=el(doc,'div',{class:'dsh-rb-field-row',role:'row','data-shade':index%2});
    const cells=el(doc,'div',{class:'dsh-rb-field-cells',role:'presentation'});
    cells.style.gridTemplateColumns=row.cells.map(c=>`${c.weight}fr`).join(' ');
    row.cells.forEach(cell=>{
      const item=el(doc,'div',{class:'dsh-rb-field',role:'cell','data-tone':cell.tone},cell.label);
      if(cell.bits!==undefined)item.append(el(doc,'span',{class:'dsh-rb-field-bits'},`${cell.bits} bit`));
      cells.append(item);
    });
    group.append(cells);
    if(model.rows.some(r=>r.note))group.append(el(doc,'div',{class:'dsh-rb-row-note',role:'cell'},row.note));
    table.append(group);
  });
  body.append(table);
  if(model.suffix)body.append(el(doc,'pre',{class:'dsh-rb-ruler'},model.suffix));
  return body;
}
function renderFlow(doc,model) {
  const context=doc.createElement('canvas').getContext('2d');
  if(context)context.font='12px Arial,"Microsoft YaHei",sans-serif';
  const plan=layoutFlow(model,context?{measure:s=>context.measureText(s).width}:{});
  const svg=makeSvg(doc,plan.width,plan.height,model.title || '流程关系图',model.nodes.map(n=>n.label).join('；'));
  const arrowId='dsh-rb-arrow-'+(++sequence),defs=svgEl(doc,'defs'),marker=svgEl(doc,'marker',{id:arrowId,markerWidth:8,markerHeight:8,refX:7,refY:4,orient:'auto',markerUnits:'userSpaceOnUse'});
  marker.append(svgEl(doc,'path',{d:'M0 0L8 4L0 8Z',class:'dsh-rb-arrow'}));defs.append(marker);svg.append(defs);
  plan.edges.forEach(edge=>{
    const d=edge.points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ');
    svg.append(svgEl(doc,'path',{d,class:'dsh-rb-edge','marker-end':`url(#${arrowId})`}));
  });
  plan.nodes.forEach((n,index)=>{
    const {x,y,width:nodeW,height:nodeH}=n,g=svgEl(doc,'g',{'data-tone':n.tone,'data-shade':index%2});
    if(n.shape==='decision')g.append(svgEl(doc,'polygon',{points:`${x+nodeW/2},${y} ${x+nodeW},${y+nodeH/2} ${x+nodeW/2},${y+nodeH} ${x},${y+nodeH/2}`,class:'dsh-rb-node'}));
    else g.append(svgEl(doc,'rect',{x,y,width:nodeW,height:nodeH,rx:n.shape==='round'?nodeH/2:10,class:'dsh-rb-node'}));
    const lines=wrap(n.label,24);
    svgText(doc,g,n.label,x+nodeW/2,y+nodeH/2-(lines.length-1)*10+5,{width:24});
    svg.append(g);
  });
  // Labels have their own collision-checked boxes and are painted after nodes.
  plan.edges.forEach(edge=>{
    if(!edge.label)return;
    const {x,y,width,height,lines}=edge.label;
    svg.append(svgEl(doc,'rect',{x,y,width,height,rx:4,class:'dsh-rb-edge-label-bg'}));
    const text=svgEl(doc,'text',{x:x+width/2,y:y+18,'text-anchor':'middle',class:'dsh-rb-edge-label'});
    lines.forEach((s,i)=>text.append(svgEl(doc,'tspan',{x:x+width/2,dy:i?16:0},s)));
    svg.append(text);
  });
  return svg;
}
function renderChart(doc,model) {
  // Short numeric line-chart labels need less space than grouped bars. Keep
  // every point while avoiding an unnecessarily wide canvas before fitting.
  const bandSize=model.chartType==='line'?Math.max(24,...model.labels.map(s=>Math.min(52,visualWidth(s)*7+10))):52;
  const w=Math.max(610,model.labels.length*bandSize+108),left=76,right=24,top=32,plotH=232;
  const plotW=w-left-right,band=plotW/model.labels.length;
  const labelWidth=Math.max(6,Math.floor(band/7)),labelLines=Math.max(...model.labels.map(s=>wrap(s,labelWidth).length));
  const legendContext=doc.createElement('canvas').getContext('2d');
  if(legendContext)legendContext.font='12px Arial,"Microsoft YaHei",sans-serif';
  const legendChars=Math.floor(Math.min(200,plotW-24)/7),legendRows=[];
  model.series.forEach((s,index)=>{
    const lines=wrap(s.name,legendChars);
    const textWidth=Math.max(...lines.map(line=>legendContext?legendContext.measureText(line).width:visualWidth(line)*7));
    const item={name:s.name,index,width:20+textWidth,lines:lines.length};
    let row=legendRows.at(-1);
    if(!row || row.width+28+item.width>plotW){row={items:[],width:0};legendRows.push(row);}
    row.width+=(row.items.length?28:0)+item.width;row.items.push(item);
  });
  const legendHeights=legendRows.map(row=>Math.max(...row.items.map(s=>s.lines))*16+16);
  const legendTop=top+plotH+25+(labelLines-1)*16+42,h=legendTop+legendHeights.reduce((a,b)=>a+b,0)+12;
  const values=model.series.flatMap(s=>s.values);
  let min=Math.min(0,...values),max=Math.max(0,...values);
  if(min===max)max=min+1;
  const span=max-min;
  const y=v=>top+(max-v)/span*plotH;
  const svg=makeSvg(doc,w,h,model.title || '数据图表',`${model.chartType==='bar'?'柱状图':'折线图'}；单位：${model.unit || '未标注'}；完整数值见数据表`);
  const format=v=>Number(v.toPrecision(5)).toLocaleString('zh-CN',{maximumFractionDigits:8});
  for(let i=0;i<=4;i++) {
    const value=min+span*i/4,py=y(value);
    svg.append(svgEl(doc,'line',{x1:left,y1:py,x2:w-right,y2:py,class:'dsh-rb-gridline'}));
    svgText(doc,svg,format(value),left-10,py+4,{anchor:'end',className:'dsh-rb-axis-text',width:22});
  }
  svg.append(svgEl(doc,'line',{x1:left,y1:y(0),x2:w-right,y2:y(0),class:'dsh-rb-zero-line'}));
  if(model.unit)svgText(doc,svg,model.unit,left,18,{anchor:'start',className:'dsh-rb-axis-text',width:32});
  const x=i=>left+band*(i+.5);
  model.labels.forEach((name,i)=>svgText(doc,svg,name,x(i),top+plotH+25,{width:labelWidth,line:16,className:'dsh-rb-axis-text'}));
  model.series.forEach((series,s)=>{
    if(model.chartType==='line')svg.append(svgEl(doc,'polyline',{points:series.values.map((v,i)=>`${x(i)},${y(v)}`).join(' '),fill:'none',class:'dsh-rb-series-line','data-series':s}));
    series.values.forEach((v,i)=>{
      let shape;
      if(model.chartType==='bar') {
        const bw=Math.min(42,band*.75/model.series.length),px=x(i)-bw*model.series.length/2+bw*s;
        shape=svgEl(doc,'rect',{x:px+1,y:Math.min(y(v),y(0)),width:Math.max(1,bw-2),height:Math.abs(y(v)-y(0)),rx:2,class:'dsh-rb-series-point','data-series':s});
      } else shape=svgEl(doc,'circle',{cx:x(i),cy:y(v),r:4,class:'dsh-rb-series-point','data-series':s});
      shape.setAttribute('data-label-index',i);
      shape.append(svgEl(doc,'title',{},`${model.labels[i]} · ${series.name}：${v}${model.unit?' '+model.unit:''}`));svg.append(shape);
    });
  });
  let legendY=legendTop;
  legendRows.forEach((row,r)=>{
    const group=svgEl(doc,'g',{class:'dsh-rb-chart-legend','data-legend-row':r});
    let px=left+(plotW-row.width)/2;
    row.items.forEach(s=>{
      group.append(svgEl(doc,'rect',{x:px,y:legendY-8,width:12,height:8,rx:2,class:'dsh-rb-series-point','data-series':s.index}));
      svgText(doc,group,s.name,px+20,legendY,{width:legendChars,line:16,anchor:'start',className:'dsh-rb-axis-text'});
      px+=s.width+28;
    });svg.append(group);legendY+=legendHeights[r];
  });
  const group=el(doc,'div');group.append(svg);
  const details=el(doc,'details',{class:'dsh-rb-chart-data'});details.append(el(doc,'summary',{},'查看数据'));
  const table=el(doc,'table'),head=el(doc,'thead'),tr=el(doc,'tr');
  tr.append(el(doc,'th',{scope:'col'},'分类'));model.series.forEach(s=>tr.append(el(doc,'th',{scope:'col'},s.name+(model.unit?` (${model.unit})`:''))));head.append(tr);table.append(head);
  const tbody=el(doc,'tbody');model.labels.forEach((name,i)=>{const row=el(doc,'tr');row.append(el(doc,'th',{scope:'row'},name));model.series.forEach(s=>row.append(el(doc,'td',{},s.values[i])));tbody.append(row);});
  table.append(tbody);details.append(table);group.append(details);return group;
}

function renderContent(doc,model,mountMath) {
  if(model.kind==='fields')return {node:renderFields(doc,model)};
  if(model.kind==='flow')return {node:renderFlow(doc,model)};
  if(model.kind==='chart')return {node:renderChart(doc,model)};
  if(model.kind==='math') {
    const node=el(doc,'div',{class:'dsh-rb-math'});
    return {node,mount:()=>mountMath?.(node,model.formula)};
  }
  throw new Error('Unsupported content');
}
function serializeSvg(svg) {
  const doc=svg.ownerDocument,view=doc.defaultView,clone=svg.cloneNode(true);
  const originals=[svg,...svg.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
  originals.forEach((n,i)=>{
    const s=view.getComputedStyle(n);
    for(const p of ['fill','stroke','stroke-width','font-family','font-size','font-weight','paint-order'])copies[i].style.setProperty(p,s.getPropertyValue(p));
  });
  clone.setAttribute('xmlns',SVG_NS);clone.removeAttribute('class');
  // Export the original geometry, independently of temporary display zoom.
  if(svg.hasAttribute('data-dsh-rb-sized')){
    for(const p of ['width','height'])clone.style.removeProperty(p);
    clone.removeAttribute('data-dsh-rb-sized');
  }
  return new view.XMLSerializer().serializeToString(clone);
}
function exportSvg(svg) {
  const doc=svg.ownerDocument,view=doc.defaultView;
  const blob=new view.Blob([serializeSvg(svg)],{type:'image/svg+xml;charset=utf-8'}),url=view.URL.createObjectURL(blob);
  const a=el(doc,'a',{href:url,download:'dsh-diagram.svg'});doc.body.append(a);a.click();a.remove();view.setTimeout(()=>view.URL.revokeObjectURL(url),1000);
}
module.exports={el,svgEl,wrap,renderContent,serializeSvg,exportSvg};
