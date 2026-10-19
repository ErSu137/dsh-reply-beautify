'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {automaticSize,zoomFactor,wheelDelta}=require('../src/diagram-viewport.cjs');
const {renderContent}=require('../src/content-view.cjs');
const {documentFixture}=require('./dom-fixture.cjs');

test('ordinary diagrams fit available width and height without stretching',()=>{
 for(const [w,h,available]of [[1356,405,600],[640,420,320],[600,1000,700],[320,240,900]]){
  const size=automaticSize(w,h,available,900);
  assert.equal(size.extreme,false);assert.ok(size.width<=available);assert.ok(size.height<=648);
  assert.ok(size.width<=w);assert.ok(Math.abs(size.width/size.height-w/h)<1e-10);
 }
});
test('extreme diagrams keep readable natural dimensions with bounded layout',()=>{
 assert.deepEqual(automaticSize(3000,200,600),{width:3000,height:200,extreme:true});
 assert.deepEqual(automaticSize(200,3000,600),{width:200,height:3000,extreme:true});
 const huge=automaticSize(100000,1000,600);assert.equal(huge.width,8192);assert.ok(huge.height<8192);
});
test('wheel direction and units give bounded zoom for mouse and trackpad',()=>{
 const base={width:600,height:400};assert.ok(zoomFactor(1,-100,base)>1);assert.ok(zoomFactor(1,100,base)<1);
 let scale=1;for(let i=0;i<100;i++)scale=zoomFactor(scale,-240,base);assert.equal(scale,4);
 for(let i=0;i<100;i++)scale=zoomFactor(scale,240,base);assert.equal(scale,.25);
 assert.equal(zoomFactor(1,-240,{width:8192,height:400}),1);
 assert.equal(wheelDelta({deltaY:2,deltaMode:1},500),32);assert.equal(wheelDelta({deltaY:1,deltaMode:2},500),500);
});
test('24 short numeric labels retain all points on a compact line chart',()=>{
 const doc=documentFixture(),labels=Array.from({length:24},(_,i)=>String(i));
 const model={kind:'chart',chartType:'line',title:'测试',labels,series:[{name:'值',values:labels.map(Number)}]};
 const svg=renderContent(doc,model).node.querySelector('svg');
 assert.ok(Number(svg.getAttribute('width'))<=700);
 assert.equal(svg.querySelectorAll('[data-label-index]').length,24);
 assert.equal(svg.querySelector('[data-label-index="23"] title').textContent,'23 · 值：23');
});
