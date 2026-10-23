import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const template=readFileSync('src/template.html','utf8');
const output=template.replace('/* STYLES */',()=>readFileSync('src/style.css','utf8')).replace('/* ENGINE */',()=>readFileSync('src/engine.js','utf8')).replace('/* APP */',()=>readFileSync('src/app.js','utf8'));
mkdirSync('dist',{recursive:true});writeFileSync('dist/index.html',output);
console.log('Built standalone dist/index.html ('+Buffer.byteLength(output)+' bytes)');
