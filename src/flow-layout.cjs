'use strict';
// Deterministic orthogonal DAG layout, independent of browser geometry.
const units=s=>[...s].reduce((n,c)=>n+(/[^\u0000-\u00ff]/.test(c)?2:1),0);
function flowLines(value,limit=24){const out=[];for(const part of value.split('\n')){let line='';for(const c of part){if(units(line+c)>limit&&line){out.push(line);line='';}line+=c;}out.push(line);}return out;}
function intersects(a,b,pad=0){return a.x<b.x+b.width+pad&&a.x+a.width>b.x-pad&&a.y<b.y+b.height+pad&&a.y+a.height>b.y-pad;}
function segmentHitsBox(a,b,box,pad=0){const left=box.x-pad,right=box.x+box.width+pad,top=box.y-pad,bottom=box.y+box.height+pad;
 if(a.x===b.x)return a.x>left&&a.x<right&&Math.max(a.y,b.y)>top&&Math.min(a.y,b.y)<bottom;
 return a.y>top&&a.y<bottom&&Math.max(a.x,b.x)>left&&Math.min(a.x,b.x)<right;
}
function simplify(points){const out=[];for(const p of points){const last=out.at(-1);if(last&&last.x===p.x&&last.y===p.y)continue;const prev=out.at(-2);if(prev&&last&&(prev.x===last.x&&last.x===p.x||prev.y===last.y&&last.y===p.y))out.pop();out.push(p);}return out;}
function layoutFlow(model,{measure=s=>units(s)*7}={}){
 const vertical=model.direction==='TD',ranks=[];model.nodes.forEach(n=>(ranks[n.rank]??=[]).push(n));
 const labels=model.edges.map(e=>{if(!e.label)return null;const lines=flowLines(e.label);return{lines,width:Math.max(34,...lines.map(s=>Math.max(measure(s),units(s)*7)+16)),height:lines.length*16+12};});
 const labelW=Math.max(0,...labels.filter(Boolean).map(b=>b.width)),labelH=Math.max(0,...labels.filter(Boolean).map(b=>b.height));
 const nodeW=218,nodeH=Math.max(64,...model.nodes.map(n=>flowLines(n.label).length*20+28));
 const gapX=vertical?Math.max(80,labelW+32):Math.max(90,2*(labelW+18)),gapY=vertical?Math.max(100,2*(labelH+18)):Math.max(90,labelH+30);
 const cross=Math.max(...ranks.map(r=>r.length)),baseW=vertical?cross*(nodeW+gapX)-gapX+48:ranks.length*(nodeW+gapX)-gapX+48,baseH=vertical?ranks.length*(nodeH+gapY)-gapY+48:cross*(nodeH+gapY)-gapY+48;
 const nodes=[],positions=new Map();ranks.forEach((row,rank)=>row.forEach((n,index)=>{const box={...n,x:vertical?(baseW-row.length*(nodeW+gapX)+gapX)/2+index*(nodeW+gapX):24+rank*(nodeW+gapX),y:vertical?24+rank*(nodeH+gapY):(baseH-row.length*(nodeH+gapY)+gapY)/2+index*(nodeH+gapY),width:nodeW,height:nodeH};nodes.push(box);positions.set(n.id,box);}));
 let lanes=0;
 const edges=model.edges.map((e,index)=>{const a=positions.get(e.from),b=positions.get(e.to),skip=b.rank-a.rank>1;let points;
  if(vertical){const x1=a.x+nodeW/2,y1=a.y+nodeH,x2=b.x+nodeW/2,y2=b.y-3;if(skip){const lane=baseW+36+(lanes++)*(labelW+32);points=[{x:x1,y:y1},{x:x1,y:y1+gapY/3},{x:lane,y:y1+gapY/3},{x:lane,y:b.y-gapY/3},{x:x2,y:b.y-gapY/3},{x:x2,y:y2}];}else{const mid=(y1+b.y)/2;points=[{x:x1,y:y1},{x:x1,y:mid},{x:x2,y:mid},{x:x2,y:y2}];}}
  else{const x1=a.x+nodeW,y1=a.y+nodeH/2,x2=b.x-3,y2=b.y+nodeH/2;if(skip){const lane=baseH+36+(lanes++)*(labelH+32);points=[{x:x1,y:y1},{x:x1+gapX/3,y:y1},{x:x1+gapX/3,y:lane},{x:b.x-gapX/3,y:lane},{x:b.x-gapX/3,y:y2},{x:x2,y:y2}];}else{const mid=(x1+b.x)/2;points=[{x:x1,y:y1},{x:mid,y:y1},{x:mid,y:y2},{x:x2,y:y2}];}}
  return{...e,index,points:simplify(points),label:null};
 });
 const segments=edges.flatMap(e=>e.points.slice(1).map((b,i)=>({a:e.points[i],b}))),placed=[],notes=[];
 let width=Math.max(baseW,...edges.flatMap(e=>e.points.map(p=>p.x+24))),height=Math.max(baseH,...edges.flatMap(e=>e.points.map(p=>p.y+24)));
 function free(box){return box.x>=12&&box.y>=12&&!nodes.some(n=>intersects(box,n,8))&&!placed.some(b=>intersects(box,b,8))&&!segments.some(s=>segmentHitsBox(s.a,s.b,box,7));}
 edges.forEach(e=>{const size=labels[e.index];if(!size)return;const runs=e.points.slice(1).map((b,i)=>({a:e.points[i],b})).sort((s,t)=>(Math.abs(t.b.x-t.a.x)+Math.abs(t.b.y-t.a.y))-(Math.abs(s.b.x-s.a.x)+Math.abs(s.b.y-s.a.y)));
  for(const run of runs){for(const t of [.5,.25,.75,.15,.85]){const x=run.a.x+(run.b.x-run.a.x)*t,y=run.a.y+(run.b.y-run.a.y)*t;
    const candidates=run.a.y===run.b.y?[{x:x-size.width/2,y:y-size.height-10},{x:x-size.width/2,y:y+10}]:[{x:x+10,y:y-size.height/2},{x:x-size.width-10,y:y-size.height/2}];
    for(const p of candidates){const box={...size,...p};if(free(box)){e.label=box;placed.push(box);width=Math.max(width,box.x+box.width+24);height=Math.max(height,box.y+box.height+24);return;}}
  }}
  // A dense graph must never force text over a node/arrow. Preserve the exact
  // branch wording in a keyed source→target note instead of drawing it on top.
  notes.push(e);
 });
 for(const e of notes){
  const value=positions.get(e.from).label+' → '+positions.get(e.to).label+'：'+model.edges[e.index].label,lines=flowLines(value,Math.min(80,Math.max(24,Math.floor((width-64)/7))));
  const box={x:24,y:height+8,width:Math.max(...lines.map(s=>Math.max(measure(s),units(s)*7)))+16,height:lines.length*16+12,lines,note:true};e.label=box;placed.push(box);width=Math.max(width,box.x+box.width+24);height=box.y+box.height+16;
 }
 return{width,height,nodes,edges};
}
module.exports={layoutFlow,flowLines,intersects,segmentHitsBox};
