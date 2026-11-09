import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));

test('Git repository root declares the same installable bundle as the ZIP plugin',async()=>{
  assert.ok(existsSync(join(root,'package.json')),'Git installs read package.json from the repository root, not plugin/');
  const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
  const plugin=JSON.parse(await readFile(join(root,'plugin/package.json'),'utf8'));
  assert.equal(manifest.name,plugin.name);
  assert.equal(manifest.version,plugin.version);
  assert.equal(manifest.type,'module');
  assert.equal(manifest.dsh.bundle.patch,'./plugin/cordis.patch.yml');
  assert.deepEqual(manifest.dsh.client,plugin.dsh.client);
  for(const [key,value] of Object.entries(plugin.exports))assert.equal(manifest.exports[key],value.replace('./','./plugin/'));
  assert.deepEqual(manifest.files,[...plugin.files.map(file=>'plugin/'+file),'LICENSE','THIRD_PARTY_NOTICES.md','licenses/']);
});

test('packed repository resolves its bundle, Host, Client and locale without a checkout',async()=>{
  assert.ok(existsSync(join(root,'package.json')),'The repository must have an installable root package');
  const temporary=await mkdtemp(join(tmpdir(),'gtm-install-package-'));
  try{
    const [packed]=JSON.parse(execFileSync('npm',['pack','--ignore-scripts','--json','--pack-destination',temporary,'--cache',join(temporary,'cache')],{cwd:root,encoding:'utf8'}));
    const paths=new Set(packed.files.map(file=>file.path));
    for(const file of ['plugin/index.js','plugin/client.js','plugin/host-service.js','plugin/task-plan.js','plugin/cordis.patch.yml','plugin/locale/zh.json','plugin/icon.svg','plugin/skills.json','plugin/templates.json'])assert.ok(paths.has(file),file);
    assert.ok(![...paths].some(path=>path.startsWith('docs/')||path.endsWith('.test.mjs')));
    execFileSync('tar',['-xzf',join(temporary,packed.filename),'-C',temporary]);
    const directory=join(temporary,'package');
    const manifest=JSON.parse(await readFile(join(directory,'package.json'),'utf8'));
    const patch=await readFile(join(directory,manifest.dsh.bundle.patch),'utf8');
    assert.ok(patch.includes("name: '"+manifest.name+"'"));
    const require=createRequire(join(directory,'probe.cjs'));
    const host=await import(pathToFileURL(require.resolve(manifest.name)).href);
    assert.equal(typeof host.apply,'function');
    assert.ok(existsSync(require.resolve(manifest.name+'/client')));
    assert.ok(existsSync(require.resolve(manifest.name+'/locale/zh.json')));
    assert.ok(existsSync(require.resolve(manifest.name+'/icon')));
  }finally{
    await rm(temporary,{recursive:true,force:true});
  }
});
