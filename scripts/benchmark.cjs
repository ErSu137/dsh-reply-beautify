'use strict';
// Synthetic DOM CPU timings; this never drives the user's DSH or a browser.
const fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks');
const {controllerFixture}=require('../tests/controller-fixture.cjs');
const {createContentController}=require('../src/content-controller.cjs');
const {createPreferences}=require('../src/core.cjs');
const source='flowchart LR\nA[输入] --> B{检查}\nB -->|通过| C[输出]\nB -->|拒绝| D[错误]';
const results=[];
for(const replies of [200,1000]){
 const rounds=[];for(let round=0;round<3;round++){
  const doc=controllerFixture();for(let i=0;i<replies;i++)doc.reply(source);
  const started=performance.now(),store=createPreferences(doc.defaultView.localStorage),controller=createContentController(doc,store);doc.advance(650);const rendered=doc.querySelectorAll('.dsh-rb-figure').length;
  rounds.push(Number((performance.now()-started).toFixed(2)));controller.dispose();
  if(rendered!==replies||doc.observerCount()||doc.pendingTimers()||doc.querySelector('[data-dsh-rb-source]'))throw Error('Incomplete rendering or cleanup');
 }
 results.push({replies,roundsMs:rounds,medianMs:[...rounds].sort((a,b)=>a-b)[1],completeRenderingAndCleanup:true});
}
const report={kind:'synthetic DOM; not real DSH latency, memory or frame-rate evidence',node:process.version,platform:process.platform,cases:results};
const out=path.resolve(__dirname,'../work/qa-stage6');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'benchmark.json'),JSON.stringify(report,null,2));process.stdout.write(JSON.stringify(report,null,2));
