import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {validateCustomSkill} from './custom-skills.js';
import {buildPrompt} from './plan.js';
const catalog=JSON.parse(await readFile(new URL('skills.json',import.meta.url)));
const templates=JSON.parse(await readFile(new URL('templates.json',import.meta.url)));
test('the six requested research uses are available without model bindings',()=>{
  for(const name of ['需求与机会发现','竞品对比','用户反馈整理','潜客线索整理','CRM 商机体检','销售通话复盘']){
    const template=templates.find(t=>t.name===name);assert.ok(template,name);
    assert.ok(!Object.keys(template).some(key=>/model|provider|temperature/i.test(key)));
  }
});
test('upgrading a saved catalog adds missing defaults while preserving custom edits and preferences',async()=>{
  const source=await readFile(new URL('client.template.js',import.meta.url),'utf8');
  const fn=source.match(/function read\(\)\{[\s\S]*?(?=\n  function remembered)/)[0];
  const saved={catalogVersion:2,templates:[{id:'market-signals',name:'我修改的名字',description:'我的要求',repository:'gtmagents/gtm-agents',skills:['market-signal-tracker'],skillRefs:[]}],preferences:{selected:'market-signals'}};
  const value=vm.runInNewContext(`(${fn})()`,{BUILTINS:templates,KEY:'test',localStorage:{getItem:()=>JSON.stringify(saved)}});
  assert.ok(value.templates.some(t=>t.name==='销售通话复盘'));
  assert.equal(value.templates.find(t=>t.id==='market-signals').name,'我修改的名字');
  assert.equal(value.preferences.selected,'market-signals');assert.equal(value.catalogVersion,3);
  const chosen={...saved,catalogVersion:3};
  const current=vm.runInNewContext(`(${fn})()`,{BUILTINS:templates,KEY:'test',localStorage:{getItem:()=>JSON.stringify(chosen)}});
  assert.equal(current.templates.length,1);
});
test('both source catalogs have Chinese purposes and traceable unique identities',()=>{
  assert.equal(catalog.filter(s=>s.repository==='gtmagents/gtm-agents').length,244);
  assert.equal(catalog.filter(s=>s.repository==='zime-ai/zime-gtm-skills').length,71);
  assert.equal(new Set(catalog.map(s=>s.repository+'/'+s.path)).size,catalog.length);
  for(const s of catalog){assert.match(s.description,/[\u4e00-\u9fff]/);assert.ok(s.descriptionOriginal);assert.match(s.name,/^[a-z0-9-]+$/);}
  for(const t of templates)for(const ref of t.skillRefs)assert.ok(catalog.some(s=>s.repository===t.repository&&s.path===ref.path&&s.name===ref.name),t.id);
});
test('Zime prompt keeps its source and requires actual customer evidence',()=>{
  const p=buildPrompt({name:'CRM',url:'https://example.com/',quantity:1,definition:templates.find(t=>t.id==='zime-pipeline')},'run-test-12345678');
  assert.match(p,/https:\/\/github.com\/zime-ai\/zime-gtm-skills/);
  assert.match(p,/不得加载另一套仓库的同名技能替代/);
  assert.match(p,/不编造买方证据/);
});
test('custom source validation rejects credential URLs and path traversal',()=>{
  const base={name:'my-skill',description:'分析客户需求。'};
  assert.equal(validateCustomSkill(base).sourceKind,'installed');
  assert.equal(validateCustomSkill({...base,sourceKind:'github',location:'https://github.com/example/skills/tree/main/skills/my-skill'}).sourceKind,'github');
  for(const location of ['https://name:secret@github.com/example/skills','https://example.com/skill','javascript:alert(1)'])assert.throws(()=>validateCustomSkill({...base,sourceKind:'github',location}));
  assert.throws(()=>validateCustomSkill({...base,sourceKind:'local',location:'/tmp/../private'}));
  assert.equal(validateCustomSkill({...base,sourceKind:'local',location:'/tmp/my-skill'}).location,'/tmp/my-skill');
});
test('preferences and personal skills survive reading storage after remount',async()=>{
  const source=await readFile(new URL('client.template.js',import.meta.url),'utf8');
  const fn=source.match(/function read\(\)\{[\s\S]*?(?=\n  function remembered)/)[0];
  const saved={catalogVersion:2,templates,customSkills:[{name:'my-skill',repository:'custom'}],runs:[],preferences:{skillSource:'zime-ai/zime-gtm-skills',selected:'zime-pipeline',quantity:'25',all:false,browserEngine:'chrome',name:'研究页面',url:'https://example.com/'}};
  const value=vm.runInNewContext(`(${fn})()`,{BUILTINS:templates,KEY:'test',localStorage:{getItem:()=>JSON.stringify(saved)}});
  assert.equal(value.preferences.skillSource,saved.preferences.skillSource);
  assert.equal(value.preferences.selected,'zime-pipeline');
  assert.equal(value.preferences.browserEngine,'chrome');
  assert.equal(value.preferences.quantity,'25');
  assert.equal(value.customSkills[0].name,'my-skill');
});
