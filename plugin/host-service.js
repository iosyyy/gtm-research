import {readFile,writeFile,mkdir,rename,stat,realpath} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {reviseTaskPlan,updateTaskStep,planRunStatus} from './task-plan.js';
import {resolvePdfStyle} from './pdf-styles.js';

const RUN=/^run-[a-zA-Z0-9-]{8,64}$/;
const PHASES=['dependencies','browser','collect','analysis','export'];
const STATES=['running','waiting','failed'];
const SOURCES=['gtmagents/gtm-agents','zime-ai/zime-gtm-skills','custom'];

async function readJson(path,fallback,root){try{if(root)await contained(root,path);const info=await stat(path);if(info.size>2_000_000)throw new Error('配置文件过大。');return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
async function writeJson(path,value){await mkdir(resolve(path,'..'),{recursive:true});const temporary=path+'.'+randomUUID()+'.tmp';await writeFile(temporary,JSON.stringify(value,null,2)+'\n',{mode:0o600});await rename(temporary,path);}
async function contained(root,path){const base=await realpath(root);const target=await realpath(path);if(target!==base&&!target.startsWith(base+sep))throw new Error('路径超出本次研究目录。');return target;}

export function validateTemplates(value){
  if(!Array.isArray(value)||!value.length||value.length>120)throw new Error('模板列表需要包含 1–120 项。');
  const ids=new Set();
  for(const d of value){
    if(!/^[a-z0-9-]+$/.test(d.id)||ids.has(d.id)||typeof d.name!=='string'||!d.name.trim()||typeof d.description!=='string'||!d.description.trim()||!SOURCES.includes(d.repository)||!Array.isArray(d.skills)||d.skills.some(s=>!(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).test(s)))throw new Error('模板字段或技能来源无效。');
    if(d.name.length>150||d.description.length>8000)throw new Error('模板内容过长。');
    ids.add(d.id);
  }
  return value;
}

export async function verifyManifest(cwd,runId){
  if(!RUN.test(runId))throw new Error('任务编号无效。');
  const workspace=await realpath(cwd),runs=join(workspace,'web-research-runs');
  const output=await contained(workspace,join(runs,runId));
  const manifestPath=await contained(output,join(output,'manifest.json'));
  const manifest=await readJson(manifestPath,null,output);
  if(!manifest||!Array.isArray(manifest.files)||manifest.files.length<2||manifest.files.length>30)throw new Error('报告清单未生成或不完整。');
  const files=[];let hasPdf=false,hasExcel=false;
  for(const file of manifest.files){
    const candidate=typeof file==='string'?file:file.path;
    if(typeof candidate!=='string')throw new Error('报告路径无效。');
    const path=await contained(output,resolve(output,candidate));
    const info=await stat(path);
    if(!info.isFile()||info.size<1||info.size>200_000_000)throw new Error('报告文件为空或超出大小限制。');
    if(/\.pdf$/i.test(path)){
      const bytes=await readFile(path);if(bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('PDF 文件格式无效。');hasPdf=true;
    }
    if(/\.xlsx$/i.test(path)){
      const bytes=await readFile(path);if(bytes[0]!==0x50||bytes[1]!==0x4b)throw new Error('Excel 文件格式无效。');hasExcel=true;
    }
    files.push({name:typeof file==='string'?path.split(sep).pop():String(file.name||path.split(sep).pop()),path,bytes:info.size});
  }
  if(!hasPdf||!hasExcel)throw new Error('还需要实际生成 PDF 和 XLSX 文件。');
  return {ok:true,outputDirectory:output,files,summary:String(manifest.summary||'报告文件已在本机检查。').slice(0,4000),verifiedAt:new Date().toISOString()};
}

export function createResearchService({now=()=>Date.now()}={}){
  const locks=new Map();
  const timestamp=()=>new Date(now()).toISOString();
  async function operate(cwd,args){
    if(!cwd||typeof cwd!=='string')throw new Error('当前会话没有工作区。');
    const workspace=await realpath(cwd);
    const configDir=join(workspace,'.web-research');
    await mkdir(configDir,{recursive:true});await contained(workspace,configDir);
    const configPath=join(configDir,'studio-config.json');
    if(args.action==='get_templates')return {templates:(await readJson(configPath,{},workspace)).templates||null};
    if(args.action==='set_templates'){
      const templates=validateTemplates(args.templates);const old=await readJson(configPath,{},workspace);
      await writeJson(configPath,{...old,templates,updatedAt:timestamp()});return {templates};
    }
    if(!RUN.test(args.runId||''))throw new Error('任务编号无效。');
    const runs=join(workspace,'web-research-runs');await mkdir(runs,{recursive:true});await contained(workspace,runs);
    const output=join(runs,args.runId);await mkdir(output,{recursive:true});await contained(workspace,output);
    const path=join(output,'task-state.json');
    const current=await readJson(path,{runId:args.runId},output);
    if(args.action==='status')return current;
    if(args.action==='begin'){
      if(current.createdAt)return current;
      const startedAt=timestamp();
      const style=resolvePdfStyle(args.pdfStyleId||'clean');
      const reportTemplate={id:style.id,name:style.name};
      if(style.file){
        const inputs=join(output,'_inputs');await mkdir(inputs,{recursive:true});await contained(output,inputs);
        const bytes=await readFile(new URL('./pdf-templates/'+style.file,import.meta.url));
        if(bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('内置 PDF 模板损坏，请更新插件。');
        const destination=join(inputs,'pdf-template.pdf'),temporary=destination+'.'+randomUUID()+'.tmp';
        await writeFile(temporary,bytes,{mode:0o600});await rename(temporary,destination);
        reportTemplate.relativePath='web-research-runs/'+args.runId+'/_inputs/pdf-template.pdf';
      }
      const next={schemaVersion:2,timingVersion:1,pdfTemplateVersion:1,reportTemplate,runId:args.runId,phase:'planning',plan:null,status:'running',message:'正在根据网页、材料和研究目标制定计划。',createdAt:startedAt,updatedAt:startedAt,dependencies:{gtm:'unknown',browser:'unknown',chrome:'unknown'}};
      await writeJson(path,next);return next;
    }
    if(args.action==='set_plan'){
      if(current.result)throw new Error('这次研究已完成，请新建任务。');
      const plan=reviseTaskPlan(current.plan,args.plan,args.message,timestamp());
      const next={...current,schemaVersion:2,timingVersion:1,phase:'executing',plan,status:planRunStatus(plan),message:args.message?String(args.message).slice(0,2000):'AI 已制定本次计划，将按实际执行更新。',updatedAt:timestamp()};
      await writeJson(path,next);return next;
    }
    if(args.action==='progress'){
      if(current.result)throw new Error('这次研究已完成，请新建任务。');
      if(args.status!==undefined&&!STATES.includes(args.status))throw new Error('任务状态无效；完成必须通过 finalize 检查。');
      if(current.schemaVersion===2&&args.phase!==undefined)throw new Error('请按 AI 计划的 stepId 和 stepStatus 更新，不使用固定阶段。');
      const hasStep=args.stepId!==undefined||args.stepStatus!==undefined;
      const plan=hasStep?updateTaskStep(current.plan,args,timestamp()):current.plan;
      if(!current.schemaVersion&&!plan&&!PHASES.includes(args.phase))throw new Error('阶段或状态无效。');
      const dependencies={...current.dependencies};
      for(const [key,value] of Object.entries(args.dependencies||{})){
        if(!['gtm','browser','chrome'].includes(key)||!['unknown','ready','failed'].includes(value))throw new Error('依赖状态无效。');dependencies[key]=value;
      }
      const next={...current,...plan?{plan,timingVersion:1}:{},phase:plan?'executing':args.phase||current.phase,status:args.status||(plan?planRunStatus(plan):current.status),message:String(args.message||'').slice(0,2000),dependencies,updatedAt:timestamp()};
      await writeJson(path,next);return next;
    }
    if(args.action==='finalize'){
      if(current.schemaVersion===2&&!current.plan)throw new Error('请先保存并执行 AI 制定的计划。');
      const unfinished=current.plan?.steps.filter(s=>!['completed','skipped'].includes(s.status))||[];
      const finalStep=unfinished.length===1&&unfinished[0]===current.plan.steps.at(-1)&&unfinished[0].status==='in_progress'?unfinished[0]:null;
      if(unfinished.length&&!finalStep)throw new Error('计划中还有未结束的步骤，请核对真实执行情况。');
      const result=await verifyManifest(workspace,args.runId);
      const finishedAt=timestamp();
      const plan=finalStep?updateTaskStep(current.plan,{stepId:finalStep.id,stepStatus:'completed',message:'实际报告文件已通过最终检查。'},finishedAt):current.plan;
      const next={...current,...plan?{plan,timingVersion:1}:{},phase:'export',status:'complete',message:result.summary,result,completedAt:current.completedAt||current.result?.verifiedAt||finishedAt,updatedAt:finishedAt};
      await writeJson(path,next);return next;
    }
    throw new Error('不支持的网页研究操作。');
  }
  return {execute(cwd,args){const key=resolve(cwd);const prior=locks.get(key)||Promise.resolve();const next=prior.catch(()=>{}).then(()=>operate(cwd,args));locks.set(key,next);next.finally(()=>{if(locks.get(key)===next)locks.delete(key);}).catch(()=>{});return next;}};
}
