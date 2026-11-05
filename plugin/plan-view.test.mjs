import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('client.template.js',import.meta.url),'utf8');
function render(state,hasRun=true){
  const declaration=source.match(/function PlanProgress\([^]*?(?=\n  function Page)/)?.[0];
  assert.ok(declaration,'A separate view must display the saved AI plan.');
  const h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(v=>v!==false&&v!=null)});
  return vm.runInNewContext(`(${declaration})({state,hasRun})`,{h,state,hasRun});
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

test('the page renders arbitrary AI steps and never marks preceding steps complete by position',()=>{
  const state={plan:{revision:2,summary:'核对客户材料。',changeReason:'先补全买方证据。',steps:[{id:'evidence',title:'补齐客户原话',status:'pending'},{id:'audit',title:'核对客户档案',status:'in_progress'},{id:'deliver',title:'整理审核结果',status:'blocked',message:'缺少客户记录。'}]}};
  const view=render(state),items=rows(view);
  assert.equal(items.length,3);assert.equal(items[0].props.className,'research-step pending');
  assert.equal(items[1].props.className,'research-step in_progress');
  assert.match(text(view),/核对客户档案/);assert.match(text(view),/缺少客户记录/);
  assert.doesNotMatch(text(items[0]),/已完成|已进行/);
});
