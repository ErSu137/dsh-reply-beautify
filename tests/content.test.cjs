const test=require('node:test');
const assert=require('node:assert/strict');
const {parseContent,parseAscii,normalizeChart}=require('../src/content-model.cjs');

const tcp=` 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-------------------------------+-------------------------------+
|        源端口 (16)             |        目的端口 (16)           | 4B
+-------------------------------+-------------------------------+
|                         序号 seq (32)                         | 4B
+-------------------------------+-------------------------------+
|                        确认号 ack (32)                        | 4B
+-------+-------+-----+-----+-----+-----+-----+-----+--------------+
| 首部长 | 保留 | URG | ACK | PSH | RST | SYN | FIN |   窗口(16)  | 4B
|  (4)   | (6)  | (1) | (1) | (1) | (1) | (1) | (1) |            |
+-------------------------------+-------------------------------+
|           校验和 (16)          |         紧急指针 (16)         | 4B
+-------------------------------+-------------------------------+
|                     选项（可变，如 MSS）+ 填充                |
+---------------------------------------------------------------+
|                            数据                               |
+---------------------------------------------------------------+`;
const chart={type:'bar',title:'项目对比',unit:'小时',labels:['甲','乙','丙'],series:[{name:'预算',values:[12,18,9]},{name:'实际',values:[10,20,-2]}]};
test('TCP text grid retains every field, multiline flags, rulers and notes',()=>{
  const m=parseContent('',tcp);assert.equal(m.kind,'fields');assert.equal(m.rows.length,7);
  assert.equal(m.rows[3].cells.length,9);assert.equal(m.rows[3].cells[2].label,'URG\n(1)');assert.equal(m.rows[3].note,'4B');
  assert.ok(m.prefix.includes('0 1 2 3'));assert.equal(m.totalBits,null);
  assert.ok(m.rows[5].cells[0].label.includes('MSS'));
});
test('ordinary code, incomplete grids and incompatible rows stay native',()=>{
  assert.equal(parseContent('python',tcp),null);
  assert.equal(parseAscii('+----+\n| A |\n+----+'),null);
  assert.equal(parseAscii('+----+\n| A | B |\n| C |\n+----+\n| D |\n+----+'),null);
  assert.equal(parseContent('text','x^2 = 4; price $5; C:\\temp'),null);
});
test('Mermaid handles labels and branches, rejects partial/unsupported/cyclic graphs',()=>{
  const m=parseContent('mermaid','flowchart TD\nA[提交] --> B{检查}\nB -->|通过| C[处理]\nB -->|拒绝| D[返回]\nC --> E[完成]\nD --> E');
  assert.equal(m.kind,'flow');assert.equal(m.nodes.length,5);assert.equal(m.edges.length,5);assert.equal(m.edges[1].label,'通过');
  for(const s of ['flowchart TD\nA-->B\nB-->A','flowchart TD\nA-->B\nclick A "https://x"','sequenceDiagram\nA->>B: Hi','flowchart TD\nA[未结束','flowchart TD\nA-->B\nstyle A fill:red'])assert.ok(parseContent('mermaid',s).error);
});
test('structured fields validate bit widths and do not fabricate missing values',()=>{
  const input={type:'fields',rows:[{cells:[{label:'源端口',bits:16},{label:'目的端口',bits:16}]},{cells:[{label:'序号',bits:32}]}]};
  assert.equal(parseContent('dsh-diagram',JSON.stringify(input)).totalBits,32);
  input.rows[1].cells[0].bits=31;assert.ok(parseContent('dsh-diagram',JSON.stringify(input)).error);
  assert.ok(parseContent('dsh-diagram','{"type":').error);
});
test('charts preserve finite values including zero and negatives, reject mismatches',()=>{
  const m=normalizeChart(chart);assert.equal(m.series[1].values[2],-2);assert.equal(m.unit,'小时');
  assert.ok(normalizeChart({...chart,series:[{name:'bad',values:[1,2]}]}).error);
  assert.ok(normalizeChart({...chart,series:[{name:'bad',values:[0,1,Infinity]}]}).error);
  assert.ok(normalizeChart({...chart,labels:[]}).error);
});
test('native unknown-language fallback recognizes only self-identifying content',()=>{
  assert.equal(parseContent('',JSON.stringify(chart)).kind,'chart');
  assert.equal(parseContent('json',JSON.stringify(chart)),null);
  assert.equal(parseContent('javascript','flowchart TD\nA-->B'),null);
  assert.equal(parseContent('','flowchart TD\nA-->B').kind,'flow');
  assert.equal(parseContent('','\\frac{a}{b}').kind,'math');
  assert.equal(parseContent('','{"name":"ordinary data"}'),null);
});
test('unambiguous text arrows become a linear flow without rewriting labels',()=>{
  const horizontal=parseContent('','需求 → 方案 → 实施 → 验收');assert.equal(horizontal.kind,'flow');assert.equal(horizontal.direction,'LR');assert.equal(horizontal.nodes[2].label,'实施');
  const vertical=parseContent('text','输入\n↓\n处理\n↓\n输出');assert.equal(vertical.direction,'TD');assert.equal(vertical.edges.length,2);
  assert.equal(parseContent('javascript','需求 → 方案 → 实施'),null);
  assert.equal(parseContent('','const a = x -> y -> z;'),null);
  assert.equal(parseContent('','这段普通文字没有流程标记。'),null);
});
test('explicit math only; unsafe macros and oversized inputs fall back',()=>{
  assert.equal(parseContent('latex','\\frac{1}{n}\\sum_{i=1}^{n}x_i^2').kind,'math');
  assert.ok(parseContent('math','\\href{javascript:alert(1)}{x}').error);
  assert.ok(parseContent('dsh-chart','x'.repeat(40001)).error);
  const m=parseContent('dsh-diagram',JSON.stringify({type:'flow',nodes:[{id:'a',label:'<img src=x onerror=alert(1)>'}],edges:[]}));
  // Data remains literal text; renderer uses textContent, never innerHTML.
  assert.equal(m.nodes[0].label,'<img src=x onerror=alert(1)>');
});
module.exports={tcp,chart};
