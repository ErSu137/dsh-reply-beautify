// Optional standalone Chromium smoke test. npm install --no-save playwright
// BROWSER_EXECUTABLE may point to an installed Chromium-family browser.
const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const html=fs.readFileSync(path.join(root,'docs/demo/index.html'));
 let probes=0;const server=http.createServer((req,res)=>{if(req.url.startsWith('/probe')){probes++;res.end('probe');return;}res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:1160}}),errors=[],requests=[],checks=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message)});page.on('request',r=>requests.push(r.url()));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator('[data-rich-kind="chart"] svg').waitFor();checks.push('actual renderer mounts');
  const chart=page.locator('[data-rich-kind="chart"]');
  await chart.getByRole('button',{name:'预算',exact:true}).click();
  assert.equal(await chart.getByRole('button',{name:'预算',exact:true}).getAttribute('aria-pressed'),'false');checks.push('chart series toggle');
  await chart.getByRole('button',{name:'预算',exact:true}).click();
  await page.getByLabel('投入工时', {exact:true}).fill('20');
  assert.match(await page.locator('[data-rich-kind="calculator"]').innerText(),/1,600/);checks.push('calculator recomputes');
  await page.getByLabel('投入工时', {exact:true}).fill('12');
  await page.selectOption('#preset','claude');assert.equal(await page.locator('.dsh-rb-figure').first().getAttribute('data-preset'),'claude');checks.push('preset switch');
  await page.selectOption('#preset','default');
  await page.getByRole('button',{name:'运行预览',exact:true}).click();
  await page.getByText('作品已就绪；状态仅在本次页面保留',{exact:true}).waitFor();
  await page.screenshot({path:path.join(root,'docs/demo/preview.png'),fullPage:true});
  await page.getByRole('button',{name:'停止预览',exact:true}).click();
  // Observe the real child protocol, rather than relying on a Playwright nested
  // OOPIF locator (some installed Chrome versions omit that nested frame event).
  const setWork=html=>page.evaluate(html=>{const w=window.publicDemo.workspace,k=w.store.list('public-demo')[0];w.store.edit(k,html)},html);
  const state=()=>page.evaluate(()=>{const w=window.publicDemo.workspace;return w.store.get(w.store.list('public-demo')[0]).state});
  await setWork('<script>dshArtifact.setState({count:(dshArtifact.getState().count||0)+1})<\/script>');
  await page.getByRole('button',{name:'运行预览',exact:true}).click();
  await page.waitForFunction(()=>{const w=publicDemo.workspace;return w.store.get(w.store.list('public-demo')[0]).state.count===1});
  await page.getByRole('button',{name:'停止预览',exact:true}).click();
  await page.getByRole('button',{name:'运行预览',exact:true}).click();
  await page.waitForFunction(()=>{const w=publicDemo.workspace;return w.store.get(w.store.list('public-demo')[0]).state.count===2});checks.push('real nested sandbox API state survives stop/restart');
  await page.getByRole('button',{name:'停止预览',exact:true}).click();
  const probe='http://127.0.0.1:'+server.address().port+'/probe';
  await setWork(`<script>let domBlocked=false;try{parent.document.body.textContent='ESCAPED'}catch{domBlocked=true}fetch(${JSON.stringify(probe)}).then(()=>dshArtifact.setState({fetchBlocked:false,domBlocked}),()=>dshArtifact.setState({fetchBlocked:true,domBlocked}));<\/script><iframe src="${probe}/frame"></iframe><img src="${probe}/image"><script src="${probe}/script"><\/script>`);
  await page.getByRole('button',{name:'运行预览',exact:true}).click();
  await page.waitForFunction(()=>{const w=publicDemo.workspace;return w.store.get(w.store.list('public-demo')[0]).state.fetchBlocked===true});
  await page.waitForTimeout(300);assert.equal(probes,0);assert.equal((await state()).domBlocked,true);assert.match(await page.title(),/Public samples/);checks.push('CSP blocks loopback fetch/image/script/frame probes; parent DOM inaccessible');
  await page.getByRole('button',{name:'停止预览',exact:true}).click();assert.equal(await page.locator('#artifact iframe').count(),0);checks.push('stop removes sandbox');
  await page.setViewportSize({width:430,height:920});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);checks.push('standalone narrow viewport');
  // The hostile sample is expected to raise CSP errors in its own frame.
  assert.deepEqual(errors,[]);
  const report={checks,errors,browser:await browser.version(),scope:'standalone public samples; not DSH/Electron acceptance'};
  fs.mkdirSync(path.join(root,'work'),{recursive:true});fs.writeFileSync(path.join(root,'work/browser-smoke.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
