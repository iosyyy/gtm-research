import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createResearchService,verifyManifest} from './host-service.js';
import {apply} from './index.js';

async function fixture(t){const cwd=await mkdtemp(join(tmpdir(),'web-research-test-'));t.after(()=>rm(cwd,{recursive:true,force:true}));return cwd;}
const crmPlan={summary:'核对 CRM 的客户字段与跟进证据。',steps:[{id:'access',title:'确认客户页面的访问范围'},{id:'records',title:'核对客户字段与买方原话'},{id:'report',title:'整理缺口并检查报告'}]};

test('a new task waits for an AI plan without prepopulating forum stages',async t=>{
  const cwd=await fixture(t),service=createResearchService(),runId='run-plan-12345678';
  const state=await service.execute(cwd,{action:'begin',runId});
  assert.equal(state.schemaVersion,2);assert.equal(state.phase,'planning');
  assert.equal(state.plan,null);assert.match(state.message,/制定.*计划/);
});

test('AI plans persist and each step reports its own state without advancing earlier steps',async t=>{
  const cwd=await fixture(t),service=createResearchService(),runId='run-plan-12345678';
  await service.execute(cwd,{action:'begin',runId});
  const planned=await service.execute(cwd,{action:'set_plan',runId,plan:crmPlan});
  assert.equal(planned.plan.revision,1);assert.equal(planned.plan.steps.length,3);
  assert.ok(planned.plan.steps.every(s=>s.status==='pending'));
  await service.execute(cwd,{action:'progress',runId,stepId:'records',stepStatus:'in_progress',message:'正在核对第二项。'});
  await service.execute(cwd,{action:'progress',runId,stepId:'records',stepStatus:'blocked',message:'需要用户登录。'});
  let state=await service.execute(cwd,{action:'status',runId});
  assert.equal(state.status,'waiting');assert.equal(state.plan.steps[0].status,'pending');
  await service.execute(cwd,{action:'progress',runId,stepId:'records',stepStatus:'in_progress',message:'已复核页面可访问。'});
  await service.execute(cwd,{action:'progress',runId,stepId:'records',stepStatus:'completed',message:'字段已核对。'});
  state=await createResearchService().execute(cwd,{action:'status',runId});
  assert.equal(state.plan.steps[0].status,'pending');assert.equal(state.plan.steps[1].status,'completed');
  assert.equal(state.plan.steps[1].message,'字段已核对。');assert.equal(state.status,'running');
});

test('plan revisions preserve real progress and require a reason',async t=>{
  const cwd=await fixture(t),service=createResearchService(),runId='run-plan-12345678';
  await service.execute(cwd,{action:'begin',runId});
  await service.execute(cwd,{action:'set_plan',runId,plan:crmPlan});
  await service.execute(cwd,{action:'progress',runId,stepId:'access',stepStatus:'completed',message:'访问范围已确认。'});
  const revised={...crmPlan,steps:[crmPlan.steps[0],{id:'materials',title:'补充缺少的客户记录'},...crmPlan.steps.slice(1)]};
  await assert.rejects(()=>service.execute(cwd,{action:'set_plan',runId,plan:revised}),/原因/);
  const state=await service.execute(cwd,{action:'set_plan',runId,plan:revised,message:'页面缺少买方原话，需要补充材料。'});
  assert.equal(state.plan.revision,2);assert.equal(state.plan.steps[0].status,'completed');
  assert.equal(state.plan.steps[1].status,'pending');assert.match(state.plan.changeReason,/买方原话/);
  await assert.rejects(()=>service.execute(cwd,{action:'set_plan',runId,plan:{...crmPlan,steps:crmPlan.steps.slice(1)},message:'调整'}),/已完成/);
});

