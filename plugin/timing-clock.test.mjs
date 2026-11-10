import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('client.template.js',import.meta.url),'utf8');

test('the live clock updates once per second and removes its interval on unmount',()=>{
  const declaration=source.match(/function useRunClock\([^]*?(?=\n  function PlanProgress)/)?.[0];
  assert.ok(declaration,'The page needs a live clock, independent of Agent messages.');
  let now=1000,callback,cleanup,cleared;
  const values=[];
  const React={useState:initial=>[initial(),value=>values.push(value)],useEffect:effect=>cleanup=effect()};
  vm.runInNewContext(`${declaration}\nuseRunClock(true)`,{React,Date:{now:()=>now},setInterval:(fn,ms)=>{assert.equal(ms,1000);callback=fn;return 42;},clearInterval:id=>cleared=id});
  now=2000;callback();assert.equal(values.at(-1),2000);
  cleanup();assert.equal(cleared,42);
});

test('a completed task does not create a ticking interval',()=>{
  const declaration=source.match(/function useRunClock\([^]*?(?=\n  function PlanProgress)/)?.[0];
  assert.ok(declaration);
  let intervals=0;
  const React={useState:initial=>[initial(),()=>{}],useEffect:effect=>effect()};
  vm.runInNewContext(`${declaration}\nuseRunClock(false)`,{React,Date,setInterval:()=>intervals++,clearInterval:()=>{}});
  assert.equal(intervals,0);
});

test('duration formatting handles hours, invalid legacy dates and clock differences',()=>{
  const declaration=source.match(/function elapsedMilliseconds\([^]*?(?=\n  function useRunClock)/)?.[0];
  assert.ok(declaration);
  const functions=vm.runInNewContext(`${declaration}\n({elapsedMilliseconds,formatElapsed,stepElapsed})`,{Date});
  assert.equal(functions.formatElapsed(3_723_000),'1小时02分03秒');
  assert.equal(functions.formatElapsed(0),'0秒');
  assert.equal(functions.elapsedMilliseconds('bad date',undefined,1000),null);
  assert.equal(functions.elapsedMilliseconds('2026-11-10T01:00:00Z',null,Date.now()),null);
  assert.equal(functions.elapsedMilliseconds('2026-11-10T01:00:00Z',undefined,0),0);
  assert.equal(functions.stepElapsed({status:'completed',startedAt:'2026-11-10T01:00:00Z'},Date.now()),'未记录');
});
