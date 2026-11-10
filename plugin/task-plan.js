const STEP_STATES=['pending','in_progress','completed','blocked','failed','skipped'];

export function reviseTaskPlan(current,value,reason,now=new Date().toISOString()){
  if(!value||typeof value.summary!=='string'||!value.summary.trim()||value.summary.length>1000||!Array.isArray(value.steps)||value.steps.length<1||value.steps.length>40)throw new Error('计划需要简要说明和 1–40 个实际步骤。');
  if(current&&!String(reason||'').trim())throw new Error('调整计划时请说明原因。');
  const ids=new Set();
  const steps=value.steps.map(step=>{
    if(!step||typeof step.id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(step.id)||ids.has(step.id)||typeof step.title!=='string'||!step.title.trim()||step.title.length>200||step.detail!==undefined&&(typeof step.detail!=='string'||step.detail.length>2000)||Object.hasOwn(step,'status'))throw new Error('计划步骤无效：使用唯一编号和简短标题，状态通过 progress 更新。');
    ids.add(step.id);
    const previous=current?.steps.find(s=>s.id===step.id);
    if(previous?.status==='completed'&&previous.title!==step.title.trim())throw new Error('不能改写已完成步骤的含义，请新增步骤。');
    return {...previous,id:step.id,title:step.title.trim(),detail:(step.detail||'').trim(),status:previous?.status||'pending'};
  });
  if(current?.steps.some(s=>['completed','in_progress'].includes(s.status)&&!ids.has(s.id)))throw new Error('已完成或正在执行的步骤必须保留；不再需要的步骤先说明原因并标为跳过。');
  return {summary:value.summary.trim(),steps,revision:(current?.revision||0)+1,createdAt:current?.createdAt||now,updatedAt:now,changeReason:String(reason||'').slice(0,2000)};
}

export function updateTaskStep(plan,args,now=new Date().toISOString()){
  if(!plan)throw new Error('请先通过 set_plan 保存 AI 制定的计划。');
  if(typeof args.stepId!=='string'||!STEP_STATES.includes(args.stepStatus))throw new Error('需要有效的步骤编号和步骤状态。');
  if(!plan.steps.some(s=>s.id===args.stepId))throw new Error('计划中不存在这个步骤，请先调整计划。');
  if(['blocked','failed','skipped'].includes(args.stepStatus)&&!String(args.message||'').trim())throw new Error('等待、失败或跳过时需要说明原因。');
  if(args.stepStatus==='in_progress'&&plan.steps.some(s=>s.id!==args.stepId&&s.status==='in_progress'))throw new Error('请先更新当前执行步骤，再开始下一步。');
  return {...plan,updatedAt:now,steps:plan.steps.map(s=>{
    if(s.id!==args.stepId)return s;
    const next={...s,status:args.stepStatus,message:String(args.message||'').slice(0,2000),updatedAt:now};
    if(args.stepStatus==='in_progress'&&!s.startedAt){next.startedAt=now;if(s.status!=='pending')next.timingPartial=true;}
    if(['completed','failed','skipped'].includes(args.stepStatus))next.finishedAt=s.status===args.stepStatus&&s.finishedAt?s.finishedAt:now;
    else if(s.finishedAt)delete next.finishedAt;
    return next;
  })};
}

export function planRunStatus(plan){
  if(plan.steps.some(s=>s.status==='in_progress'))return 'running';
  if(plan.steps.some(s=>s.status==='failed'))return 'failed';
  if(plan.steps.some(s=>s.status==='blocked'))return 'waiting';
  return 'running';
}