test('invalid plan updates and concurrent active steps cannot corrupt saved progress',async t=>{
  const cwd=await fixture(t),service=createResearchService(),runId='run-plan-12345678';
  await service.execute(cwd,{action:'begin',runId});
  await assert.rejects(()=>service.execute(cwd,{action:'progress',runId,stepId:'access',stepStatus:'in_progress'}),/计划/);
  await assert.rejects(()=>service.execute(cwd,{action:'progress',runId,phase:'collect',status:'running'}),/计划/);
  for(const plan of [{...crmPlan,steps:[]},{...crmPlan,steps:[crmPlan.steps[0],crmPlan.steps[0]]},{...crmPlan,steps:[{id:'../bad',title:'错误'}]},{...crmPlan,steps:[{id:'bad',title:''}]},{...crmPlan,steps:[{id:'bad',title:'伪造完成',status:'completed'}]}]){
    await assert.rejects(()=>service.execute(cwd,{action:'set_plan',runId,plan}));
  }
  await service.execute(cwd,{action:'set_plan',runId,plan:crmPlan});
  await service.execute(cwd,{action:'progress',runId,stepId:'access',stepStatus:'in_progress',message:'正在检查。'});
  const before=await service.execute(cwd,{action:'status',runId});
  for(const update of [{stepId:'missing',stepStatus:'completed'},{stepId:'records',stepStatus:'in_progress'},{stepId:'access',stepStatus:'invented'},{status:'complete'}]){
    await assert.rejects(()=>service.execute(cwd,{action:'progress',runId,...update}));
  }
  assert.deepEqual(await service.execute(cwd,{action:'status',runId}),before);
});

test('task completion requires finished AI steps as well as verified files',async t=>{
  const cwd=await fixture(t),service=createResearchService(),runId='run-plan-12345678';
  await service.execute(cwd,{action:'begin',runId});
  const dir=join(cwd,'web-research-runs',runId);
  await writeFile(join(dir,'report.pdf'),'%PDF-1.7\nfixture');await writeFile(join(dir,'research.xlsx'),'PKfixture');
  await writeFile(join(dir,'manifest.json'),JSON.stringify({files:['report.pdf','research.xlsx']}));
  await assert.rejects(()=>service.execute(cwd,{action:'finalize',runId}),/计划/);
  await service.execute(cwd,{action:'set_plan',runId,plan:crmPlan});
  await assert.rejects(()=>service.execute(cwd,{action:'finalize',runId}),/步骤/);
  for(const step of crmPlan.steps)await service.execute(cwd,{action:'progress',runId,stepId:step.id,stepStatus:'completed',message:'已核对实际产物。'});
  assert.equal((await service.execute(cwd,{action:'finalize',runId})).status,'complete');
});

test('the final verification step completes only after real file checks succeed',async t=>{
  const cwd=await fixture(t),service=createResearchService(),runId='run-plan-12345678';
  await service.execute(cwd,{action:'begin',runId});
  await service.execute(cwd,{action:'set_plan',runId,plan:crmPlan});
  for(const step of crmPlan.steps.slice(0,-1))await service.execute(cwd,{action:'progress',runId,stepId:step.id,stepStatus:'completed',message:'已完成。'});
  await service.execute(cwd,{action:'progress',runId,stepId:'report',stepStatus:'in_progress',message:'等待后端检查报告文件。'});
  await assert.rejects(()=>service.execute(cwd,{action:'finalize',runId}));
  assert.equal((await service.execute(cwd,{action:'status',runId})).plan.steps.at(-1).status,'in_progress');
  const dir=join(cwd,'web-research-runs',runId);
  await writeFile(join(dir,'report.pdf'),'%PDF-1.7\nfixture');await writeFile(join(dir,'research.xlsx'),'PKfixture');
  await writeFile(join(dir,'manifest.json'),JSON.stringify({files:['report.pdf','research.xlsx']}));
  const result=await service.execute(cwd,{action:'finalize',runId});
  assert.equal(result.status,'complete');assert.equal(result.plan.steps.at(-1).status,'completed');
  assert.match(result.plan.steps.at(-1).message,/文件.*检查/);
});

