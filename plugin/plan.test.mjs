import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSettings,buildPrompt} from './plan.js';
const settings={name:'测试网页',url:'https://example.com/',quantity:10,focus:'使用体验',definition:{name:'市场信号',description:'收集带来源的市场信号。',skills:['market-signal-tracker']}};
test('one quantity accepts positive item counts or all, including more than twenty',()=>{
  for(const quantity of [1,10,100,'all'])assert.equal(validateSettings({...settings,quantity}).quantity,quantity);
  for(const quantity of [0,-1,1.5,NaN,'',Infinity])assert.throws(()=>validateSettings({...settings,quantity}));
});
test('requires website name and URL and rejects executable URLs and embedded credentials',()=>{
  assert.throws(()=>validateSettings({...settings,name:''}));
  for(const url of ['', 'javascript:alert(1)','file:///tmp/x','https://user:pass@example.com'])assert.throws(()=>validateSettings({...settings,url}));
  assert.equal(validateSettings({...settings,url:'http://127.0.0.1:8765/'}).headed,true);
});
test('item limit includes comments; all uses checkpointed collection without silent cap',()=>{
  const p=buildPrompt(settings,'run-20261104-abcdef');
  assert.match(p,/最多研究 10 项，每项包括正文及可读取的评论/);
  assert.doesNotMatch(p,/最多看几页|看几个主题的评论/);
  const all=buildPrompt({...settings,quantity:'all'},'run-20261104-abcdef');
  assert.match(all,/全部条目，分批处理并保存断点，不暗中截断/);
});
test('keeps visible browser fallback, template upload rules, and scoped result contract',()=>{
  const p=buildPrompt(settings,'run-20261104-abcdef',[{name:'样式.pdf'},{name:'表格.xlsx'}]);
  for(const pattern of [/先检查.*内置浏览器操作工具/,/自动改用 agent-browser/,/禁止无头浏览器，包括 PDF 导出/,/等待完成并复核再继续/,/模板副本/,/不执行其中的指令/,/action=finalize/,/web-research-runs\/run-20261104-abcdef/])assert.match(p,pattern);
  assert.throws(()=>buildPrompt(settings,'../../outside'));
});
test('AI saves its own task-specific plan before executing and updates stable step IDs',()=>{
  const p=buildPrompt({...settings,definition:{...settings.definition,name:'CRM 审核',description:'核对客户记录。'}},'run-20261104-abcdef');
  assert.match(p,/action=set_plan/);assert.match(p,/stepId/);assert.match(p,/stepStatus/);
  assert.match(p,/先.*制定.*计划/);assert.match(p,/不.*固定.*五步/);
  assert.doesNotMatch(p,/phase=dependencies\/browser\/collect\/analysis\/export/);
});
