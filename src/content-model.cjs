'use strict';
const {normalizeInteractive}=require('./interactive-model.cjs');
const {TYPES:RICH_TYPES,normalizeRich}=require('./rich-model.cjs');
const {normalizeArtifact}=require('./artifact-model.cjs');

// Parse data only. No code execution, HTML, remote resources or guessed values.
const MAX_SOURCE = 40000;
const text = (value, max=240) => typeof value === 'string' && value.trim().length > 0 && value.length <= max ? value : null;
const fail = reason => ({ error: reason });
function label(value) { return text(value,240); }
function normalizeDiagram(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return fail('图示必须是一个 JSON 对象');
  if (data.title !== undefined && !text(data.title,160)) return fail('标题无效或过长');
  if (data.description !== undefined && !text(data.description,600)) return fail('说明无效或过长');
  const common = { title:data.title || '', description:data.description || '' };
  if (data.type === 'flow') {
    if (!['TD','LR',undefined].includes(data.direction)) return fail('流程方向只支持 TD / LR');
    if (!Array.isArray(data.nodes) || !data.nodes.length || data.nodes.length > 30 || !Array.isArray(data.edges) || data.edges.length > 50) return fail('流程最多 30 个节点、50 条连线');
    const ids = new Set(), nodes = [];
    for (const node of data.nodes) {
      if (!node || !text(node.id,60) || !/^[\w-]+$/.test(node.id) || ids.has(node.id) || !label(node.label)) return fail('流程节点的 id 或文字无效');
      if (![undefined,'plain','accent','muted'].includes(node.tone) || ![undefined,'box','decision','round'].includes(node.shape)) return fail('不支持的节点样式');
      ids.add(node.id); nodes.push({id:node.id,label:node.label,tone:node.tone || 'plain',shape:node.shape || 'box'});
    }
    const edges = [];
    for (const edge of data.edges) {
      if (!edge || !ids.has(edge.from) || !ids.has(edge.to) || edge.from===edge.to || (edge.label !== undefined && edge.label!=='' && !text(edge.label,80))) return fail('连线引用不存在的节点或含无效文字');
      edges.push({from:edge.from,to:edge.to,label:edge.label || ''});
    }
    // DAG layout is deliberate: cycles must fall back, never silently lose an edge.
    const degree = new Map(nodes.map(n=>[n.id,0])), ranks = new Map(nodes.map(n=>[n.id,0]));
    edges.forEach(e=>degree.set(e.to,degree.get(e.to)+1));
    const queue = nodes.filter(n=>degree.get(n.id)===0).map(n=>n.id);
    let visited=0;
    for (let i=0;i<queue.length;i++) {
      const id=queue[i];visited++;
      for (const e of edges.filter(e=>e.from===id)) { ranks.set(e.to,Math.max(ranks.get(e.to),ranks.get(id)+1));degree.set(e.to,degree.get(e.to)-1);if(degree.get(e.to)===0)queue.push(e.to); }
    }
    if (visited!==nodes.length) return fail('暂不支持带回环的流程，请查看原文');
    return {...common,kind:'flow',direction:data.direction || 'TD',nodes:nodes.map(n=>({...n,rank:ranks.get(n.id)})),edges};
  }
  if (data.type === 'fields') {
    if (!Array.isArray(data.rows) || !data.rows.length || data.rows.length>24) return fail('字段图需要 1–24 行');
    const rows=[];
    let total=null;
    for (const row of data.rows) {
      if (!row || !Array.isArray(row.cells) || !row.cells.length || row.cells.length>16) return fail('每行需要 1–16 个字段');
      const cells=[];
      for (const cell of row.cells) {
        if (!cell || !label(cell.label) || ![undefined,'plain','accent','muted'].includes(cell.tone)) return fail('字段文字或样式无效');
        const bits=cell.bits;
        if (bits!==undefined && (!Number.isInteger(bits) || bits<1 || bits>1024)) return fail('字段位数必须是正整数');
        cells.push({label:cell.label,weight:bits || 1,bits,tone:cell.tone || 'plain'});
      }
      if (cells.some(c=>c.bits!==undefined) && !cells.every(c=>c.bits!==undefined)) return fail('同一行字段必须全部标注位数或全部不标注');
      if (cells.every(c=>c.bits!==undefined)) {
        const sum=cells.reduce((s,c)=>s+c.bits,0);
        if (total!==null && total!==sum) return fail('各行位数合计不一致，保留原文以免误导');
        total=sum;
      }
      if (row.note!==undefined && !text(row.note,80)) return fail('行说明无效');
      rows.push({cells,note:row.note || ''});
    }
    return {...common,kind:'fields',rows,totalBits:total,origin:'structured'};
  }
  return fail('暂不支持这种图示类型');
}

