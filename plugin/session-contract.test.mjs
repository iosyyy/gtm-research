import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('start accepts the real Harness string session identity and workspaceId',async()=>{
  const source=await readFile(new URL('client.template.js',import.meta.url),'utf8');
  const declaration=source.match(/async function newRun\(kind\)\{[\s\S]*?(?=\n    async function send)/)?.[0];
  assert.ok(declaration);
  const calls=[];
  const sandbox={Date,Math,browserEngine:'default',skillSource:'gtmagents/gtm-agents',workspaceId:'workspace-test',url:'https://example.com/',name:'Example',workspace:()=>({workspaceId:'workspace-test',path:'/tmp/research'}),read:()=>({runs:[]}),persist:()=>{},setRun:()=>{},setText:()=>{},ctx:{sessions:{create:async input=>{calls.push(input);return 'session-real-id';}}}};
  const run=await vm.runInNewContext(`(${declaration})('research')`,sandbox);
  assert.equal(run.sessionId,'session-real-id');
  assert.equal(calls[0].workspaceId,'workspace-test');
  assert.equal(run.directory,'/tmp/research');
});

test('workspace picker uses the Harness workspaceId field',async()=>{
  const source=await readFile(new URL('client.template.js',import.meta.url),'utf8');
  assert.match(source,/items\.find\(w=>w\.workspaceId===workspaceId\)/);
  assert.match(source,/setWorkspaceId\(items\[0\]\.workspaceId\)/);
});

test('starting research queues the real task without navigating out of the workbench',async()=>{
  const source=await readFile(new URL('client.template.js',import.meta.url),'utf8');
  const declaration=source.match(/async function start\(\)\{[\s\S]*?(?=\n    async function preview)/)?.[0];
  assert.ok(declaration);
  let navigations=0,sent=0,started=0;
  const sandbox={busy:false,files:{pdf:null,excel:null},materials:[],setError:()=>{},setNotice:()=>{},setBusy:()=>{},setHostState:()=>{},setExecutionOpen:()=>{},settings:()=>({url:'https://example.com/'}),newRun:async kind=>{assert.equal(kind,'research');return {id:'run-test-12345678',sessionId:'session-background'};},hostOp:async(_run,args)=>{assert.equal(args.action,'begin');started++;return {status:'running'};},buildPrompt:()=>'Real task prompt',send:async(_run,content)=>{sent++;assert.equal(content[0].text,'Real task prompt');},openInternal:async()=>navigations++};
  await vm.runInNewContext(`(${declaration})()`,sandbox);
  assert.equal(started,1);assert.equal(sent,1);assert.equal(navigations,0);
});

test('the original conversation button explicitly opens the current task session',async()=>{
  const source=await readFile(new URL('client.template.js',import.meta.url),'utf8');
  const declaration=source.match(/const runControls=([^\n]+);/)?.[1];
  assert.ok(declaration);
  const opened=[];
  const sandbox={run:{kind:'research',sessionId:'owned-task-session'},busy:false,snapshot:{running:false},session:{},continueRun:()=>{},stop:()=>{},t:key=>key,h:(tag,props,...children)=>({tag,props,children}),ctx:{uiWorkspace:{openSession:id=>opened.push(id)}}};
  const controls=vm.runInNewContext(`(${declaration})`,sandbox);
  assert.equal(controls.children[0].children[0],'打开执行对话');
  assert.equal(controls.children.length,3);
  assert.deepEqual(opened,[]);
  controls.children[0].props.onClick();
  assert.deepEqual(opened,['owned-task-session']);
});
