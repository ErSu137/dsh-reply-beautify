'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseContent}=require('../src/content-model.cjs');
const {layoutFlow,intersects,segmentHitsBox}=require('../src/flow-layout.cjs');
const {renderContent}=require('../src/content-view.cjs');
const {documentFixture}=require('./dom-fixture.cjs');
function example(direction){return parseContent('mermaid',`flowchart ${direction}
A[接收请求] --> B{校验}
B -->|通过| C[处理]
B -->|不通过| E(返回错误)
C -->|成功| D(返回结果)
C -->|异常| E`);}
function verify(plan,model){
 assert.ok(Number.isFinite(plan.width)&&Number.isFinite(plan.height));
 const boxes=[];
 for(const e of plan.edges){
  for(let i=1;i<e.points.length;i++){
   const a=e.points[i-1],b=e.points[i];assert.ok(a.x===b.x||a.y===b.y,'orthogonal edges');
   for(const n of plan.nodes.filter(n=>n.id!==e.from&&n.id!==e.to))assert.ok(!segmentHitsBox(a,b,n,2),`edge ${e.from}→${e.to} crosses ${n.id}`);
  }
  const label=model.edges[e.index].label;if(!label)continue;
  const box=e.label;assert.ok(box);assert.ok(box.lines.join('').includes(label),'exact branch text preserved');
  assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=plan.width&&box.y+box.height<=plan.height,'label inside canvas');
  for(const n of plan.nodes)assert.ok(!intersects(box,n,6),'label clears node');
  for(const other of plan.edges)for(let i=1;i<other.points.length;i++)assert.ok(!segmentHitsBox(other.points[i-1],other.points[i],box,6),'label clears all arrows');
  for(const prior of boxes)assert.ok(!intersects(box,prior,6),'label clears other labels');boxes.push(box);
 }
}
for(const direction of ['LR','TD'])test(`decision labels and rank-skipping branches avoid nodes/arrows (${direction})`,()=>{
 const model=example(direction),plan=layoutFlow(model);verify(plan,model);
 const skip=plan.edges.find(e=>e.from==='B'&&e.to==='E');
 assert.ok(skip.points.length>=4);assert.ok(!skip.label.note,'ordinary example retains branch labels beside edges');
 const middle=plan.nodes.find(n=>n.id==='C');
 assert.ok(skip.points.some(p=>direction==='LR'?p.y>middle.y+middle.height:p.x>middle.x+middle.width),'skip routed outside intermediate rank');
});
test('long branch labels wrap without covering nodes or arrows',()=>{
 const model=example('LR');model.edges.find(e=>e.label==='不通过').label='不通过：请求参数缺失或当前用户没有执行权限';
 const plan=layoutFlow(model);verify(plan,model);assert.ok(plan.edges.find(e=>e.label?.lines.join('').includes('不通过')).label.lines.length>1);
});
test('crowded parallel labels fall back to unambiguous notes without overlap',()=>{
 const model=example('TD');for(let i=0;i<18;i++)model.edges.push({from:'B',to:'C',label:`重复分支条件${i}`});
 const plan=layoutFlow(model);verify(plan,model);assert.ok(plan.edges.some(e=>e.label?.note));
 for(const e of plan.edges.filter(e=>e.label?.note))assert.ok(e.label.lines.join('').includes('校验 → 处理：'),'note names endpoints');
});
test('flow rendering preserves labels and draws them after node shapes',()=>{
 const doc=documentFixture(),model=example('LR'),svg=renderContent(doc,model).node;
 assert.equal(svg.querySelectorAll('.dsh-rb-edge-label').length,4);
 assert.equal(svg.querySelectorAll('.dsh-rb-edge-label-bg').length,4);
 assert.equal(svg.querySelectorAll('.dsh-rb-edge').length,5);
 const texts=svg.querySelectorAll('.dsh-rb-edge-label');assert.deepEqual(texts.map(n=>n.textContent),['通过','不通过','成功','异常']);
 const lastNode=svg.children.findLastIndex(n=>n.tagName==='g');assert.ok(texts.every(n=>svg.children.indexOf(n)>lastNode));
});
