import {readFile,writeFile,mkdir,rename,stat,realpath} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {randomUUID} from 'node:crypto';

const RUN=/^run-[a-zA-Z0-9-]{8,64}$/;
const PHASES=['dependencies','browser','collect','analysis','export'];
const STATES=['running','waiting','failed','complete'];
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

export function createResearchService(){
  const locks=new Map();
  async function operate(cwd,args){
    if(!cwd||typeof cwd!=='string')throw new Error('当前会话没有工作区。');
    const workspace=await realpath(cwd);
    const configDir=join(workspace,'.web-research');
    await mkdir(configDir,{recursive:true});await contained(workspace,configDir);
    const configPath=join(configDir,'studio-config.json');
    if(args.action==='get_templates')return {templates:(await readJson(configPath,{},workspace)).templates||null};
    if(args.action==='set_templates'){
      const templates=validateTemplates(args.templates);const old=await readJson(configPath,{},workspace);
      await writeJson(configPath,{...old,templates,updatedAt:new Date().toISOString()});return {templates};
    }
    if(!RUN.test(args.runId||''))throw new Error('任务编号无效。');
    const runs=join(workspace,'web-research-runs');await mkdir(runs,{recursive:true});await contained(workspace,runs);
    const output=join(runs,args.runId);await mkdir(output,{recursive:true});await contained(workspace,output);
    const path=join(output,'task-state.json');
    const current=await readJson(path,{runId:args.runId},output);
    if(args.action==='status')return current;
    if(args.action==='begin'){
      const next={runId:args.runId,phase:'dependencies',status:'running',message:'任务已创建，正在检查所需依赖。',createdAt:current.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),dependencies:{gtm:'unknown',browser:'unknown',chrome:'unknown'}};
      await writeJson(path,next);return next;
    }
    if(args.action==='progress'){
      if(!PHASES.includes(args.phase)||!STATES.includes(args.status))throw new Error('阶段或状态无效。');
      const dependencies={...current.dependencies};
      for(const [key,value] of Object.entries(args.dependencies||{})){
        if(!['gtm','browser','chrome'].includes(key)||!['unknown','ready','failed'].includes(value))throw new Error('依赖状态无效。');dependencies[key]=value;
      }
      const next={...current,phase:args.phase,status:args.status,message:String(args.message||'').slice(0,2000),dependencies,updatedAt:new Date().toISOString()};
      await writeJson(path,next);return next;
    }
    if(args.action==='finalize'){
      const result=await verifyManifest(workspace,args.runId);const next={...current,phase:'export',status:'complete',message:result.summary,result,updatedAt:new Date().toISOString()};
      await writeJson(path,next);return next;
    }
    throw new Error('不支持的网页研究操作。');
  }
  return {execute(cwd,args){const key=resolve(cwd);const prior=locks.get(key)||Promise.resolve();const next=prior.catch(()=>{}).then(()=>operate(cwd,args));locks.set(key,next);next.finally(()=>{if(locks.get(key)===next)locks.delete(key);}).catch(()=>{});return next;}};
}
