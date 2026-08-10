// Bundle de src/main.js + inline no template => dist/index.html (arquivo único)
import * as esbuild from 'esbuild';
import fs from 'node:fs';

const res = await esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  write: false,
  logLevel: 'warning',
});

let js = res.outputFiles[0].text;
js = js.replace(/<\/script>/gi, '<\\/script>');

const template = fs.readFileSync('template.html', 'utf8');
if (!template.includes('/*__APP__*/')) throw new Error('placeholder ausente no template');
const html = template.replace('/*__APP__*/', () => js);

fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log('dist/index.html gerado:', (html.length / 1024).toFixed(0) + ' KB');
