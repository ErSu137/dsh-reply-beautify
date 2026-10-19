'use strict';
// Runs the actual built plugin against a small DSH-shaped generic page.
// No DSH UI, private conversation, model call or real profile is accessed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'work/qa-welcome-0.6.3');
const native=`<div data-conversation-content data-content-phase="hero" data-conversation-session="new-a"><div class="scroll"><div data-composer-seat><div class="Dc7zOa_composerHero"><h1>探索未至之境 <small>预览版</small></h1><div class="workspaces">▱ 默认工作区　⌄　♧ 标准模式</div><div data-composer-card><textarea aria-label="消息输入" placeholder="描述你想要构建的内容 / 调用指令、@ 文件或对话"></textarea><footer><span>＋　工作区内修改⌄</span><span>DeepSeek-V4.1-Flash　High　↑</span></footer></div></div></div></div></div>`;
const html=`<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;background:#141414;color:#eee;font:16px/1.6 "Segoe UI","Microsoft YaHei",sans-serif;--dsw-alias-label-primary:#eee;--dsw-alias-label-secondary:#aaa;--dsw-alias-bg-base:#141414;--dsw-alias-bg-layer-1:#191919;--dsw-alias-bg-layer-2:#292929}.sidebar{position:absolute;left:0;top:0;bottom:0;width:180px;border-right:1px solid #292929;background:#191919;padding:25px 20px;color:#969696}.test-label{position:absolute;left:210px;top:10px;color:#777;font-size:12px}.Dc7zOa_root{position:absolute;left:180px;right:0;top:40px;bottom:0;display:flex;flex-direction:column;min-width:0}[data-conversation-content]{position:relative;min-height:0;flex:1;display:flex;flex-direction:column}.scroll{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;overflow:auto;scrollbar-gutter:stable}[data-composer-seat]{display:flex;flex-direction:column;flex:none}.Dc7zOa_composerHero{align-self:center;width:min(880px,100%);display:flex;flex-direction:column;padding-bottom:32px;gap:8px}h1{font:500 30px/1.4 "Segoe UI","Microsoft YaHei",sans-serif;text-align:center;margin:0 0 26px}h1 small{font-size:12px;background:#453225;color:#dbb99e;border-radius:10px;padding:3px 7px}.workspaces{padding:0 20px;font-size:14px}[data-composer-card]{background:#2b2b2d;border-radius:24px;margin:0 16px;overflow:hidden;padding:14px 18px}textarea{display:block;box-sizing:border-box;width:100%;height:82px;border:0;resize:none;background:transparent;color:inherit;font:16px/1.5 "Segoe UI","Microsoft YaHei",sans-serif;outline:none}footer{display:flex;justify-content:space-between;gap:20px;min-height:30px;align-items:center;color:#aaa;font-size:12px}body.light{background:#fff;color:#222;--dsw-alias-label-primary:#222;--dsw-alias-label-secondary:#666;--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#fafafa;--dsw-alias-bg-layer-2:#eee}body.light .sidebar{background:#f5f5f5;border-color:#ddd}body.light [data-composer-card]{background:#f0f0f0}@media(max-width:800px){.sidebar{display:none}.Dc7zOa_root{left:0}.test-label{left:20px}h1{font-size:24px}.Dc7zOa_composerHero{padding-inline:8px}footer{font-size:10px;gap:8px}}
</style><body data-ds-dark-theme><aside class="sidebar">DSH · 测试样例<br>默认 / GPT / Claude</aside><div class="test-label">独立启动页回归样例 · 不连接 DSH 或模型</div><main class="Dc7zOa_root" data-phase="hero">${native}</main><script>
window.activeObservers=new Set();for(const type of ['MutationObserver','ResizeObserver']){const Native=window[type];window[type]=class extends Native{observe(...args){this.qaTarget=args[0];activeObservers.add(this);return super.observe(...args)}disconnect(){activeObservers.delete(this);return super.disconnect()}}}
window.__ModuleLoader__={load(def){const plugin=def.factory(name=>name==='react'?{createElement(){}}:name==='react-dom/client'?{createRoot(){return{render(){},unmount(){}}}}:{Tooltip(){},MarkdownText(){}});plugin.apply({effect(fn){window.disposePlugin=fn()},slots:{inject(_,fn){fn();return()=>{}},register(spec,component){if(spec.name==='sidebar.footer.action'){window.store=spec.inject().preferences;window.brush=component}}}})}};
window.phase=(phase,session)=>{document.querySelector('.Dc7zOa_root').setAttribute('data-phase',phase);const content=document.querySelector('[data-conversation-content]');content.setAttribute('data-content-phase',phase);if(session!==undefined)content.setAttribute('data-conversation-session',session)};
</script><script src="/client.js"></script></body>`;
const checks=[];let browser;
const check=(name,pass)=>{assert.ok(pass,name);checks.push({name,pass:true})};
(async()=>{
 fs.mkdirSync(out,{recursive:true});const fixture=path.join(out,'fixture.html');fs.writeFileSync(fixture,html.replace('/client.js',pathToFileURL(path.join(root,'lib/client.js')).href));
 browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});
 const page=await browser.newPage({viewport:{width:1665,height:1040}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto(pathToFileURL(fixture).href);
 const ready=()=>page.waitForSelector('[data-dsh-rb-welcome][data-ready]:not([hidden])');
 const appearance=()=>page.locator('[data-dsh-rb-welcome]').getAttribute('data-appearance');
 const absent=()=>page.waitForFunction(()=>!document.querySelector('[data-dsh-rb-welcome]'));
 const collisionFree=()=>page.evaluate(()=>{
  const card=document.querySelector('[data-composer-card]').getBoundingClientRect(),root=document.querySelector('[data-conversation-content]').getBoundingClientRect();
  const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  return [...document.querySelectorAll('.dsh-rb-welcome-character,.dsh-rb-welcome-bubble')].every(n=>{const r=n.getBoundingClientRect();return !overlap(r,card)&&r.left>=root.left-1&&r.right<=root.right+1&&r.top>=root.top-1&&r.bottom<=root.bottom+1});
 });
 const centeredGreeting=()=>page.locator('.dsh-rb-welcome-bubble').evaluate(n=>{
  const b=n.getBoundingClientRect(),lines=[...n.children].map(s=>s.getBoundingClientRect());
  return lines.length===2&&lines.every(r=>Math.abs((r.left+r.right-b.left-b.right)/2)<1&&r.left>=b.left+18&&r.right<=b.right-18)&&Math.abs((lines[0].top+lines[1].bottom-b.top-b.bottom)/2)<1&&lines[1].top-lines[0].bottom>=1&&lines[0].top>=b.top+10&&lines[1].bottom<=b.bottom-10;
 });
 await ready();check('plugin enable on a hero page shows one default character',await page.locator('[data-dsh-rb-welcome]').count()===1);
 check('normal entrance uses the finite fade and slide animation',await page.locator('.dsh-rb-welcome-character').evaluate(n=>{const s=getComputedStyle(n);return s.animationName==='dsh-rb-welcome-enter'&&s.animationIterationCount==='1'&&s.animationDuration==='0.46s'}));
 check('greeting is exact interface text',await page.locator('.dsh-rb-welcome-bubble').textContent()==='你好，请问可以怎么帮你');
 check('approved assets use embedded PNG data without remote requests',await page.locator('.dsh-rb-welcome-character').evaluate(n=>n.src.startsWith('data:image/png;base64,')));
 check('default decoration does not cover the input',await collisionFree());
 const first=await appearance();await page.evaluate(()=>store.setPreset('chatgpt'));await ready();
 check('preset switching while on hero creates one fresh appearance',await appearance()!==first&&await page.locator('[data-dsh-rb-welcome]').count()===1);
 check('tall character reserves input space',await page.locator('[data-dsh-rb-welcome-seat]').count()===1&&await collisionFree());
 const presetAppearance=await appearance();await page.locator('textarea').fill('通用草稿，切换风格后保持');await page.evaluate(()=>store.update({font:17}));await page.waitForTimeout(80);
 check('typing and font adjustment do not replay the entrance',await appearance()===presetAppearance);
 check('draft and focus survive layout updates',await page.locator('textarea').inputValue()==='通用草稿，切换风格后保持'&&await page.locator('textarea').evaluate(n=>document.activeElement===n));
 await page.evaluate(()=>phase('active','existing'));await absent();
 check('existing conversations remove mascot and restore native input layout',await page.locator('[data-dsh-rb-welcome-seat]').count()===0);
 await page.evaluate(()=>store.setPreset('claude'));check('preset switching in an existing conversation stays hidden',await page.locator('[data-dsh-rb-welcome]').count()===0);
 await page.evaluate(()=>phase('hero','new-b'));await ready();const newAppearance=await appearance();
 check('new session from an existing conversation plays the current style',await page.locator('[data-dsh-rb-welcome]').getAttribute('data-preset')==='claude'&&newAppearance!==presetAppearance);
 check('Claude character and bubble avoid the input',await collisionFree());
 await page.evaluate(()=>phase('hero','new-c'));await page.waitForFunction(previous=>{const node=document.querySelector('[data-dsh-rb-welcome][data-ready]');return node&&node.getAttribute('data-appearance')!==previous},newAppearance);check('another blank session replays once',await appearance()!==newAppearance);
 await page.evaluate(()=>document.querySelector('.Dc7zOa_root').style.display='none');await absent();check('hidden cached startup page removes its decoration',true);
 await page.evaluate(()=>document.querySelector('.Dc7zOa_root').style.display='flex');await ready();check('revealing a cached startup page restores its decoration',await page.locator('[data-dsh-rb-welcome]').count()===1);
 await page.evaluate(()=>store.update({welcomeMascot:false}));await absent();check('independent switch hides the art and restores layout',await page.locator('[data-dsh-rb-welcome-seat]').count()===0);
 await page.evaluate(()=>{store.setPreset('default');store.reset()});check('style switch and reset preserve mascot off',await page.locator('[data-dsh-rb-welcome]').count()===0);
 await page.evaluate(()=>store.update({welcomeMascot:true}));await ready();check('enabling mascot on hero plays the entrance',true);
 await page.evaluate(()=>store.update({enabled:false}));await absent();await page.evaluate(()=>store.update({enabled:true}));await ready();check('global enable removes and restores the decoration',true);
 await page.setViewportSize({width:430,height:900});await page.waitForTimeout(150);await ready();
 check('narrow layout keeps a usable full-width composer and no collisions',await collisionFree()&&await page.locator('[data-dsh-rb-welcome-seat]').count()===0);
 await page.waitForTimeout(500);check('compact greeting stays centered with padding',await centeredGreeting());
 check('narrow page has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.setViewportSize({width:1665,height:1040});await page.evaluate(()=>store.setPreset('chatgpt'));await ready();await page.locator('textarea').evaluate(n=>n.style.height='270px');await page.waitForTimeout(150);
 check('growing input recomputes decoration without touching its draft',await collisionFree()&&await page.locator('textarea').inputValue()==='通用草稿，切换风格后保持');
 await page.locator('textarea').evaluate(n=>n.style.height='82px');await page.evaluate(()=>document.querySelector('.Dc7zOa_root').style.right='320px');await page.waitForTimeout(150);
 check('right sidebar width changes keep the mascot inside the main pane',await collisionFree());
 await page.evaluate(()=>document.querySelector('.Dc7zOa_root').style.right='0');await page.waitForTimeout(80);
 const beforeResize=await appearance();await page.setViewportSize({width:1585,height:1000});await page.waitForTimeout(100);check('window resizing repositions without replaying animation',await appearance()===beforeResize&&await collisionFree());
 await page.emulateMedia({reducedMotion:'reduce'});check('reduced-motion preference suppresses animations',await page.locator('.dsh-rb-welcome-character').evaluate(n=>getComputedStyle(n).animationName==='none'));
 await page.emulateMedia({reducedMotion:'no-preference'});
 for(const preset of ['default','chatgpt','claude']){
  await page.evaluate(p=>store.setPreset(p),preset);await ready();await page.waitForTimeout(650);
  check(preset+' dark layout has no collisions',await collisionFree());
  check(preset+' dark greeting has two centered padded lines',await centeredGreeting());
  await page.screenshot({path:path.join(out,preset+'-dark.png')});
  await page.evaluate(()=>{document.body.classList.add('light');document.body.removeAttribute('data-ds-dark-theme')});
  check(preset+' light bubble remains readable',await page.locator('.dsh-rb-welcome-bubble').evaluate(n=>getComputedStyle(n).color!==getComputedStyle(n).backgroundColor));
  check(preset+' light greeting has two centered padded lines',await centeredGreeting());
  await page.screenshot({path:path.join(out,preset+'-light.png')});
  if(preset==='claude'){await page.locator('.dsh-rb-welcome-bubble').screenshot({path:path.join(out,'claude-bubble.png')});}
  await page.evaluate(()=>{document.body.classList.remove('light');document.body.setAttribute('data-ds-dark-theme','')});
 }
 check('decorations cannot intercept clicks',await page.locator('.dsh-rb-welcome-character').evaluate(n=>getComputedStyle(n).pointerEvents==='none'));
 await page.evaluate(()=>phase('settling'));await absent();check('loading/settling phase hides the mascot',true);
 await page.evaluate(()=>phase('hero','new-d'));await ready();
 await page.locator('.dsh-rb-welcome-character').evaluate(n=>n.src='data:image/png;base64,invalid');await page.waitForFunction(()=>document.querySelector('[data-dsh-rb-welcome]')?.hidden===true);
 check('failed image restores composer space without an error loop',await page.locator('[data-dsh-rb-welcome-seat]').count()===0);
 await page.evaluate(()=>store.setPreset('default'));await ready();
 const oldShell=await page.locator('[data-dsh-rb-welcome]').elementHandle();
 const oldAppearance=await appearance();await page.evaluate(markup=>document.querySelector('.Dc7zOa_root').innerHTML=markup,native);await page.waitForFunction(previous=>{const node=document.querySelector('[data-dsh-rb-welcome][data-ready]');return node&&node.getAttribute('data-appearance')!==previous},oldAppearance);
 check('replacing the native startup subtree releases the old decoration',await oldShell.evaluate(n=>!n.isConnected)&&await page.locator('[data-dsh-rb-welcome]').count()===1);
 for(let i=0;i<10;i++){await page.evaluate(()=>store.update({welcomeMascot:false}));await absent();await page.evaluate(()=>store.update({welcomeMascot:true}));await ready();}
 check('repeated toggle keeps exactly one live mascot',await page.locator('[data-dsh-rb-welcome]').count()===1);
 await page.reload();await ready();check('restart restores saved style and mascot preference',await page.locator('[data-dsh-rb-welcome]').getAttribute('data-preset')==='default');
 await page.evaluate(()=>store.update({welcomeMascot:false}));await page.reload();await page.waitForFunction(()=>window.store);check('disabled preference survives restart',await page.locator('[data-dsh-rb-welcome]').count()===0);
 await page.evaluate(()=>store.update({welcomeMascot:true}));await ready();await page.evaluate(()=>disposePlugin());
 check('plugin disposal removes all mascot DOM and layout markers',await page.locator('[data-dsh-rb-welcome],[data-dsh-rb-welcome-seat]').count()===0);
 check('plugin disposal disconnects its observers',await page.evaluate(()=>[...activeObservers].filter(o=>o.qaTarget?.nodeType!==9).length===0));
 check('no browser runtime errors',errors.length===0);check('only local fixture and embedded images requested',requests.every(url=>url.startsWith('file:')||url.startsWith('data:')));
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({browser:await browser.version(),checks,errors,scope:'actual built plugin on a generic DSH-shaped fixture; real DSH acceptance pending'},null,2));
 console.log(JSON.stringify({checks:checks.length,passed:true,output:out}));
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close()});
