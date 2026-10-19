'use strict';
// Standalone regression page. Uses generic samples, never opens DSH or a chat.
// Requires Playwright (NODE_PATH may point to an existing installation).
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'work','qa-local-0.6.1');
const factories=fs.readdirSync(path.join(root,'src')).filter(n=>n.endsWith('.cjs')&&n!=='client.cjs').map(n=>`${JSON.stringify('./'+n)}:(require,module,exports)=>{${fs.readFileSync(path.join(root,'src',n),'utf8')}\n}`).join(',');
const bundle=`const factories={${factories}},cache={};function req(name){if(!cache[name]){cache[name]={exports:{}};factories[name](req,cache[name],cache[name].exports);}return cache[name].exports;}
window.Core=req('./core.cjs');window.Content=req('./content-controller.cjs');window.View=req('./content-view.cjs');window.Samples=req('./rich-guidance.cjs').SAMPLES;`;
const html=`<!doctype html><meta charset="utf-8"><style>${fs.readFileSync(path.join(root,'src/content.css'),'utf8')}
*{box-sizing:border-box}body{margin:0;background:#141414;color:#eee;font:15px/1.6 Arial,"Microsoft YaHei",sans-serif}main{width:calc(100% - 48px);max-width:980px;margin:24px auto;min-width:0}h1{font-size:22px;margin:0 0 24px}.md-code-block{white-space:pre-wrap;overflow:auto}button,input,select{font:inherit}body.light{background:#fff;color:#252525}
</style><body data-ds-dark-theme><main data-dsh-rb-session="local-generic-qa"><h1>图形适配与缩放 · 通用验证样例</h1><section data-chat-flow-kind="assistant-step" data-chat-group-part="response" data-chat-node-key="qa"><div class="_markdown_fixture" id="reply"></div></section></main><script src="/bundle.js"></script><script>
window.observers=new Set();for(const name of ['MutationObserver','ResizeObserver']){const Original=window[name];window[name]=class extends Original{observe(...args){this.qaType=name;this.qaTarget=args[0];observers.add(this);return super.observe(...args)}disconnect(){observers.delete(this);return super.disconnect()}}}
window.store=Core.createPreferences(localStorage);window.controller=Content.createContentController(document,store,{settleMs:10});
window.addBlock=(id,data,language)=>{const b=document.createElement('div');b.className='md-code-block';b.id=id;const banner=document.createElement('div');banner.setAttribute('data-code-block-banner','');const info=document.createElement('span');info.className='_language_fixture';info.textContent=language;banner.append(info);const content=document.createElement('div');content.setAttribute('data-code-block-content','');const code=document.createElement('code');code.textContent=JSON.stringify(data);content.append(code);b.append(banner,content);document.querySelector('#reply').append(b);return b;};
</script>`;
const server=http.createServer((request,response)=>{response.setHeader('Content-Type',request.url==='/bundle.js'?'text/javascript;charset=utf-8':'text/html;charset=utf-8');response.end(request.url==='/bundle.js'?bundle:html);});
const results=[];let browser;
function check(name,value){assert.ok(value,name);results.push({name,pass:true});}
(async()=>{
 fs.mkdirSync(out,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true});
 const page=await browser.newPage({viewport:{width:1080,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.addBlock);
 await page.evaluate(()=>{
  addBlock('line',{type:'line',title:'通用趋势 · 24 个完整数据点',unit:'单位',labels:Array.from({length:24},(_,i)=>String(i)),series:[{name:'示例值',values:Array.from({length:24},(_,i)=>i%8+1)}]},'dsh-chart');
  addBlock('flow',{type:'flow',title:'普通比例流程',nodes:[{id:'a',label:'输入'},{id:'b',label:'检查'},{id:'c',label:'输出'}],edges:[{from:'a',to:'b'},{from:'b',to:'c'}],direction:'LR'},'dsh-diagram');
  const nodes=Array.from({length:26},(_,i)=>({id:'n'+i,label:'步骤 '+(i+1)})),edges=nodes.slice(1).map((n,i)=>({from:nodes[i].id,to:n.id}));
  addBlock('wide',{type:'flow',title:'极宽流程 · 保留滚动',nodes,edges,direction:'LR'},'dsh-diagram');
  addBlock('tall',{type:'flow',title:'极高流程 · 保留滚动',nodes,edges,direction:'TD'},'dsh-diagram');
  addBlock('explorer',{type:'explorer',title:'公式曲线',parameters:[{id:'slope',label:'斜率',min:1,max:5,step:1,value:2}],x:{min:0,max:10,label:'x'},series:[{name:'y',expression:'slope*x'}]},'dsh-explorer');
  addBlock('table',Samples.table,'dsh-table');addBlock('dashboard',Samples.dashboard,'dsh-dashboard');
 });
 await page.waitForFunction(()=>document.querySelectorAll('.dsh-rb-figure').length===7&&document.querySelectorAll('[data-dsh-rb-sized]').length>=7);
 const figure=id=>page.locator('#'+id+' + figure'),scroll=id=>figure(id).locator('.dsh-rb-diagram-scroll').first(),svg=id=>scroll(id).locator('svg');
 const fits=id=>scroll(id).evaluate(n=>n.scrollWidth<=n.clientWidth+1);
 check('24 data points stay present',await svg('line').locator('[data-label-index]').count()===24);
 check('last category stays visible without data cropping',await svg('line').evaluate(n=>{const last=n.querySelector('[data-label-index="23"]'),r=last.getBoundingClientRect(),s=n.parentElement.getBoundingClientRect();return r.right<=s.right&&r.left>=s.left;}));
 check('ordinary line chart fits without horizontal scrolling',await fits('line'));
 check('ordinary process fits without horizontal scrolling',await fits('flow'));
 check('wide process keeps horizontal scroll',await scroll('wide').evaluate(n=>n.scrollWidth>n.clientWidth*2));
 check('tall process keeps vertical scroll',await scroll('tall').evaluate(n=>n.scrollHeight>n.clientHeight*2));
 const initial=await svg('line').boundingBox();await svg('line').hover();
 const pageScroll=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,-180);
 await page.waitForFunction(w=>document.querySelector('#line + figure svg').getBoundingClientRect().width>w,initial.width);
 check('real hovered mouse wheel enlarges the graph',((await svg('line').boundingBox()).width)>initial.width);
 check('zoom consumes wheel rather than scrolling the chat',await page.evaluate(()=>scrollY)===pageScroll);
 await page.mouse.wheel(0,180);await page.waitForTimeout(50);
 check('wheel in reverse restores prior size',Math.abs((await svg('line').boundingBox()).width-initial.width)<1);
 await figure('line').getByRole('button',{name:'放大图形',exact:true}).click();
 check('button zoom is available',await svg('line').evaluate((n,w)=>n.getBoundingClientRect().width>w,initial.width));
 check('export retains natural dimensions after zoom',await svg('line').evaluate(n=>{const xml=View.serializeSvg(n),copy=new DOMParser().parseFromString(xml,'image/svg+xml').documentElement;return copy.getAttribute('width')===n.getAttribute('width')&&!copy.style.width&&!copy.style.height&&!copy.hasAttribute('data-dsh-rb-sized');}));
 await svg('line').dblclick();check('double click returns to automatic size',Math.abs((await svg('line').boundingBox()).width-initial.width)<1);
 await scroll('line').focus();await page.keyboard.press('+');check('focused graph supports keyboard zoom',((await svg('line').boundingBox()).width)>initial.width);await page.keyboard.press('0');
 check('keyboard zero resets zoom',Math.abs((await svg('line').boundingBox()).width-initial.width)<1);
 await page.setViewportSize({width:420,height:800});await page.waitForTimeout(100);
 check('chart responds to narrow conversation width',await fits('line'));
 check('explorer responds to narrow width without its former 480px minimum',await fits('explorer'));
 check('chart does not force the whole page wider',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const old=await svg('line').elementHandle();await figure('line').getByLabel('图表终点',{exact:true}).selectOption('12');
 await page.waitForFunction(()=>document.querySelectorAll('#line + figure svg [data-label-index]').length===13);
 await page.waitForFunction(()=>document.querySelector('#line + figure [data-dsh-rb-sized]'));
 check('range redraw attaches one fresh zoom control',await figure('line').locator('.dsh-rb-zoom-bar').count()===1);
 check('replaced SVG releases wheel listeners',await old.evaluate(n=>{const e=new WheelEvent('wheel',{deltaY:-100,cancelable:true});n.dispatchEvent(e);return !e.defaultPrevented;}));
 const oldCurve=await svg('explorer').elementHandle();await figure('explorer').getByLabel('斜率',{exact:true}).fill('4');await figure('explorer').getByLabel('斜率',{exact:true}).dispatchEvent('input');
 await page.waitForFunction(()=>document.querySelector('#explorer + figure input[type=number]').value==='4');await page.waitForTimeout(100);
 check('slider redraw retains exactly one sized graph',await figure('explorer').locator('[data-dsh-rb-sized]').count()===1);
 check('slider replacement releases old SVG listeners',await oldCurve.evaluate(n=>{const e=new WheelEvent('wheel',{deltaY:-100,cancelable:true});n.dispatchEvent(e);return !e.defaultPrevented;}));
 await figure('line').getByRole('button',{name:'恢复全图',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('#line + figure svg [data-label-index]').length===24&&document.querySelector('#line + figure [data-dsh-rb-sized]'));
 await page.setViewportSize({width:1080,height:900});await page.waitForTimeout(100);
 await page.evaluate(()=>{document.body.classList.remove('light');document.body.setAttribute('data-ds-dark-theme','');});
 await figure('line').scrollIntoViewIfNeeded();await figure('line').screenshot({path:path.join(out,'chart-fit-dark.png')});
 await page.evaluate(()=>{document.body.classList.add('light');document.body.removeAttribute('data-ds-dark-theme');});
 await figure('line').screenshot({path:path.join(out,'chart-fit-light.png')});
 const beforeDisable=await svg('line').elementHandle();await page.evaluate(()=>store.update({enabled:false}));
 check('disable restores all native source and removes graphics',await page.locator('[data-dsh-rb-owned],[data-dsh-rb-source]').count()===0);
 // Playwright may create its own observer on Document; count plugin targets.
 check('disable disconnects all per-graph observers',await page.evaluate(()=>[...observers].filter(o=>o.qaTarget?.nodeType!==9).length)===0);
 check('disable releases retained SVG wheel listeners',await beforeDisable.evaluate(n=>{const e=new WheelEvent('wheel',{deltaY:-100,cancelable:true});n.dispatchEvent(e);return !e.defaultPrevented;}));
 for(let i=0;i<5;i++){
  await page.evaluate(()=>store.update({enabled:true}));await page.waitForFunction(()=>document.querySelectorAll('.dsh-rb-figure').length===7&&document.querySelectorAll('[data-dsh-rb-sized]').length>=7);
  await page.evaluate(()=>store.update({enabled:false}));assert.equal(await page.evaluate(()=>[...observers].filter(o=>o.qaTarget?.nodeType!==9).length),0);
 }
 check('repeated enable/disable leaves no accumulated observers',true);
 await page.evaluate(()=>controller.dispose());check('no browser runtime errors',errors.length===0);
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({browser:await browser.version(),results,errors},null,2));
 console.log(JSON.stringify({checks:results.length,allPassed:true,output:out}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
