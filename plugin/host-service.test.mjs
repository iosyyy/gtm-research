import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createResearchService,verifyManifest} from './host-service.js';

async function fixture(t){const cwd=await mkdtemp(join(tmpdir(),'web-research-test-'));t.after(()=>rm(cwd,{recursive:true,force:true}));return cwd;}
test('real files are required before the shared service marks a task complete',async t=>{
  const cwd=await fixture(t),service=createResearchService(),runId='run-test-12345678';
  await service.execute(cwd,{action:'begin',runId});
  await service.execute(cwd,{action:'progress',runId,phase:'collect',status:'running',message:'正在读取第一项。'});
  assert.equal((await service.execute(cwd,{action:'status',runId})).phase,'collect');
  await assert.rejects(()=>service.execute(cwd,{action:'finalize',runId}));
  const dir=join(cwd,'web-research-runs',runId);
  await writeFile(join(dir,'report.pdf'),'%PDF-1.7\nfixture');await writeFile(join(dir,'research.xlsx'),Buffer.from([0x50,0x4b,0x03,0x04]));
  await writeFile(join(dir,'manifest.json'),JSON.stringify({summary:'范围说明',files:[{name:'PDF',path:'report.pdf'},{name:'Excel',path:'research.xlsx'}]}));
  const state=await service.execute(cwd,{action:'finalize',runId});
  assert.equal(state.status,'complete');assert.equal(state.result.files.length,2);
  assert.ok(state.result.verifiedAt);
});
test('invalid signatures and paths outside a run cannot become report links',async t=>{
  const cwd=await fixture(t),runId='run-test-12345678',dir=join(cwd,'web-research-runs',runId);await mkdir(dir,{recursive:true});
  await writeFile(join(dir,'report.pdf'),'not PDF');await writeFile(join(dir,'research.xlsx'),'PKfixture');
  await writeFile(join(dir,'manifest.json'),JSON.stringify({files:[{path:'report.pdf'},{path:'research.xlsx'}]}));
  await assert.rejects(()=>verifyManifest(cwd,runId),/PDF/);
  await writeFile(join(cwd,'outside.pdf'),'%PDF-1.7\nfixture');await symlink(join(cwd,'outside.pdf'),join(dir,'linked.pdf'));
  await writeFile(join(dir,'manifest.json'),JSON.stringify({files:[{path:'linked.pdf'},{path:'research.xlsx'}]}));
  await assert.rejects(()=>verifyManifest(cwd,runId),/超出/);
  await assert.rejects(()=>verifyManifest(cwd,'../../outside'),/编号/);
});
test('template updates are workspace-scoped and preserve source identity',async t=>{
  const cwd=await fixture(t),other=await fixture(t),service=createResearchService();
  const templates=[{id:'zime-user',name:'我的审核',description:'根据买方证据审核。',repository:'zime-ai/zime-gtm-skills',skills:['pain-finder']}];
  await service.execute(cwd,{action:'set_templates',templates});
  assert.equal((await service.execute(cwd,{action:'get_templates'})).templates[0].repository,'zime-ai/zime-gtm-skills');
  assert.equal((await service.execute(other,{action:'get_templates'})).templates,null);
  await assert.rejects(()=>service.execute(cwd,{action:'set_templates',templates:[...templates,...templates]}),/无效/);
});
