import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,rm,mkdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createResearchService} from './host-service.js';
import {buildPrompt,validateSettings} from './plan.js';

const value={name:'研究',url:'https://example.com/',quantity:1,definition:{name:'需求研究',description:'核对来源。',skills:[]}};
test('four selectable PDF layouts have real packaged PDFs and no model configuration',async()=>{
  assert.ok(existsSync(new URL('pdf-styles.js',import.meta.url)),'PDF styles need a shared registry.');
  const {PDF_STYLES,resolvePdfStyle}=await import('./pdf-styles.js');
  assert.equal(PDF_STYLES.length,4);
  for(const style of PDF_STYLES){
    assert.ok(style.name&&style.instructions&&style.file);
    assert.ok(!Object.keys(style).some(key=>/model|provider|temperature/i.test(key)));
    assert.equal((await readFile(new URL('pdf-templates/'+style.file,import.meta.url))).subarray(0,5).toString(),'%PDF-');
    assert.equal(resolvePdfStyle(style.id).id,style.id);
  }
  assert.throws(()=>resolvePdfStyle('../private'));
});

test('begin copies the chosen real PDF into this run and uploaded templates take priority',async t=>{
  const cwd=await mkdtemp(join(tmpdir(),'research-pdf-style-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
  const service=createResearchService(),runId='run-pdfstyle-12345678';
  const state=await service.execute(cwd,{action:'begin',runId,pdfStyleId:'presentation'});
  assert.equal(state.pdfTemplateVersion,1);assert.equal(state.reportTemplate.id,'presentation');
  assert.equal((await readFile(join(cwd,state.reportTemplate.relativePath))).subarray(0,5).toString(),'%PDF-');
  assert.deepEqual(await service.execute(cwd,{action:'begin',runId,pdfStyleId:'clean'}),state);
  const custom=await service.execute(cwd,{action:'begin',runId:'run-custompdf-12345678',pdfStyleId:'custom'});
  assert.equal(custom.reportTemplate.id,'custom');assert.equal(custom.reportTemplate.relativePath,undefined);
  await assert.rejects(()=>service.execute(cwd,{action:'begin',runId:'run-invalidpdf-12345678',pdfStyleId:'../../other'}));
});

test('PDF template preparation cannot write through a run input directory outside the run',async t=>{
  const cwd=await mkdtemp(join(tmpdir(),'research-pdf-style-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
  const outside=await mkdtemp(join(tmpdir(),'research-pdf-outside-'));t.after(()=>rm(outside,{recursive:true,force:true}));
  const runId='run-linkedpdf-12345678',directory=join(cwd,'web-research-runs',runId);
  await mkdir(directory,{recursive:true});await symlink(outside,join(directory,'_inputs'));
  await assert.rejects(()=>createResearchService().execute(cwd,{action:'begin',runId,pdfStyleId:'clean'}),/超出/);
});

test('the actual research prompt selects one layout, reads its PDF and excludes placeholder evidence and model branding',()=>{
  for(const pdfStyleId of ['clean','presentation','data','editorial']){
    const settings=validateSettings({...value,pdfStyleId});assert.equal(settings.pdfStyleId,pdfStyleId);
    const prompt=buildPrompt({...value,pdfStyleId},'run-pdfstyle-12345678');
    assert.match(prompt,/web-research-runs\/run-pdfstyle-12345678\/_inputs\/pdf-template\.pdf/);
    assert.match(prompt,/占位/);assert.match(prompt,/不.*模型名称/);
  }
  assert.throws(()=>validateSettings({...value,pdfStyleId:'arbitrary'}));
  assert.doesNotMatch(buildPrompt({...value,pdfStyleId:'custom'},'run-pdfstyle-12345678'),/_inputs\/pdf-template\.pdf/);
});

test('PDF research material keeps the preset while an uploaded PDF template overrides it',()=>{
  const runId='run-pdfstyle-12345678';
  const material=buildPrompt({...value,pdfStyleId:'data'},runId,[{name:'customer.pdf',kind:'material'}]);
  assert.match(material,/PDF 版式：数据对照/);assert.match(material,/_inputs\/pdf-template\.pdf/);
  const template=buildPrompt({...value,pdfStyleId:'data'},runId,[{name:'brand.PDF',kind:'template'}]);
  assert.match(template,/PDF 版式：上传的 PDF 模板/);assert.doesNotMatch(template,/_inputs\/pdf-template\.pdf/);
});
