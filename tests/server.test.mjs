import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

test('development server serves assets, proxies JSON, and reports an unavailable backend', {timeout:20000}, async t=>{
 const upstream=http.createServer(async(req,res)=>{
  let body='';for await(const chunk of req)body+=chunk;
  res.writeHead(201,{'Content-Type':'application/json'}).end(JSON.stringify({method:req.method,path:req.url,body:JSON.parse(body)}));
 });
 upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 t.after(()=>upstream.close());
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',API_ORIGIN:`http://127.0.0.1:${upstream.address().port}`},windowsHide:true});
 t.after(()=>child.kill());
 const origin=await new Promise((resolve,reject)=>{
  let output='';child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/http:\/\/localhost:(\d+)/);if(match)resolve(`http://127.0.0.1:${match[1]}`);});
  child.on('error',reject);child.on('exit',code=>reject(Error(`Server exited: ${code}`)));
 });
 assert.equal((await fetch(origin)).status,200);
 assert.equal((await fetch(origin+'/api.js')).status,200);
 const manifest = await fetch(origin+'/manifest.webmanifest');
 assert.match(manifest.headers.get('content-type'),/application\/manifest\+json/);
 assert.equal((await manifest.json()).display,'standalone');
 assert.match((await fetch(origin+'/icons/icon-192.png')).headers.get('content-type'),/image\/png/);
 assert.equal((await fetch(origin+'/service-worker.js')).status,200);
 const response=await fetch(origin+'/api/quests?userId=1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'프록시 확인'})});
 assert.equal(response.status,201);
 assert.deepEqual(await response.json(),{method:'POST',path:'/api/quests?userId=1',body:{title:'프록시 확인'}});
 await new Promise(resolve=>upstream.close(resolve));
 const unavailable=await fetch(origin+'/api/users/1');
 assert.equal(unavailable.status,502);assert.match((await unavailable.json()).message,/백엔드 서버/);
});
