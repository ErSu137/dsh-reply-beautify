const test=require('node:test'),assert=require('node:assert/strict');
const {welcomeLayout,overlaps}=require('../src/welcome-model.cjs');
const {normalize,createPreferences,STORAGE_KEY}=require('../src/core.cjs');

test('existing preferences gain a mascot toggle without resetting typography',()=>{
 const old={schema:1,preset:'claude',font:18,enabled:true};const data=new Map([[STORAGE_KEY,JSON.stringify(old)]]);
 const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},store=createPreferences(storage);
 assert.equal(store.getSnapshot().preferences.welcomeMascot,true);assert.equal(store.getSnapshot().preferences.font,18);
 store.update({welcomeMascot:false});store.setPreset('chatgpt');store.reset();store.update({enabled:false});store.update({enabled:true});
 assert.equal(createPreferences(storage).getSnapshot().preferences.welcomeMascot,false);
 assert.equal(normalize({welcomeMascot:'false'}).welcomeMascot,true);
});
test('approved desktop ratios keep feet above the baseline and reserve the input column',()=>{
 const composer={x:300,y:490,width:880,height:150};
 for(const preset of ['default','chatgpt','claude']){
  const layout=welcomeLayout(1485,1000,preset,composer);assert.ok(layout);
  assert.equal(layout.image.y+layout.image.height,976);
  assert.ok(Math.abs(layout.image.height/952-(preset==='default'?1/3:2/3))<1e-10);
  if(preset!=='default'){assert.ok(layout.lane>0);assert.ok(1485-layout.lane-24>=520);}
 }
});
test('responsive decorations either fit around the composer or yield without covering it',()=>{
 for(const width of [300,430,640,860,900,1100,1485])for(const height of [350,520,700,1000])for(const preset of ['default','chatgpt','claude']){
  const composer={x:24,y:height*.46,width:width-48,height:Math.min(180,height*.25)};
  const layout=welcomeLayout(width,height,preset,composer);if(!layout)continue;
  for(const box of [layout.image,layout.bubble]){assert.ok(box.x>=0&&box.y>=0);assert.ok(box.x+box.width<=width+.01);assert.ok(box.y+box.height<=height+.01);}
  const protectedRect=layout.lane?{...composer,x:24,width:width-layout.lane-24}:composer;
  assert.equal(overlaps(layout.image,protectedRect),false,JSON.stringify({width,height,preset,layout}));
  assert.equal(overlaps(layout.bubble,protectedRect),false,JSON.stringify({width,height,preset,layout}));
 }
 assert.equal(welcomeLayout(280,400,'default',{}),null);
});
test('the real brush control persists its independent mascot switch',()=>{
 const fs=require('node:fs'),vm=require('node:vm');let definition,control,store;
 const React={createElement:(type,props,...children)=>({type,props:props||{},children}),useSyncExternalStore:(_,read)=>read(),useLayoutEffect(){},useState:()=>[false,()=>{}],useRef:()=>({current:null}),useCallback:fn=>fn};
 const window={localStorage:{getItem:()=>null,setItem(){}},__ModuleLoader__:{load:value=>definition=value}};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../lib/client.js'),'utf8'),{window,document:{}});
 const plugin=definition.factory(name=>name==='react'?React:{Tooltip(){}});
 plugin.apply({effect(){},slots:{inject:(_,fn)=>fn(),register:(spec,component)=>{if(spec.name==='sidebar.footer.action'){control=component;store=spec.inject().preferences;}}}});
 const find=n=>{if(!n||typeof n!=='object')return;if(n.props?.['aria-label']==='启动页卡通形象')return n;for(const c of (n.children||[]).flat(Infinity)){const hit=find(c);if(hit)return hit;}};
 let toggle=find(control({preferences:store}));assert.equal(toggle.props.checked,true);toggle.props.onChange({target:{checked:false}});assert.equal(store.getSnapshot().preferences.welcomeMascot,false);
 store.update({enabled:false});toggle=find(control({preferences:store}));assert.equal(toggle.props.disabled,true);assert.equal(toggle.props.checked,false);
});
