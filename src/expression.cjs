'use strict';
// Small data-only arithmetic grammar. Never eval/Function/property access.
const FUNCTIONS=Object.freeze({sin:[Math.sin,1,1],cos:[Math.cos,1,1],tan:[Math.tan,1,1],exp:[Math.exp,1,1],log:[Math.log,1,1],ln:[Math.log,1,1],sqrt:[Math.sqrt,1,1],abs:[Math.abs,1,1],floor:[Math.floor,1,1],ceil:[Math.ceil,1,1],round:[Math.round,1,1],pow:[Math.pow,2,2],min:[Math.min,2,8],max:[Math.max,2,8],clamp:[(x,a,b)=>Math.min(b,Math.max(a,x)),3,3]});
const CONSTANTS=Object.freeze({pi:Math.PI,e:Math.E});
function compileExpression(source,variables) {
  if(typeof source!=='string'||!source.trim()||source.length>600)throw Error('表达式需为 1–600 字符');
  const allowed=new Set(variables),tokens=[];let i=0;
  while(i<source.length){const s=source.slice(i);const ws=/^\s+/.exec(s);if(ws){i+=ws[0].length;continue;}
    const m=/^(?:(\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z_0-9]*|\*\*|[+*/^(),-])/.exec(s);
    if(!m)throw Error('表达式只能包含算术、变量和支持的函数');tokens.push(m[0]);i+=m[0].length;if(tokens.length>220)throw Error('表达式过于复杂');
  }
  let pos=0,depth=0;const peek=()=>tokens[pos],take=()=>tokens[pos++];
  function primary(){if(++depth>32)throw Error('表达式嵌套过深');let node;const token=take();
    if(token==='('){node=add();if(take()!==')')throw Error('括号不匹配');}
    else if(token&&/^(?:\d|\.)/.test(token)){const n=Number(token);if(!Number.isFinite(n))throw Error('数字必须有限');node={type:'number',value:n};}
    else if(token&&/^[A-Za-z_]/.test(token)){
      if(peek()==='('){take();const spec=Object.hasOwn(FUNCTIONS,token)?FUNCTIONS[token]:null;if(!spec)throw Error('不支持的函数：'+token);const args=[];if(peek()!==')'){args.push(add());while(peek()===','){take();args.push(add());}}if(take()!==')'||args.length<spec[1]||args.length>spec[2])throw Error('函数参数不正确：'+token);node={type:'call',name:token,args};}
      else if(Object.hasOwn(CONSTANTS,token))node={type:'number',value:CONSTANTS[token]};
      else if(allowed.has(token))node={type:'variable',name:token};
      else throw Error('未声明变量：'+token);
    }else throw Error('表达式不完整');depth--;return node;
  }
  function power(){let n=primary();if(peek()==='^'||peek()==='**'){take();n={type:'binary',op:'^',left:n,right:unary()};}return n;}
  function unary(){if(peek()==='+'||peek()==='-'){const op=take();return{type:'unary',op,value:unary()};}return power();}
  function multiply(){let n=unary();while(peek()==='*'||peek()==='/'){const op=take();n={type:'binary',op,left:n,right:unary()};}return n;}
  function add(){let n=multiply();while(peek()==='+'||peek()==='-'){const op=take();n={type:'binary',op,left:n,right:multiply()};}return n;}
  const tree=add();if(pos!==tokens.length)throw Error('表达式中有未识别的内容');return tree;
}
function evaluateExpression(tree,values){
  function run(n){switch(n.type){case'number':return n.value;case'variable':return Object.hasOwn(values,n.name)?values[n.name]:NaN;case'unary':return(n.op==='-'?-1:1)*run(n.value);case'call':return FUNCTIONS[n.name][0](...n.args.map(run));case'binary':{const a=run(n.left),b=run(n.right);return n.op==='+'?a+b:n.op==='-'?a-b:n.op==='*'?a*b:n.op==='/'?a/b:Math.pow(a,b);}default:return NaN;}}
  const value=run(tree);return Number.isFinite(value)?value:null;
}
module.exports={FUNCTIONS,CONSTANTS,compileExpression,evaluateExpression};