test('the real command and Agent tool share the same dynamic plan',async t=>{
  const cwd=await fixture(t),runId='run-plan-12345678';let command,tool;
  apply({effect:fn=>fn(),workingDirectory:{get:()=>cwd},commands:{register:v=>command=v},tools:{register:v=>tool=v}});
  const agent={session:{}};
  await command.handler({agent,rawInput:JSON.stringify({action:'begin',runId})});
  assert.ok(tool.parameters.properties.action.enum.includes('set_plan'));
  assert.ok(tool.parameters.properties.plan);assert.ok(tool.parameters.properties.stepId);
  await tool.execute({action:'set_plan',runId,plan:crmPlan},{agent});
  await tool.execute({action:'progress',runId,stepId:'access',stepStatus:'in_progress',message:'正在核对。'},{agent});
  const response=await command.handler({agent,rawInput:JSON.stringify({action:'status',runId})});
  assert.equal(response.kind,'success');assert.equal(JSON.parse(response.text).plan.steps[0].status,'in_progress');
});
test('real files are required before the shared service marks a task complete',async t=>{
  const cwd=await fixture(t),service=createResearchService(),runId='run-test-12345678';
  await service.execute(cwd,{action:'begin',runId});
  await service.execute(cwd,{action:'set_plan',runId,plan:{summary:'核对来源并生成报告。',steps:[{id:'research',title:'读取证据并检查交付文件'}]}});
  await service.execute(cwd,{action:'progress',runId,stepId:'research',stepStatus:'in_progress',message:'正在读取第一项。'});
  assert.equal((await service.execute(cwd,{action:'status',runId})).plan.steps[0].status,'in_progress');
  await assert.rejects(()=>service.execute(cwd,{action:'finalize',runId}));
  const dir=join(cwd,'web-research-runs',runId);
  await writeFile(join(dir,'report.pdf'),'%PDF-1.7\nfixture');await writeFile(join(dir,'research.xlsx'),Buffer.from([0x50,0x4b,0x03,0x04]));
  await writeFile(join(dir,'manifest.json'),JSON.stringify({summary:'范围说明',files:[{name:'PDF',path:'report.pdf'},{name:'Excel',path:'research.xlsx'}]}));
  await service.execute(cwd,{action:'progress',runId,stepId:'research',stepStatus:'completed',message:'文件已生成并回读。'});
  const state=await service.execute(cwd,{action:'finalize',runId});
  assert.equal(state.status,'complete');assert.equal(state.result.files.length,2);
  assert.ok(state.result.verifiedAt);
});

test('skipping needs an explanation and repeated begin preserves the actual AI plan',async t=>{
  const cwd=await fixture(t),service=createResearchService(),runId='run-plan-12345678';
  await service.execute(cwd,{action:'begin',runId});
  await service.execute(cwd,{action:'set_plan',runId,plan:crmPlan});
  await assert.rejects(()=>service.execute(cwd,{action:'progress',runId,stepId:'access',stepStatus:'skipped'}),/原因/);
  const state=await service.execute(cwd,{action:'progress',runId,stepId:'access',stepStatus:'skipped',message:'上传的导出文件已经包含需要的访问范围。'});
  assert.deepEqual(await service.execute(cwd,{action:'begin',runId}),state);
});

test('legacy task status remains readable without manufacturing an AI plan',async t=>{
  const cwd=await fixture(t),service=createResearchService(),runId='run-old-12345678',dir=join(cwd,'web-research-runs',runId);
  await mkdir(dir,{recursive:true});
  await writeFile(join(dir,'task-state.json'),JSON.stringify({runId,createdAt:'2026-11-04T00:00:00Z',phase:'dependencies',status:'running'}));
  const state=await service.execute(cwd,{action:'progress',runId,phase:'collect',status:'running',message:'旧任务的实际采集状态。'});
  assert.equal(state.phase,'collect');assert.equal(state.plan,undefined);
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
