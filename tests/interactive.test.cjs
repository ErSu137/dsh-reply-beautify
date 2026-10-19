const test=require('node:test'),assert=require('node:assert/strict');
const {compileExpression,evaluateExpression}=require('../src/expression.cjs');
const {normalizeInteractive,quizResult,formResult,explorerData}=require('../src/interactive-model.cjs');
const {createInteractionState,KEY}=require('../src/interactive-state.cjs');
const {parseContent}=require('../src/content-model.cjs');
const distribution={type:'explorer',title:'正态分布',parameters:[{id:'mu',label:'均值',min:-2,max:2,step:.1,value:0},{id:'sigma',label:'标准差',min:.2,max:3,step:.1,value:1}],x:{min:-6,max:6,label:'x',points:161},series:[{name:'密度',expression:'exp(-0.5*((x-mu)/sigma)^2)/(sigma*sqrt(2*pi))'}],metrics:[{label:'方差',expression:'sigma^2'}]};
const quiz={type:'quiz',title:'自测',questions:[{id:'one',prompt:'偶数？',options:[{id:'a',label:'3'},{id:'b',label:'4'}],correct:['b'],explanation:'4能被2整除'},{id:'two',prompt:'请选择素数',multiple:true,options:[{id:'a',label:'2'},{id:'b',label:'3'},{id:'c',label:'4'}],correct:['a','b']}]};
const form={type:'form',title:'方案偏好',fields:[{id:'goal',type:'text',label:'目标',required:true},{id:'days',type:'number',label:'天数',min:1,max:30,step:1,required:true},{id:'format',type:'select',label:'形式',required:true,options:[{id:'brief',label:'清单'},{id:'detail',label:'详细'}]}]};
test('expression precedence, functions and undefined domains are deterministic',()=>{
 for(const [s,n] of [['-2^2',-4],['2^3^2',512],['2^-2',.25],['max(2,3)+sqrt(9)',6],['clamp(9,1,4)',4]])assert.equal(evaluateExpression(compileExpression(s,[]),{}),n);
 assert.equal(evaluateExpression(compileExpression('sqrt(x)',['x']),{x:-1}),null);
 assert.ok(Math.abs(evaluateExpression(compileExpression('sin(pi/2)',[]),{})-1)<1e-12);
});
test('expressions cannot execute JS, access properties or use undeclared inputs',()=>{
 for(const s of ['window.alert(1)','constructor(1)','x=2','Math.sin(x)','fetch("https://x")','a+1','x[0]','(1+2','2 3','1e999'])assert.throws(()=>compileExpression(s,['x']));
 assert.throws(()=>compileExpression('('.repeat(40)+'1'+')'.repeat(40),[]));
});
test('slider parameters move density and variance together from the same formula',()=>{
 const m=normalizeInteractive(distribution);assert.equal(m.kind,'explorer');
 const a=explorerData(m),b=explorerData(m,{sigma:2});assert.equal(a.metrics[0].value,1);assert.equal(b.metrics[0].value,4);
 assert.ok(Math.abs(a.series[0].values[80]/b.series[0].values[80]-2)<1e-10);
 const shifted=explorerData(m,{mu:1});const peak=shifted.series[0].values.indexOf(Math.max(...shifted.series[0].values));assert.ok(Math.abs(shifted.x[peak]-1)<.08);
 const clamped=explorerData(m,{sigma:-1});assert.equal(clamped.parameters.sigma,.2);
});
test('generic cost calculation works outside learning examples',()=>{
 const m=normalizeInteractive({type:'explorer',title:'数量与成本',parameters:[{id:'price',label:'单价',min:1,max:100,step:1,value:5}],x:{min:0,max:20,label:'数量'},series:[{name:'成本',expression:'price*x+30'}],metrics:[{label:'10件总价',expression:'price*10+30'}]});
 assert.equal(explorerData(m).metrics[0].value,80);assert.equal(explorerData(m,{price:10}).metrics[0].value,130);
 assert.equal(explorerData(m,{price:10}).series[0].values.at(-1),230);
});
test('invalid ranges, reserved names and unsafe formulas fall back',()=>{
 for(const change of [{parameters:[{...distribution.parameters[0],id:'x'}]},{x:{min:0,max:0}},{series:[{name:'bad',expression:'alert(1)'}]},{metrics:[{label:'bad',expression:'x+1'}]},{parameters:[{...distribution.parameters[1],step:0}]}])assert.ok(normalizeInteractive({...distribution,...change}).error);
 assert.equal(parseContent('',JSON.stringify(distribution)).kind,'explorer');assert.equal(parseContent('json',JSON.stringify(distribution)),null);
});
test('quiz checking requires complete answers and exact multi-select sets',()=>{
 const m=normalizeInteractive(quiz);assert.equal(quizResult(m,{}).missing.length,2);assert.equal(quizResult(m,{one:['b'],two:['a','b']}).score,2);assert.equal(quizResult(m,{one:['a'],two:['a','b','c']}).score,0);
 const poll=normalizeInteractive({...quiz,questions:[{...quiz.questions[0],correct:undefined}]});assert.equal(quizResult(poll,{one:['b']}).answers[0].correct,null);
 assert.ok(normalizeInteractive({...quiz,questions:[{...quiz.questions[0],correct:['x']}]}).error);
});
test('form confirmation enforces required fields, ranges, steps and known choices',()=>{
 const m=normalizeInteractive(form);assert.equal(Object.keys(formResult(m,{}).errors).length,3);
 assert.equal(Object.keys(formResult(m,{goal:'完成方案',days:7,format:'brief'}).errors).length,0);
 assert.ok(formResult(m,{goal:'a',days:1.5,format:'unknown'}).errors.days);
 assert.ok(formResult(m,{goal:'a',days:31,format:'brief'}).errors.days);
});
function node(session='session-a',id='node-1'){const n={closest(sel){if(sel==='[data-dsh-rb-session]')return{getAttribute:()=>session};return{getAttribute:()=>id,querySelectorAll:()=>[n]};}};return n;}
test('state restores after recreation but stays isolated by session and source',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},s=createInteractionState(storage);
 const a=s.keyFor(node(),'same'),b=s.keyFor(node('session-b'),'same'),c=s.keyFor(node(),'changed');assert.notEqual(a,b);assert.notEqual(a,c);assert.equal(s.save(a,{parameters:{sigma:2}}),true);
 const reboot=createInteractionState(storage);assert.equal(reboot.load(a).parameters.sigma,2);assert.deepEqual(reboot.load(b),{});assert.deepEqual(reboot.load(c),{});
 for(let i=0;i<90;i++)s.save('p:'+i,{value:i});assert.ok(Object.keys(JSON.parse(values.get(KEY)).entries).length<=80);
});
test('storage failure retains current page state and reports it as temporary',()=>{
 const s=createInteractionState({getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}),key=s.keyFor(node(),'state');assert.equal(s.save(key,{a:1}),false);assert.deepEqual(s.load(key),{a:1});assert.equal(s.persistent(key),false);
});
module.exports={distribution,quiz,form};
