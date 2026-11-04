import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('start accepts the real Harness string session identity and workspaceId',async()=>{
  const source=await readFile(new URL('client.template.js',import.meta.url),'utf8');
  const declaration=source.match(/async function newRun\(kind\)\{[\s\S]*?(?=\n    async function send)/)?.[0];
  assert.ok(declaration);
  const calls=[];
  const sandbox={Date,Math,workspaceId:'workspace-test',url:'https://example.com/',name:'Example',workspace:()=>({workspaceId:'workspace-test',path:'/tmp/research'}),read:()=>({runs:[]}),persist:()=>{},setRun:()=>{},setText:()=>{},ctx:{sessions:{create:async input=>{calls.push(input);return 'session-real-id';}}}};
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
