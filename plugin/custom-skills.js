export function validateCustomSkill(input) {
  const name=String(input.name||'').trim();
  const description=String(input.description||'').trim();
  const sourceKind=input.sourceKind||'installed';
  let location=String(input.location||'').trim();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))throw new Error('skill 名称请使用小写英文、数字和短横线。');
  if(!description)throw new Error('请填写中文用途说明。');
  if(sourceKind==='github'){
    let url;try{url=new URL(location);}catch{throw new Error('请填写完整的 GitHub 来源网址。');}
    if(url.protocol!=='https:'||url.hostname!=='github.com'||url.username||url.password||url.search||url.hash||!/^[\w.-]+\/[\w.-]+(?:\/tree\/[\w./-]+)?\/?$/.test(url.pathname.slice(1))||url.pathname.split('/').includes('..'))throw new Error('来源请使用不带账号密码的 GitHub 仓库或目录网址。');
    location=url.href;
  }else if(sourceKind==='local'){
    if(!location.startsWith('/')||location.split('/').includes('..')||/[\r\n\0]/.test(location))throw new Error('请填写 skill 目录的绝对路径，不要包含 ..。');
  }else if(sourceKind==='installed'){
    location=name;
  }else throw new Error('请选择正确的 skill 来源类型。');
  return {name,description:description.slice(0,1200),sourceKind,location};
}