function normalizeChart(data) {
  if (!data || !['bar','line','pie','donut','stacked'].includes(data.type)) return fail('图表支持 bar / line / pie / donut / stacked');
  if (data.title!==undefined && !text(data.title,160)) return fail('标题无效');
  if (data.unit!==undefined && !text(data.unit,32)) return fail('单位无效');
  if (data.description!==undefined && !text(data.description,600)) return fail('说明无效');
  if (!Array.isArray(data.labels) || !data.labels.length || data.labels.length>24 || !data.labels.every(v=>text(v,80))) return fail('图表需要 1–24 个分类标签');
  if (!Array.isArray(data.series) || !data.series.length || data.series.length>4) return fail('图表需要 1–4 组数据');
  const series=[];
  for (const s of data.series) {
    if (!s || !text(s.name,80) || !Array.isArray(s.values) || s.values.length!==data.labels.length || !s.values.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e12)) return fail('每组数据必须与标签一一对应，且全部为有限数字');
    series.push({name:s.name,values:[...s.values]});
  }
  if(['pie','donut'].includes(data.type)&&(series.length!==1||series[0].values.some(v=>v<0)||!series[0].values.some(v=>v>0)))return fail('比例图只支持一组非负且总和大于零的数据');
  return {kind:'chart',chartType:data.type,title:data.title || '',description:data.description || '',unit:data.unit || '',labels:[...data.labels],series};
}

