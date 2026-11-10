import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('client.template.js',import.meta.url),'utf8');
function render(state,hasRun=true,now=Date.now()){
  const declaration=source.match(/function (?:elapsedMilliseconds|PlanProgress)\([^]*?(?=\n  function Page)/)?.[0];
  assert.ok(declaration,'A separate view must display the saved AI plan.');
  const h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(v=>v!==false&&v!=null)});
  return vm.runInNewContext(`${declaration}\nPlanProgress({state,hasRun,now})`,{h,state,hasRun,now,React:{useState:initial=>[initial(),()=>{}],useEffect:()=>{}}});
}
function text(node){return typeof node==='object'?(node.children||[]).map(text).join(' '):String(node);}
function rows(node){if(!node||typeof node!=='object')return [];return [...(node.props.className?.startsWith('research-step ')?[node]:[]),...(node.children||[]).flatMap(rows)];}

test('before the AI returns a plan, the page shows no invented steps',()=>{
  for(const [state,hasRun] of [[null,false],[{schemaVersion:2,plan:null},true],[{status:'complete'},true]]){
    const view=render(state,hasRun);assert.equal(rows(view).length,0);
    assert.doesNotMatch(text(view),/采集正文和评论|使用 GTM 技能分析|生成并检查 PDF/);
  }
  assert.match(text(render({schemaVersion:2,plan:null})),/正在制定计划/);
  assert.match(text(render({status:'complete'})),/没有保存 AI 计划/);
});

test('timing is live for the task and current step but finished steps stay fixed',()=>{
  const state={schemaVersion:2,createdAt:'2026-11-10T01:00:00Z',status:'running',plan:{createdAt:'2026-11-10T01:00:10Z',revision:1,summary:'核对网页。',steps:[{id:'read',title:'读取网页',status:'completed',startedAt:'2026-11-10T01:00:12Z',finishedAt:'2026-11-10T01:01:02Z'},{id:'audit',title:'核对材料',status:'in_progress',startedAt:'2026-11-10T01:01:05Z'},{id:'deliver',title:'生成报告',status:'pending'}]}};
  let view=render(state,true,Date.parse('2026-11-10T01:02:05Z'));
  assert.match(text(view),/总耗时/);assert.match(text(view),/2分05秒/);assert.match(text(view),/准备与计划/);
  assert.match(text(rows(view)[0]),/50秒/);assert.match(text(rows(view)[1]),/1分00秒/);
  assert.match(text(rows(view)[2]),/—/);
  view=render(state,true,Date.parse('2026-11-10T01:02:06Z'));
  assert.match(text(view),/2分06秒/);assert.match(text(rows(view)[0]),/50秒/);assert.match(text(rows(view)[1]),/1分01秒/);
  state.status='complete';state.completedAt='2026-11-10T01:02:05Z';
  assert.match(text(render(state,true,Date.parse('2026-11-10T02:00:00Z'))),/2分05秒/);
});

test('planning has a visible timer and legacy steps never infer starts from updatedAt',()=>{
  const now=Date.parse('2026-11-10T01:01:10Z');
  assert.match(text(render({schemaVersion:2,createdAt:'2026-11-10T01:00:00Z',plan:null},true,now)),/制定计划/);
  const state={plan:{revision:1,steps:[{id:'old',title:'旧步骤',status:'completed',updatedAt:'2026-11-10T01:00:00Z'}]}};
  assert.match(text(rows(render(state,true,now))[0]),/未记录/);
  state.plan.steps[0]={...state.plan.steps[0],status:'in_progress',startedAt:'2026-11-10T01:01:00Z',timingPartial:true};
  assert.match(text(rows(render(state,true,now))[0]),/≥10秒/);
});

test('the page renders arbitrary AI steps and never marks preceding steps complete by position',()=>{
  const state={plan:{revision:2,summary:'核对客户材料。',changeReason:'先补全买方证据。',steps:[{id:'evidence',title:'补齐客户原话',status:'pending'},{id:'audit',title:'核对客户档案',status:'in_progress'},{id:'deliver',title:'整理审核结果',status:'blocked',message:'缺少客户记录。'}]}};
  const view=render(state),items=rows(view);
  assert.equal(items.length,3);assert.equal(items[0].props.className,'research-step pending');
  assert.equal(items[1].props.className,'research-step in_progress');
  assert.match(text(view),/核对客户档案/);assert.match(text(view),/缺少客户记录/);
  assert.doesNotMatch(text(items[0]),/已完成|已进行/);
});
