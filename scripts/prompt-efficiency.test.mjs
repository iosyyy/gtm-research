import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPrompt} from '../plugin/plan.js';
import {buildPrompt as baseline} from './fixtures/prompt-v1.5.1.mjs';

const settings={name:'测试页面',url:'https://example.com/research',quantity:10,focus:'需求与变化',definition:{repository:'gtmagents/gtm-agents',name:'市场研究',description:'核对实际讨论并整理来源。',skills:['market-signal-tracker'],skillRefs:[{name:'market-signal-tracker',path:'skills/market-signal-tracker'}]}};
const runId='run-efficiency-12345678';
const unchanged=['网页：','研究模板：','任务：','重点：','范围：','只在当前工作区','先根据本次网页','开始执行前必须调用','每开始、完成或遇阻','发现页面结构','1. 检查当前 Harness','3. 已有依赖','检查依赖后的 progress','技能来源：','需要的 GTM 技能：','用户所选浏览器：','需要登录时','按计划读取','本次分析所需材料：','上传的文件：','若附有 PDF 模板','生成 report.md','最终保存 manifest.json','回读确认实际产物后'];

test('focused prompts preserve all task, plan, evidence, permission and report requirements across 48 cases',()=>{
  for(const browserEngine of ['auto','builtin','agent-browser','chrome','default','agent-chrome'])for(const repository of ['gtmagents/gtm-agents','zime-ai/zime-gtm-skills'])for(const quantity of [1,'all'])for(const files of [[],[{name:'report.pdf'},{name:'research.xlsx'},{name:'call.txt',kind:'material'}]]){
    const value={...settings,browserEngine,quantity,definition:{...settings.definition,repository}};
    const before=baseline(value,runId,files),after=buildPrompt(value,runId,files);
    for(const prefix of unchanged){const line=before.split('\n').find(line=>line.startsWith(prefix));assert.ok(line,'Missing baseline clause: '+prefix);assert.ok(after.includes(line),browserEngine+': '+prefix);}
    for(const guard of ['不要反复猜 API','禁止无头浏览器，包括 PDF 导出','不影响其他会话','不能修改安全配置绕过授权','不得加载另一套仓库的同名技能替代'])assert.ok(after.includes(guard),guard);
    assert.ok(after.length<before.length,browserEngine+' should omit irrelevant engine instructions');
  }
});

test('each chosen engine retains its control checks and failure boundaries',()=>{
  const clauses={auto:['先检查 Harness 提供的内置浏览器操作工具','自动改用 agent-browser 的可见 Chrome for Testing','skills get core'],builtin:['无读取/点击工具时停止并建议改选','不能冒充采集成功'],'agent-browser':['可见 Chrome for Testing','skills get core'],chrome:['本机 Chrome 可执行文件及专用研究 profile','不读取或复制日常个人 profile'],default:['当前默认浏览器打开目标页面','能力验证通过才继续','不擅自修改系统默认浏览器或读取其他标签'],'agent-chrome':['agent-chrome --help','只操作本次目标标签','不安装来源不明的同名项目']};
  for(const [browserEngine,expected] of Object.entries(clauses)){
    const prompt=buildPrompt({...settings,browserEngine},runId);
    for(const clause of expected)assert.ok(prompt.includes(clause),browserEngine+': '+clause);
    if(!['auto','agent-browser','chrome'].includes(browserEngine))assert.ok(!prompt.includes('skills get core'));
    if(browserEngine!=='agent-chrome')assert.ok(!prompt.includes('agent-chrome --help'));
  }
});

test('default-browser input is shorter without removing custom-source checks when needed',()=>{
  const value={...settings,browserEngine:'default'};
  assert.ok(buildPrompt(value,runId).length<=baseline(value,runId).length*.85);
  const custom={...value,definition:{...value.definition,repository:'custom'}};
  for(const clause of ['installed 验证已安装项','local 只读取指定 skill 目录','github 先验证明确的来源','不覆盖现有同名项'])assert.ok(buildPrompt(custom,runId).includes(clause));
});
