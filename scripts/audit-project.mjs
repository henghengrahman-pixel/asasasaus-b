import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});
const files = walk(path.join(root, 'src')).filter((file) => /\.(ts|tsx|js|mjs)$/.test(file));
let fail = 0;
const bad = (message) => { console.error('FAIL', message); fail += 1; };
const ok = (message) => console.log('OK', message);

for (const required of [
  'package.json','prisma/schema.prisma','.env.example','src/lib/runtime-env.ts',
  'src/app/api/admin/action/route.ts','src/app/api/admin/upload/route.ts',
  'src/app/robots.ts','src/app/sitemap.ts'
]) {
  fs.existsSync(path.join(root, required)) ? ok(required) : bad(`missing ${required}`);
}

for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const relativeImports = [...source.matchAll(/(?:from\s+|import\s*\(|require\s*\()\s*['"](\.[^'"]+)['"]/g)].map((m) => m[1]);
  for (const spec of relativeImports) {
    const base = path.resolve(path.dirname(file), spec);
    const candidates = [base,`${base}.ts`,`${base}.tsx`,`${base}.js`,`${base}.mjs`,path.join(base,'index.ts'),path.join(base,'index.tsx'),path.join(base,'index.js')];
    if (!candidates.some(fs.existsSync)) bad(`missing relative import ${path.relative(root,file)} -> ${spec}`);
  }
  const aliasImports = [...source.matchAll(/from\s+['"](@\/[^'"]+)['"]/g)].map((m) => m[1]);
  for (const spec of aliasImports) {
    const base = path.join(root, 'src', spec.slice(2));
    const candidates = [base,`${base}.ts`,`${base}.tsx`,path.join(base,'index.ts'),path.join(base,'index.tsx')];
    if (!candidates.some(fs.existsSync)) bad(`missing alias import ${path.relative(root,file)} -> ${spec}`);
  }
  if (/from\s+['"]\.\/env['"]/.test(source)) bad(`legacy ./env import in ${path.relative(root,file)}`);
}

const adminApi = files.filter((file) => file.includes(`${path.sep}app${path.sep}api${path.sep}admin${path.sep}`));
for (const file of adminApi) {
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes('export async function POST') && !source.includes('isTrustedMutationOrigin')) bad(`admin POST without CSRF origin check: ${path.relative(root,file)}`);
}

const uiFiles = files.filter((file) => file.includes(`${path.sep}app${path.sep}admin${path.sep}`) || file.includes(`${path.sep}components${path.sep}`));
const uiActions = new Set();
for (const file of uiFiles) {
  const source = fs.readFileSync(file,'utf8');
  for (const match of source.matchAll(/name=['"]action['"]\s+value=['"]([^'"]+)/g)) uiActions.add(match[1]);
}
const actionSource = fs.readFileSync(path.join(root,'src/app/api/admin/action/route.ts'),'utf8');
const handlers = new Set([...actionSource.matchAll(/action===['"]([^'"]+)/g)].map((m) => m[1]));
for (const action of uiActions) if (!handlers.has(action)) bad(`UI action has no handler: ${action}`);

const schema = fs.readFileSync(path.join(root,'prisma/schema.prisma'),'utf8');
const prismaModels = new Set([...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1][0].toLowerCase()+m[1].slice(1)));
const prismaRefs = new Set();
for (const file of files) {
  const source = fs.readFileSync(file,'utf8');
  for (const match of source.matchAll(/\b(?:db|tx)\.(\w+)\b/g)) {
    if (!['$transaction','$queryRaw','$executeRaw'].includes(match[1])) prismaRefs.add(match[1]);
  }
}
for (const ref of prismaRefs) if (!prismaModels.has(ref)) bad(`unknown Prisma model reference db.${ref}`);

const knownStaticRoutes = new Set(['/','/jasa','/mitra/daftar','/pesanan','/chat','/akun']);
for (const file of files.filter((candidate) => candidate.endsWith('.tsx'))) {
  const source = fs.readFileSync(file,'utf8');
  for (const match of source.matchAll(/href=['"](\/[^'"?#${}]*)['"]/g)) {
    const href = match[1].replace(/\/$/,'') || '/';
    if (href.startsWith('/admin') || knownStaticRoutes.has(href)) continue;
    const exact = path.join(root,'src/app',href.slice(1),'page.tsx');
    const dynamic = href.startsWith('/jasa/') || href.startsWith('/area/') || href.startsWith('/pesanan/') || href.startsWith('/mitra/');
    if (!fs.existsSync(exact) && !dynamic) bad(`static href without route ${path.relative(root,file)} -> ${href}`);
  }
}

if (!fail) ok(`static connectivity audit (${files.length} source files, ${uiActions.size} UI actions, ${prismaRefs.size} Prisma models referenced)`);
process.exitCode = fail ? 1 : 0;
