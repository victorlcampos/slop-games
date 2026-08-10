#!/usr/bin/env node
// Empacota o jogo inteiro (Three.js incluso) num único HTML que abre com
// duplo clique, sem servidor. Não usa nenhuma dependência.
//
//   node build.js        -> dist/index.html
//
// Como funciona: cada módulo ES vira uma função registrada num mapa e os
// imports viram chamadas a __req(). Só precisa dar conta da sintaxe estática
// que este projeto (e o build ESM do three) realmente usa.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve as resolvePath, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolvePath(fileURLToPath(new URL('.', import.meta.url)));
const ENTRY = join(ROOT, 'src/main.js');
const OUT = join(ROOT, 'dist/index.html');

const ALIASES = [
  ['three/addons/', join(ROOT, 'vendor/addons/')],
  ['three', join(ROOT, 'vendor/three.module.js')],
];

function resolveSpecifier(spec, fromFile) {
  for (const [prefix, target] of ALIASES) {
    if (spec === prefix.replace(/\/$/, '') || spec === prefix) return target;
    if (prefix.endsWith('/') && spec.startsWith(prefix)) {
      return join(target, spec.slice(prefix.length));
    }
  }
  if (spec.startsWith('.')) return resolvePath(dirname(fromFile), spec);
  throw new Error(`Especificador não resolvido: ${spec} (em ${fromFile})`);
}

const key = (file) => relative(ROOT, file).split('\\').join('/');

/** Reescreve import/export de um módulo e devolve o corpo + dependências. */
function transform(source, file) {
  const deps = new Set();
  const exported = [];
  let src = source;

  const req = (spec) => {
    const r = resolveSpecifier(spec, file);
    deps.add(r);
    return `__req(${JSON.stringify(key(r))})`;
  };

  // import * as NS from '...'
  src = src.replace(
    /^[ \t]*import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm,
    (_m, ns, spec) => `const ${ns} = ${req(spec)};`
  );

  // import { a, b as c } from '...'   (aceita várias linhas)
  src = src.replace(
    /^[ \t]*import\s*\{([^}]*)\}\s*from\s+['"]([^'"]+)['"];?[ \t]*$/gm,
    (_m, names, spec) => {
      const binding = names
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const parts = s.split(/\s+as\s+/);
          return parts.length > 1 ? `${parts[0].trim()}: ${parts[1].trim()}` : parts[0].trim();
        })
        .join(', ');
      return `const { ${binding} } = ${req(spec)};`;
    }
  );

  // import 'x'  (efeito colateral)
  src = src.replace(
    /^[ \t]*import\s+['"]([^'"]+)['"];?[ \t]*$/gm,
    (_m, spec) => `${req(spec)};`
  );

  // export function / async function / class
  src = src.replace(
    /^[ \t]*export\s+(async\s+)?function\s+([A-Za-z_$][\w$]*)/gm,
    (_m, asyncKw, name) => { exported.push(name); return `${asyncKw || ''}function ${name}`; }
  );
  src = src.replace(
    /^[ \t]*export\s+class\s+([A-Za-z_$][\w$]*)/gm,
    (_m, name) => { exported.push(name); return `class ${name}`; }
  );

  // export const/let/var NOME
  src = src.replace(
    /^[ \t]*export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
    (_m, kw, name) => { exported.push(name); return `${kw} ${name}`; }
  );

  // export { a, b as c };
  src = src.replace(
    /^[ \t]*export\s*\{([^}]*)\}\s*;?[ \t]*$/gm,
    (_m, names) => {
      names.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => {
        const parts = s.split(/\s+as\s+/);
        exported.push(parts.length > 1 ? `${parts[1].trim()}: ${parts[0].trim()}` : parts[0].trim());
      });
      return '';
    }
  );

  if (/^[ \t]*export[\s{]/m.test(src)) {
    const line = src.split('\n').find((l) => /^[ \t]*export[\s{]/.test(l));
    throw new Error(`Forma de export não suportada em ${key(file)}: ${line.trim()}`);
  }
  if (/^[ \t]*import[\s{*'"]/m.test(src)) {
    const line = src.split('\n').find((l) => /^[ \t]*import[\s{*'"]/.test(l));
    throw new Error(`Forma de import não suportada em ${key(file)}: ${line.trim()}`);
  }

  return { code: src, deps: [...deps], exported };
}

// ---------------------------------------------------------------- montagem
const modules = new Map();

async function collect(file) {
  const k = key(file);
  if (modules.has(k)) return;
  modules.set(k, null);                       // marca para evitar ciclo
  const source = await readFile(file, 'utf8');
  const { code, deps, exported } = transform(source, file);
  modules.set(k, { code, exported });
  for (const d of deps) await collect(d);
}

await collect(ENTRY);

const runtime = `
(function () {
  "use strict";
  var __defs = {};
  var __cache = {};
  function __req(id) {
    if (__cache[id]) return __cache[id].exports;
    var mod = __cache[id] = { exports: {} };
    var def = __defs[id];
    if (!def) throw new Error("Módulo ausente: " + id);
    def(mod.exports, __req, mod);
    return mod.exports;
  }
  function __def(id, fn) { __defs[id] = fn; }
`;

let body = '';
for (const [id, mod] of modules) {
  if (!mod) continue;
  body += `\n__def(${JSON.stringify(id)}, function (__exports, __req, __module) {\n`;
  body += mod.code;
  body += `\n__module.exports = { ${mod.exported.join(', ')} };\n});\n`;
}

const bootstrap = `
  __req(${JSON.stringify(key(ENTRY))});
})();
`;

const bundle = runtime + body + bootstrap;

// ------------------------------------------------------------------- HTML
const html = await readFile(join(ROOT, 'index.html'), 'utf8');

// A substituição PRECISA ser por função: o bundle contém sequências como
// '$' e "$&" (o three tem `+ '$'` em regex montadas por concatenação) que
// String.replace interpretaria como padrões de substituição.
const out = html
  .replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, () => '')
  .replace(
    /<script type="module" src="\.\/src\/main\.js"><\/script>/,
    () => `<script>\n${bundle}\n</script>`
  );

// os ids dos módulos contêm "src/main.js", então confere a tag, não a string
if (/<script[^>]+src=/.test(out) || out.includes('<script type="importmap">')) {
  throw new Error('A substituição do script no index.html falhou');
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, out, 'utf8');

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0);
console.log(`\n  ✔ ${relative(ROOT, OUT)}  (${kb(out)} KB, ${modules.size} módulos)`);
console.log('    Abra com duplo clique — não precisa de servidor.\n');
