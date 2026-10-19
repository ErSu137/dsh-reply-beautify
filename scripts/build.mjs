import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const names=['core.cjs','expression.cjs','interactive-model.cjs','interactive-state.cjs','interactive-view.cjs','rich-model.cjs','rich-view.cjs','scenario-view.cjs','artifact-model.cjs','artifact-store.cjs','artifact-view.cjs','content-model.cjs','flow-layout.cjs','content-view.cjs','content-controller.cjs','client.cjs','panel.css','content.css'];
const factories=names.map(name=>{
  const source=fs.readFileSync(path.join(root,'src',name),'utf8');
  return `${JSON.stringify('./'+name)}:(require,module,exports)=>{${name.endsWith('.css')?'module.exports='+JSON.stringify(source):source}\n}`;
}).join(',\n');
const bundle = `window.__ModuleLoader__.load({id:"dsh-reply-beautify",factory:(require)=>{
const factories={${factories}},cache={};
const localRequire=(name)=>{if(!Object.hasOwn(factories,name))return require(name);if(!cache[name]){cache[name]={exports:{}};factories[name](localRequire,cache[name],cache[name].exports);}return cache[name].exports;};
return localRequire('./client.cjs');
}});\n`;
new vm.Script(bundle, { filename: 'client.js' });
fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
fs.writeFileSync(path.join(root, 'lib/client.js'), bundle);
fs.copyFileSync(path.join(root, 'src/index.js'), path.join(root, 'lib/index.js'));
fs.copyFileSync(path.join(root, 'src/host-guidance.cjs'), path.join(root, 'lib/host-guidance.cjs'));
fs.copyFileSync(path.join(root, 'src/rich-guidance.cjs'), path.join(root, 'lib/rich-guidance.cjs'));
fs.copyFileSync(path.join(root, 'src/artifact-guidance.cjs'), path.join(root, 'lib/artifact-guidance.cjs'));
console.log(`Built lib/client.js (${Buffer.byteLength(bundle)} bytes), no runtime dependencies.`);