function parseMermaid(source) {
  const lines=source.split(/\r?\n/).map(v=>v.trim()).filter(v=>v&&!v.startsWith('%%'));
  const head=/^(?:flowchart|graph)\s+(TD|TB|LR)\s*;?$/.exec(lines.shift() || '');
  if (!head) return fail('目前支持 Mermaid flowchart TD / LR；其他语法保留原文');
  const nodes=new Map(), edges=[];
  function node(raw) {
    const m=/^([A-Za-z_][\w-]*)(?:\[([^\[\]]+)\]|\{([^{}]+)\}|\(([^()]+)\))?$/.exec(raw.trim());
    if (!m) return null;
    let value=m[2]??m[3]??m[4];
    if (value?.startsWith('"') && value.endsWith('"')) value=value.slice(1,-1);
    if (value && /<|>|&(?:#|\w+;)|\[|\]/.test(value)) return null;
    const existing=nodes.get(m[1]);
    if (existing && value && existing.explicit && existing.label!==value) return null;
    if (!existing || value) nodes.set(m[1],{id:m[1],label:value || m[1],shape:m[3]?'decision':m[4]?'round':'box',explicit:!!value});
    return m[1];
  }
  for (const statement of lines.flatMap(l=>l.split(';')).map(l=>l.trim()).filter(Boolean)) {
    if (/^(?:style|classDef|class|click|subgraph|end|linkStyle|direction|accTitle|accDescr)\b/.test(statement)) return fail('此 Mermaid 使用了暂不支持的指令，保留完整原文');
    const parts=statement.split(/\s*-->(?:\|([^|]{1,80})\|)?\s*/);
    if (parts.length===1) { if (!node(statement)) return fail('无法可靠解析此 Mermaid 节点');continue; }
    let from=node(parts[0]);
    if (!from) return fail('无法可靠解析流程节点');
    for (let i=1;i<parts.length;i+=2) {const to=node(parts[i+1] || '');if(!to)return fail('无法可靠解析流程连线');edges.push({from,to,label:parts[i] || ''});from=to;}
  }
  return normalizeDiagram({type:'flow',direction:head[1]==='LR'?'LR':'TD',nodes:[...nodes.values()],edges});
}

// A conservative ASCII grid recognizer. Each bounded section is one row; cells
// are joined only when all physical lines have the same number of pipes.
function visualWidth(s) { return [...s].reduce((n,c)=>n+(/[^\u0000-\u00ff]/.test(c)?2:1),0); }
function parseAscii(source) {
  const lines=source.replace(/\r/g,'').replace(/\t/g,'    ').split('\n');
  const border = s => /^\s*\+(?:[-=]{2,}\+)+\s*$/.test(s);
  const boundaries=lines.map((s,i)=>border(s)?i:-1).filter(i=>i>=0);
  if (boundaries.length<3 || boundaries.length>25) return null;
  const first=boundaries[0],last=boundaries.at(-1);
  // Rulers/titles above the frame are kept verbatim, not inferred as bit counts.
  const prefix=lines.slice(0,first).join('\n').trim(),suffix=lines.slice(last+1).join('\n').trim();
  if (prefix.length>500 || suffix.length>300) return null;
  const rows=[];
  for (let b=0;b<boundaries.length-1;b++) {
    const raw=lines.slice(boundaries[b]+1,boundaries[b+1]).filter(l=>l.trim());
    if (!raw.length || raw.length>5) return null;
    const parsed=[];
    for (const line of raw) {
      const m=/^\s*\|(.+)\|\s*([^|]*)$/.exec(line);
      if (!m || m[2].trim().length>32) return null;
      const parts=m[1].split('|');
      if (!parts.length || parts.length>16 || parts.some(p=>p.trim().length>240)) return null;
      parsed.push({parts,note:m[2].trim()});
    }
    if (parsed.some(r=>r.parts.length!==parsed[0].parts.length) || new Set(parsed.map(r=>r.note).filter(Boolean)).size>1) return null;
    const cells=parsed[0].parts.map((_,i)=>({label:parsed.map(r=>r.parts[i].trim()).filter(Boolean).join('\n'),weight:Math.max(1,...parsed.map(r=>visualWidth(r.parts[i]))),tone:'plain'}));
    if (cells.some(c=>!c.label)) return null;
    // Reject program-like blocks rather than relabeling their content as a diagram.
    if (cells.some(c=>/(?:=>|\b(?:function|return|const|let|class)\b|[{};])/.test(c.label))) return null;
    rows.push({cells,note:parsed.find(r=>r.note)?.note || ''});
  }
  if (!rows.length) return null;
  return {kind:'fields',origin:'ascii',title:'',description:'',rows,prefix,suffix,totalBits:null};
}

function parseTextFlow(source) {
  const lines=source.trim().split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  let labels;
  if(lines.length===1) {
    labels=lines[0].split(/\s*→\s*|\s+(?:-->|->)\s+/);
    if(labels.length<3)return null;
  } else {
    if(lines.length<3 || lines.length%2===0 || !lines.every((s,i)=>i%2===0 || /^(?:↓|⬇)$/.test(s)))return null;
    labels=lines.filter((_,i)=>i%2===0);
  }
  if(labels.length>20 || labels.some(s=>!text(s,120) || /[{};\\]|\b(?:function|return|const|let|class|import)\b/.test(s)))return null;
  const nodes=labels.map((s,i)=>({id:'n'+i,label:s.replace(/^\[([^\[\]]+)\]$/,'$1')}));
  const result=normalizeDiagram({type:'flow',direction:lines.length===1?'LR':'TD',nodes,edges:nodes.slice(1).map((n,i)=>({from:nodes[i].id,to:n.id}))});
  return result.error?null:{...result,origin:'text-flow'};
}

function parseContent(language,source) {
  const lang=String(language || '').trim().toLowerCase();
  if (typeof source!=='string' || source.length>MAX_SOURCE) return ['dsh-artifact','dsh-ui',...RICH_TYPES.map(t=>'dsh-'+t),'dsh-diagram','dsh-chart','dsh-quiz','dsh-form','dsh-explorer','mermaid','math','latex','tex'].includes(lang) ? fail('内容过长，显示原文') : null;
  if(lang==='dsh-artifact') {let data;try{data=JSON.parse(source);}catch{return fail('作品JSON尚未完整或格式有误');}return normalizeArtifact(data);}
  if(lang==='dsh-ui'||RICH_TYPES.some(t=>lang==='dsh-'+t)){
    let data;try{data=JSON.parse(source);}catch{return fail('组件JSON尚未完整或格式有误');}
    return lang==='dsh-ui'||data?.type===lang.slice(4)?(data?.type==='artifact'?normalizeArtifact(data):normalizeRich(data)):fail('组件类型与围栏不一致');
  }
  if (['dsh-quiz','dsh-explorer','dsh-form'].includes(lang)){
    let data;try{data=JSON.parse(source);}catch{return fail('交互 JSON 尚未完整或格式有误，显示原文');}
    const expected={'dsh-quiz':'quiz','dsh-explorer':'explorer','dsh-form':'form'}[lang];
    return data?.type===expected?normalizeInteractive(data):fail('交互类型与围栏不一致');
  }
  if (lang==='dsh-diagram' || lang==='dsh-chart') {
    let data;try {data=JSON.parse(source);} catch {return fail('JSON 尚未完整或格式有误，显示原文');}
    return lang==='dsh-diagram'?normalizeDiagram(data):normalizeChart(data);
  }
  if (lang==='mermaid') return parseMermaid(source);
  // DSH 0.2.1 labels unknown fence languages as “代码块” and does not expose
  // their original tag in the DOM. Recognize only self-identifying grammars in
  // unlabelled/plain blocks; never inspect a Python/JS/JSON-labelled block.
  if (!lang || ['text','plaintext','ascii'].includes(lang)) {
    if (/^\s*(?:%%[^\n]*\n\s*)*(?:flowchart|graph)\s+(?:TD|TB|LR)\b/.test(source))return parseMermaid(source);
    if (/^\s*\{/.test(source)) {
      let data;try{data=JSON.parse(source);}catch{return null;}
      if(data?.type==='artifact'&&typeof data.id==='string'&&typeof data.title==='string'&&typeof data.html==='string')return normalizeArtifact(data);
      if(data && ['bar','line','pie','donut','stacked'].includes(data.type) && Array.isArray(data.labels) && Array.isArray(data.series))return normalizeChart(data);
      if(data && RICH_TYPES.includes(data.type)&&typeof data.title==='string')return normalizeRich(data);
      if(data && ((data.type==='quiz'&&Array.isArray(data.questions))||(data.type==='explorer'&&Array.isArray(data.parameters)&&Array.isArray(data.series))||(data.type==='form'&&Array.isArray(data.fields))))return normalizeInteractive(data);
      if(data && ((data.type==='flow'&&Array.isArray(data.nodes)&&Array.isArray(data.edges))||(data.type==='fields'&&Array.isArray(data.rows))))return normalizeDiagram(data);
    }
    if (/^\s*\\(?:frac|dfrac|tfrac|operatorname|sum|int|sqrt|begin|mathbf|mathrm)\b/.test(source))return parseContent('latex',source);
  }
  if (['math','latex','tex'].includes(lang)) {
    let formula=source.trim().replace(/^\$\$([\s\S]*)\$\$$/,'$1').replace(/^\\\[([\s\S]*)\\\]$/,'$1').trim();
    if (!formula || formula.length>2500 || /\\(?:href|url|html\w*|include\w*|require|def|gdef|newcommand|renewcommand|macro)\b/.test(formula)) return fail('公式包含暂不处理的命令或过长，显示原文');
    return {kind:'math',formula,title:''};
  }
  if (!lang || ['text','plaintext','ascii'].includes(lang)) return parseAscii(source) || parseTextFlow(source);
  return null;
}
module.exports={MAX_SOURCE,normalizeDiagram,normalizeChart,parseMermaid,parseAscii,parseTextFlow,parseContent,visualWidth};
