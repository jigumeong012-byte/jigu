import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,stats,createTask,dayKey} from '../dist/model.js';
import {toTask,difficultyFor,request,api} from '../dist/api.js';

test('new account has no demo quests or phantom XP',()=>{
 const s=initialState();assert.equal(s.tasks.length,0);assert.equal(stats(s).xp,0);assert.equal(stats(s).level,1);assert.equal(stats(s).rate,0);
});
test('server level and XP are authoritative even after task deletion',()=>{
 const s=initialState();s.user={level:2,exp:30};s.tasks=[{done:true,xp:50,checks:[{done:true}]}];
 assert.equal(stats(s).xp,130);assert.equal(stats(s).progress,30);assert.equal(stats(s).remaining,70);
 s.tasks=[];assert.equal(stats(s).xp,130);
});
test('level boundary resets progress and checklist adds no XP',()=>{
 const s=initialState();s.user={level:2,exp:0};s.tasks=[{done:false,xp:50,checks:[{done:true}]}];
 assert.equal(stats(s).progress,0);assert.equal(stats(s).remaining,100);assert.equal(stats(s).earned,0);
});
test('task validates rewards and title and Seoul date',()=>{
 for(const xp of [0,20,40,100,500,NaN])assert.throws(()=>createTask({title:'Test',xp}));
 assert.throws(()=>createTask({title:' '}));assert.throws(()=>createTask({title:'a'.repeat(101)}));
 assert.equal(createTask({title:'  Test  ',xp:50}).title,'Test');
 assert.equal(dayKey(new Date('2026-10-26T16:00:00Z')),'2026-10-27');
 assert.equal(difficultyFor(10),'쉬움');assert.equal(difficultyFor(30),'보통');assert.equal(difficultyFor(50),'어려움');assert.throws(()=>difficultyFor(100));
});
test('remote data overrides stale task fields while preserving local notes',()=>{
 const t=toTask({id:12,title:'서버 제목',category:'개발',rewardExp:30,difficulty:'보통',completed:true,createdAt:'2026-10-27T12:00:00'},
 {id:'old',title:'old',xp:50,done:false,note:'메모',star:true,checks:[{id:'c1',done:true}]});
 assert.equal(t.id,'12');assert.equal(t.title,'서버 제목');assert.equal(t.xp,30);assert.equal(t.done,true);assert.equal(t.note,'메모');assert.equal(t.checks.length,1);
});
test('API sends backend difficulty instead of browser XP and handles 204',async t=>{
 let sent;t.mock.method(globalThis,'fetch',async (url,options)=>{sent={url,options};return new Response(null,{status:204});});
 assert.equal(await api.create({title:'test',category:'개발',xp:50}),null);
 assert.equal(sent.url,'/api/quests');assert.deepEqual(JSON.parse(sent.options.body),{userId:1,title:'test',category:'개발',difficulty:'어려움'});
});
test('API retains HTTP error status for recoverable validation failures',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({message:'완료한 보상은 고정'}),{status:409}));
 await assert.rejects(request('/quests/1'),error=>error.status===409&&error.message==='완료한 보상은 고정');
});
test('connection failure produces a retryable message',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw new TypeError('Failed to fetch');});
 await assert.rejects(request('/users/1'),/서버에 연결할 수 없어요/);
});
test('unusual task names are retained as data and boundary lengths are checked',()=>{
 const special='<img src=x onerror=alert(1)> & 눈사람 ☃️';
 assert.equal(createTask({title:`  ${special}  `,xp:30}).title,special);
 assert.equal(createTask({title:'가'.repeat(100),xp:10}).title.length,100);
 assert.throws(()=>createTask({title:'가'.repeat(101),xp:10}));
 assert.throws(()=>createTask({title:'\u00a0\t\n',xp:30}));
});
test('HTML error pages give a safe message',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('<html>server error</html>',{status:503}));
 await assert.rejects(request('/quests'),error=>error.status===503&&!error.message.includes('<html>'));
});
