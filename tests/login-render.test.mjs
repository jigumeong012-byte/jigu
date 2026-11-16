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
  assert.equal(location.hash, '/login');
});
