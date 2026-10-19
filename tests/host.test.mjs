import test from 'node:test';
import assert from 'node:assert/strict';
import {apply,inject} from '../src/index.js';
test('model receives one small guide tool and a separately owned prompt section',async()=>{
 let tool,section;apply({tools:{register(t){tool=t;}},systemPrompt:{section(s){section=s;}}});
 assert.deepEqual(inject,['tools','systemPrompt']);assert.equal(tool.name,'reply_ui_guide');assert.equal(tool.parameters.additionalProperties,false);assert.equal(section.interpolate,false);
 assert.equal(tool.parameters.properties.kind.enum.length,17);
 for(const kind of tool.parameters.properties.kind.enum){const guide=await tool.execute({kind});assert.ok(guide.length<8192);assert.ok(guide.includes('```'));assert.equal(tool.output.render({},guide)[0].text,guide);}
 await assert.rejects(()=>tool.execute({kind:'unknown'}));await assert.rejects(()=>tool.execute({kind:'quiz',path:'secret'}));
 assert.ok(section.text.includes('user need not'));assert.ok(section.text.includes('not new messages'));
 assert.ok(section.text.includes('Do not default to an ASCII drawing'));
 assert.ok(section.text.includes('never guess values just to force a chart'));
 assert.ok(section.text.includes('Follow explicit requests for plain text'));
});
