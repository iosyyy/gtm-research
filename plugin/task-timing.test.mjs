import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createResearchService} from './host-service.js';

const base=Date.parse('2026-11-10T01:00:00Z');
const iso=seconds=>new Date(base+seconds*1000).toISOString();
const runId='run-timing-12345678';
const plan={summary:'读取网页并检查交付物。',steps:[{id:'read',title:'读取网页'},{id:'deliver',title:'检查交付物'}]};

test('step timestamps persist across messages, waiting, plan revisions and reopening the service',async t=>{
  const cwd=await mkdtemp(join(tmpdir(),'research-timing-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
  let seconds=0;const service=createResearchService({now:()=>base+seconds*1000});
  await service.execute(cwd,{action:'begin',runId});
  seconds=10;await service.execute(cwd,{action:'set_plan',runId,plan});
  seconds=12;let state=await service.execute(cwd,{action:'progress',runId,stepId:'read',stepStatus:'in_progress'});
  assert.equal(state.createdAt,iso(0));assert.equal(state.plan.createdAt,iso(10));
  assert.equal(state.plan.steps[0].startedAt,iso(12));
  seconds=20;state=await service.execute(cwd,{action:'progress',runId,stepId:'read',stepStatus:'in_progress',message:'工具仍在读取。'});
  assert.equal(state.plan.steps[0].startedAt,iso(12));
  seconds=30;await service.execute(cwd,{action:'progress',runId,stepId:'read',stepStatus:'blocked',message:'等待登录。'});
  seconds=70;await service.execute(cwd,{action:'progress',runId,stepId:'read',stepStatus:'in_progress'});
  seconds=80;await service.execute(cwd,{action:'set_plan',runId,plan,message:'补充实际核对范围。'});
  seconds=90;state=await service.execute(cwd,{action:'progress',runId,stepId:'read',stepStatus:'completed'});
  assert.equal(state.plan.steps[0].startedAt,iso(12));assert.equal(state.plan.steps[0].finishedAt,iso(90));
  seconds=100;state=await service.execute(cwd,{action:'progress',runId,stepId:'read',stepStatus:'completed',message:'补充来源说明。'});
  assert.equal(state.plan.steps[0].finishedAt,iso(90));
  const restored=await createResearchService().execute(cwd,{action:'status',runId});
  assert.equal(restored.plan.steps[0].finishedAt,iso(90));
  assert.equal(restored.plan.steps[1].startedAt,undefined);
});

test('only successful final verification stops the last step and the task clock',async t=>{
  const cwd=await mkdtemp(join(tmpdir(),'research-timing-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
  let seconds=0;const service=createResearchService({now:()=>base+seconds*1000});
  await service.execute(cwd,{action:'begin',runId});
  await service.execute(cwd,{action:'set_plan',runId,plan:{summary:'检查文件。',steps:[{id:'deliver',title:'检查交付物'}]}});
  seconds=10;await service.execute(cwd,{action:'progress',runId,stepId:'deliver',stepStatus:'in_progress'});
  seconds=20;await assert.rejects(()=>service.execute(cwd,{action:'finalize',runId}));
  let state=await service.execute(cwd,{action:'status',runId});
  assert.equal(state.completedAt,undefined);assert.equal(state.plan.steps[0].finishedAt,undefined);
  const dir=join(cwd,'web-research-runs',runId);
  await writeFile(join(dir,'report.pdf'),'%PDF-1.7\nfixture');
  await writeFile(join(dir,'report.xlsx'),'PKfixture');
  await writeFile(join(dir,'manifest.json'),JSON.stringify({files:['report.pdf','report.xlsx']}));
  seconds=35;state=await service.execute(cwd,{action:'finalize',runId});
  assert.equal(state.completedAt,iso(35));assert.equal(state.plan.steps[0].finishedAt,iso(35));
  seconds=50;state=await service.execute(cwd,{action:'finalize',runId});
  assert.equal(state.completedAt,iso(35));assert.equal(state.plan.steps[0].finishedAt,iso(35));
});

test('legacy active steps begin partial timing at the next real update without backdating',async t=>{
  const cwd=await mkdtemp(join(tmpdir(),'research-timing-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
  const service=createResearchService({now:()=>base+60_000});
  await service.execute(cwd,{action:'begin',runId});
  const state=await service.execute(cwd,{action:'set_plan',runId,plan});
  state.plan.steps[0].status='in_progress';state.plan.steps[0].updatedAt=iso(10);
  await writeFile(join(cwd,'web-research-runs',runId,'task-state.json'),JSON.stringify(state));
  const next=await service.execute(cwd,{action:'progress',runId,stepId:'read',stepStatus:'in_progress'});
  assert.equal(next.plan.steps[0].startedAt,iso(60));assert.equal(next.plan.steps[0].timingPartial,true);
});
