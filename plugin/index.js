import {createResearchService} from './host-service.js';

export const inject=['commands','tools','workingDirectory'];

export function apply(ctx){
  const service=createResearchService();
  const run=async(agent,args)=>{
    if(!agent?.session)throw new Error('网页研究操作需要一个普通 Harness 会话。');
    return service.execute(ctx.workingDirectory.get(agent.session),args);
  };
  ctx.effect(()=>ctx.commands.register({
    name:'web-research',description:'网页研究台的结构化状态、模板和报告检查操作。',input:{hint:'<JSON>'},
    async handler({agent,rawInput}){try{return {kind:'success',text:JSON.stringify(await run(agent,JSON.parse(rawInput.trim())))};}catch(error){return {kind:'error',text:error?.message||String(error)};}}
  }));
  ctx.effect(()=>ctx.tools.register({
    name:'web_research_manage',description:'管理当前工作区网页研究任务：写入实际阶段和依赖状态、检查实际 PDF/XLSX 报告清单、读取或更新插件模板。与用户页面使用同一服务。不能代替用户授权或确认登录。',
    parameters:{type:'object',properties:{action:{type:'string',enum:['status','progress','finalize','get_templates','set_templates']},runId:{type:'string'},phase:{type:'string',enum:['dependencies','browser','collect','analysis','export']},status:{type:'string',enum:['running','waiting','failed','complete']},message:{type:'string'},dependencies:{type:'object',properties:{gtm:{type:'string',enum:['unknown','ready','failed']},browser:{type:'string',enum:['unknown','ready','failed']},chrome:{type:'string',enum:['unknown','ready','failed']}},additionalProperties:false},templates:{type:'array',items:{type:'object',additionalProperties:true}}},required:['action'],additionalProperties:false},
    output:{schema:{type:'object',additionalProperties:true},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},
    async execute(args,exec){return run(exec.agent,args);}
  }));
}
