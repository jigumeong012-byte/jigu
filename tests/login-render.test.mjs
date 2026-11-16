import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as model from '../dist/model.js';

test('unauthenticated visitors see the login and signup form', async () => {
  const source = (await readFile(new URL('../dist/app.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '');
  const listeners = {};
  const app = { innerHTML: '' };
  const modal = { open: false, addEventListener() {} };
  const location = { hash: '' };
  const document = {
    querySelector: selector => selector === '#app' ? app : selector === '#modal' ? modal : null,
    addEventListener() {},
    body: { classList: { toggle() {}, remove() {} }, style: {} }
  };
  const unauthorized = Object.assign(new Error('로그인이 필요합니다.'), { status: 401 });
  const context = {
    ...model, api: { user: async () => { throw unauthorized; } }, toTask() {}, request() {},
    document, location, navigator: {}, localStorage: { getItem() { return null; }, setItem() {} },
    window: { addEventListener: (name, fn) => { listeners[name] = fn; }, scrollTo() {} },
    setInterval() {}, setTimeout() {}, clearTimeout() {}, console
  };
  vm.runInNewContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(app.innerHTML, /id="auth-form"/);
  assert.match(app.innerHTML, /data-value="signup"/);
  assert.match(app.innerHTML, /name="remember"/);
  assert.equal(location.hash, '/login');
});

test('growth page shows only the account’s completed quests', async () => {
  const source = (await readFile(new URL('../dist/app.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '');
  for (const tasks of [[], [
    {id:'1',title:'먼저 등록했지만 나중에 완료',category:'개발',xp:30,done:true,date:'2026-11-16',completedAt:'2026-11-16T12:00:00',checks:[]},
    {id:'2',title:'나중에 등록했지만 먼저 완료',category:'개발',xp:30,done:true,date:'2026-11-16',completedAt:'2026-11-16T11:00:00',checks:[]}
  ]]) {
    const app = { innerHTML: '' };
    const modal = { open:false, addEventListener() {} };
    const context = {
      ...model,
      api: {user:async()=>({id:42,username:'테스트',level:1,exp:tasks.length ? 30 : 0}), quests:async()=>tasks},
      toTask: task=>task, request() {},
      document: {querySelector:s=>s==='#app'?app:s==='#modal'?modal:null, addEventListener(){}, body:{classList:{toggle(){},remove(){}},style:{}}},
      location:{hash:'#/growth'}, navigator:{}, localStorage:{getItem(){return null;},setItem(){}},
      window:{addEventListener(){},scrollTo(){}}, setInterval(){},setTimeout(){},clearTimeout(){},console
    };
    vm.runInNewContext(source, context);
    await new Promise(resolve=>setImmediate(resolve));
    assert.doesNotMatch(app.innerHTML, /레벨 7 달성|1,500 XP|일평균 85 XP|예시 컬렉션/);
    if (tasks.length) assert.ok(app.innerHTML.indexOf('먼저 등록했지만 나중에 완료') < app.innerHTML.indexOf('나중에 등록했지만 먼저 완료'));
    else assert.match(app.innerHTML, /아직 완료한 퀘스트가 없어요/);
  }
});
