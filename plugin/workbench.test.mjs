import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const code=await readFile(new URL('client.js',import.meta.url),'utf8');
function workbench(saved={}){
  let slot,values=[],cursor=0,storage=JSON.stringify(saved),effects=[];
  const React={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(x=>x!=null&&x!==false)}),useState:init=>{const i=cursor++;if(!(i in values))values[i]=typeof init==='function'?init():init;return [values[i],v=>values[i]=typeof v==='function'?v(values[i]):v];},useSyncExternalStore:(_subscribe,snapshot)=>snapshot(),useEffect:fn=>effects.push(fn)};
  const ctx={effect:fn=>fn(),locale:{register:()=>{},bind:()=>key=>({start:'开始研究',save:'保存为自己的模板',templateName:'模板名称',skills:'使用的技能（逗号分隔）'})[key]||key},slots:{inject:(_slot,fn)=>fn(),register:(opts,component)=>{if(opts.name==='main')slot=component;}},workspaces:{list:{subscribe:()=>()=>{},getSnapshot:()=>({items:[{workspaceId:'w',path:'/tmp/research'}]})}}};
  vm.runInNewContext(code,{window:{__ModuleLoader__:{load:({factory})=>factory(()=>React).apply(ctx)}},localStorage:{getItem:()=>storage,setItem:(_key,v)=>storage=v},setTimeout,clearTimeout,URL});
  return {render(){cursor=0;effects=[];return slot({ctx,t:ctx.locale.bind()});},saved:()=>JSON.parse(storage)};
}
function walk(node,predicate){if(!node||typeof node!=='object')return [];return [...(predicate(node)?[node]:[]),...(node.children||[]).flatMap(n=>walk(n,predicate))];}
function text(node){if(node==null)return '';if(typeof node!=='object')return String(node);return (node.children||[]).map(text).join(' ');}
function button(tree,name){const found=walk(tree,n=>n.type==='button'&&text(n)===name);assert.equal(found.length,1,name);return found[0];}

test('first use picks the system browser and preserves a remembered explicit choice',()=>{
  const first=workbench().render();
  const select=walk(first,n=>n.type==='select'&&n.children.some(c=>c?.props?.value==='agent-chrome'))[0];
  assert.equal(select.props.value,'default');
  const restored=workbench({preferences:{browserEngine:'chrome'}}).render();
  assert.equal(walk(restored,n=>n.type==='select'&&n.children.some(c=>c?.props?.value==='agent-chrome'))[0].props.value,'chrome');
});

test('PDF presets can be selected and an uploaded PDF overrides them until removed',()=>{
  const app=workbench();let tree=app.render();
  let styles=walk(tree,n=>n.type==='input'&&n.props.name==='wrs-pdf-style');
  assert.equal(styles.length,4);assert.equal(styles.find(s=>s.props.checked).props.value,'clean');
  styles.find(s=>s.props.value==='presentation').props.onChange();tree=app.render();
  styles=walk(tree,n=>n.type==='input'&&n.props.name==='wrs-pdf-style');
  assert.equal(styles.find(s=>s.props.checked).props.value,'presentation');
  const input=walk(tree,n=>n.type==='input'&&n.props.accept==='.pdf')[0];
  input.props.onChange({target:{files:[{name:'brand.pdf',size:100}]}});tree=app.render();
  assert.ok(walk(tree,n=>n.type==='input'&&n.props.name==='wrs-pdf-style').every(n=>n.props.disabled));
  assert.match(text(tree),/优先使用你的模板/);
  button(tree,'移除 brand.pdf').props.onClick();tree=app.render();
  styles=walk(tree,n=>n.type==='input'&&n.props.name==='wrs-pdf-style');
  assert.equal(styles.find(s=>s.props.checked).props.value,'presentation');
  assert.ok(styles.every(n=>!n.props.disabled));
});

test('unchecking a selected skill updates the filter and saved template with the same selection',()=>{
  const app=workbench();let tree=app.render();
  button(tree,'只看已选').props.onClick();tree=app.render();
  let options=walk(tree,n=>n.type==='label'&&n.props.className==='skill-option');
  assert.equal(options.length,2);
  const removed=text(options[0]);
  walk(options[0],n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange();
  tree=app.render();options=walk(tree,n=>n.type==='label'&&n.props.className==='skill-option');
  assert.equal(options.length,1);assert.ok(!text(options[0]).includes(removed));
  button(tree,'＋ 添加模板').props.onClick();tree=app.render();
  walk(tree,n=>n.type==='label'&&text(n).startsWith('模板名称'))[0].children.find(n=>n.type==='input').props.onChange({target:{value:'仅使用保留技能'}});tree=app.render();
  walk(tree,n=>n.type==='label'&&text(n).startsWith('分析要求'))[0].children.find(n=>n.type==='textarea').props.onChange({target:{value:'根据保留的技能分析证据。'}});tree=app.render();
  walk(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});
  const custom=app.saved().templates.at(-1);
  assert.equal(custom.skills.length,1);assert.equal(custom.skillRefs.length,1);assert.equal(custom.skills[0],custom.skillRefs[0].name);
  tree=app.render();assert.equal(walk(tree,n=>n.type==='label'&&text(n).startsWith('使用的技能（逗号分隔）')).length,0);
});


test('template dialog cancels without changing options and edits the selected template in place',()=>{
  const app=workbench();let tree=app.render();
  button(tree,'编辑模板').props.onClick();tree=app.render();
  assert.equal(walk(tree,n=>n.type==='dialog').length,1);
  walk(tree,n=>n.type==='label'&&text(n).startsWith('模板名称'))[0].children.find(n=>n.type==='input').props.onChange({target:{value:'不应保存'}});
  tree=app.render();button(tree,'取消').props.onClick();assert.equal(app.saved().templates,undefined);
  tree=app.render();button(tree,'编辑模板').props.onClick();tree=app.render();
  walk(tree,n=>n.type==='label'&&text(n).startsWith('模板名称'))[0].children.find(n=>n.type==='input').props.onChange({target:{value:'新的市场信号模板'}});
  tree=app.render();walk(tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});
  assert.equal(app.saved().templates.length,18);
  assert.equal(app.saved().templates.find(t=>t.id==='research-opportunities').name,'新的市场信号模板');
});

test('legacy personal-skill selection returns to the supported catalog with no add-skill entry',()=>{
 const tree=workbench({preferences:{skillSource:'custom',selected:'custom'}}).render();
 assert.equal(walk(tree,n=>n.type==='button'&&/我的技能|添加自己的 skill/.test(text(n))).length,0);
 assert.match(text(tree),/GTM Agents/);
 assert.ok(walk(tree,n=>n.type==='select'&&n.props['aria-label']==='全部研究模板')[0].children.length>3);
});
