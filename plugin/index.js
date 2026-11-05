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
    name:'web_research_manage',description:'管理当前工作区网页研究任务：保存 AI 生成的计划、按 stepId 更新实际步骤与依赖状态、检查实际 PDF/XLSX 报告清单、读取或更新插件模板。与用户页面使用同一服务。finalize 会在实际文件检查通过后完成唯一进行中的最后一步，其他步骤须已完成或说明原因跳过。不能代替用户授权或确认登录。',
    parameters:{type:'object',properties:{action:{type:'string',enum:['status','set_plan','progress','finalize','get_templates','set_templates']},runId:{type:'string'},plan:{type:'object',description:'AI 根据本次目标与材料制定的计划。初次保存后按步骤执行；调整时 message 说明原因，保留已完成步骤。',properties:{summary:{type:'string'},steps:{type:'array',minItems:1,maxItems:40,items:{type:'object',properties:{id:{type:'string',pattern:'^[a-z][a-z0-9-]{0,63}$',description:'稳定的小写英文、数字和短横线编号'},title:{type:'string',maxLength:200},detail:{type:'string',maxLength:2000}},required:['id','title'],additionalProperties:false}}},required:['summary','steps'],additionalProperties:false},stepId:{type:'string',description:'当前计划中的稳定步骤编号'},stepStatus:{type:'string',enum:['pending','in_progress','completed','blocked','failed','skipped']},phase:{type:'string',description:'仅供没有 AI 计划的旧版任务兼容使用；新任务使用 stepId 和 stepStatus。',enum:['dependencies','browser','collect','analysis','export']},status:{type:'string',enum:['running','waiting','failed']},message:{type:'string'},dependencies:{type:'object',properties:{gtm:{type:'string',enum:['unknown','ready','failed']},browser:{type:'string',enum:['unknown','ready','failed']},chrome:{type:'string',enum:['unknown','ready','failed']}},additionalProperties:false},templates:{type:'array',items:{type:'object',additionalProperties:true}}},required:['action'],additionalProperties:false},
    output:{schema:{type:'object',additionalProperties:true},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},
    async execute(args,exec){return run(exec.agent,args);}
  }));
}
