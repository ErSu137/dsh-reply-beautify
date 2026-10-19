'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {artifactDocument,normalizeArtifact}=require('../src/artifact-model.cjs');
const {csvText,safeURL}=require('../src/rich-model.cjs');
const {parseContent}=require('../src/content-model.cjs');
const {compileExpression}=require('../src/expression.cjs');
test('artifact relay rejects malformed values and strips unrecognized payload fields',()=>{
 const events={},sent=[],frame={contentWindow:{postMessage(){}},setAttribute(){}};
 const parent={postMessage:d=>sent.push(d)};
 const html=artifactDocument(normalizeArtifact({type:'artifact',id:'demo',title:'Demo',version:1,html:'<p>Demo</p>'}),{channel:'test'});
 vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{parent,document:{createElement:()=>frame,body:{append(){}}},addEventListener:(k,fn)=>events[k]=fn});
 const send=(action,value,extra={})=>events.message({source:frame.contentWindow,data:{dshArtifact:'test',action,value,...extra}});
 for(const value of [null,[],42,'x',undefined,{x:'x'.repeat(24000)}])send('state',value);
 send('error',{toString:42});send('navigate','https://example.com');
 assert.equal(sent.length,0);
 send('state',{input:5},{unrecognized:'large data'});
 assert.deepEqual(Object.keys(sent[0]).sort(),['action','dshArtifact','value']);
 assert.equal(sent[0].value.input,5);
 send('error','x'.repeat(1000));assert.equal(sent.at(-1).value.length,300);
});
test('CSV quotes headers and cells and neutralizes ASCII and full-width formula prefixes',()=>{
 for(const prefix of ['=','+','-','@','＝','＋','－','＠','  =','\t','\r','\n']){
  const v=prefix+'1+1',csv=csvText([{id:'x',label:v}],[{values:{x:v}}]);
  assert.equal(csv,'\ufeff"\''+v+'"\r\n"\''+v+'"');
 }
 assert.equal(csvText([{id:'x',label:'a'}],[{values:{x:'a",=1\ntext'}}]),'\ufeff"a"\r\n"a"",=1\ntext"');
 assert.ok(csvText([{id:'x',label:'n'}],[{values:{x:-5}}]).endsWith('"-5"'));
});
test('unsafe URLs, executable expressions and oversized components fail closed',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,bad','file:///secret','https://name:pass@example.com'])assert.equal(safeURL(url),null);
 for(const expr of ['globalThis.process.exit()','constructor.constructor("return this")()','x[0]','x=1','fetch("https://example.com")'])assert.throws(()=>compileExpression(expr,['x']));
 assert.ok(parseContent('dsh-artifact','x'.repeat(40001)).error);
 for(const lang of ['html','javascript','json'])assert.equal(parseContent(lang,'<script>alert(1)</script>'),null);
});
