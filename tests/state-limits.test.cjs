'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createInteractionState,KEY}=require('../src/interactive-state.cjs');
const memory=()=>{const data=new Map();return{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),data};};
test('temporary states have bounded LRU entry count and total payload',()=>{
 const s=createInteractionState();assert.equal(s.persistent('p:a'),false);
 for(let i=0;i<500;i++)s.save('m:'+i,{n:i});assert.deepEqual(s.load('m:0'),{});assert.equal(s.load('m:499').n,499);assert.equal(s.load('m:340').n,340);
 for(let i=0;i<10;i++)s.save('m:large'+i,{text:'x'.repeat(100000)});assert.deepEqual(s.load('m:large0'),{});assert.equal(s.load('m:large9').text.length,100000);
});
test('persisted recency stays monotonic in one timestamp and latest saves survive restart',()=>{
 const storage=memory(),s=createInteractionState(storage);for(let i=0;i<120;i++)assert.equal(s.save('p:'+i,{n:i}),true);
 const records=JSON.parse(storage.data.get(KEY)).entries;assert.equal(Object.keys(records).length,80);assert.ok(records['p:119']);assert.ok(!records['p:0']);
 const restarted=createInteractionState(storage);assert.equal(restarted.load('p:119').n,119);assert.deepEqual(restarted.load('p:0'),{});assert.equal(s.persistent('p:0'),false);
});
test('corrupt per-record data is ignored and a quota failure never overwrites the last saved snapshot',()=>{
 const storage=memory();storage.setItem(KEY,JSON.stringify({schema:1,entries:{'p:bad':null,'p:array':{updated:2,state:[]},'p:good':{updated:3,state:{x:1}}}}));
 const s=createInteractionState(storage);assert.deepEqual(s.load('p:bad'),{});assert.deepEqual(s.load('p:array'),{});assert.equal(s.load('p:good').x,1);
 const before=storage.getItem(KEY),set=storage.setItem;storage.setItem=()=>{throw Error('quota');};assert.equal(s.save('p:good',{x:2}),false);assert.equal(storage.getItem(KEY),before);assert.equal(s.load('p:good').x,2);assert.equal(s.persistent('p:good'),false);
 storage.setItem=set;assert.equal(s.save('p:other',{y:1}),true);assert.equal(s.persistent('p:good'),false,'failed state cannot be reported saved after another key recovers');assert.equal(s.save('p:good',{x:2}),true);assert.equal(s.persistent('p:good'),true);
});
test('malformed and oversized states fail without crashing interaction handlers',()=>{
 const storage=memory(),s=createInteractionState(storage),cyclic={};cyclic.self=cyclic;
 assert.equal(s.save('p:a',{old:true}),true);
 for(const value of [cyclic,[],null,{a:1n},{a:'x'.repeat(280001)}]){assert.equal(s.save('p:a',value),false);assert.equal(s.persistent('p:a'),false);}
 assert.equal(s.save('p:a',{valid:true}),true);assert.deepEqual(createInteractionState(storage).load('p:a'),{valid:true});assert.ok(storage.getItem(KEY).length<=280000);
});
