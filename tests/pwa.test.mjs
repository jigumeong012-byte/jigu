import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('manifest provides installable icons that match their advertised dimensions', async () => {
  const manifest = JSON.parse(await readFile(new URL('../dist/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.scope, '/');
  for (const size of [192,512]) {
    const icon = manifest.icons.find(i => i.purpose === 'any' && i.sizes === `${size}x${size}`);
    assert.ok(icon);
    const bytes = await readFile(new URL(`../dist${icon.src}`, import.meta.url));
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }
  assert.ok(manifest.icons.some(i => i.purpose === 'maskable' && i.sizes === '512x512'));
});

test('service worker caches only offline fallback and never intercepts API or assets', async () => {
  const source = await readFile(new URL('../dist/service-worker.js', import.meta.url), 'utf8');
  const listeners = {}, stored = [], removed = [];
  let claimed = false, skipped = false, networkFailure = false;
  const cache = {add: async url => stored.push(url)};
  const context = {
    URL,
    self: {location:{origin:'https://example.test'},addEventListener:(name, fn) => {listeners[name]=fn;},
      skipWaiting:async()=>{skipped=true;},clients:{claim:async()=>{claimed=true;}}},
    caches: {open:async()=>cache,keys:async()=>['lifequest-offline-old','unrelated'],
      delete:async key=>removed.push(key),match:async()=> 'offline page'},
    fetch:async()=>{if(networkFailure)throw Error('offline');return 'network page';}
  };
  vm.runInNewContext(source,context);
  let pending;
  listeners.install({waitUntil:p=>{pending=p;}});await pending;
  assert.deepEqual(stored,['/offline.html']);assert.equal(skipped,true);
  listeners.activate({waitUntil:p=>{pending=p;}});await pending;
  assert.deepEqual(removed,['lifequest-offline-old']);assert.equal(claimed,true);
  const route = request => {let response;listeners.fetch({request,respondWith:p=>{response=p;}});return response;};
  assert.equal(route({mode:'cors',method:'GET',url:'https://example.test/api/quests'}),undefined);
  assert.equal(route({mode:'navigate',method:'GET',url:'https://example.test/api/health'}),undefined);
  assert.equal(route({mode:'no-cors',method:'GET',url:'https://example.test/app.js'}),undefined);
  const request={mode:'navigate',method:'GET',url:'https://example.test/'};
  assert.equal(await route(request),'network page');
  networkFailure=true;
  assert.equal(await route(request),'offline page');
});
