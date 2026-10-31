import test from 'node:test'; import assert from 'node:assert/strict';
import { loadPlugin, _resetPlugin } from '../src/notify.js';
import { contextInfo, sourceContext, verifySources, usableSections } from '../src/structure.js';

// A Capacitor plugin proxy: every property, including 'then', is a "native method" that throws when not implemented.
const proxyPlugin = () => new Proxy({}, { get: (_, k) => { if (k === 'then') return () => { throw Error('"LocalNotifications.then()" is not implemented on android'); }; return async () => ({ display: 'granted' }); } });

test('notifications: the plugin proxy is never awaited as a thenable', async () => {
  _resetPlugin(); let thenCalls = 0;
  const P = new Proxy({}, { get: (_, k) => { if (k === 'then') { thenCalls++; return undefined; } return async () => ({ display: 'granted' }); } });
  const box = await loadPlugin(() => true, async () => ({ LocalNotifications: P }));
  assert.equal(box.n, P); assert.equal(thenCalls, 0);
  _resetPlugin();
  const b2 = await loadPlugin(() => true, async () => ({ LocalNotifications: proxyPlugin() }));
  assert.equal((await b2.n.checkPermissions()).display, 'granted');
  _resetPlugin();
});
test('notifications: no plugin off-device or when the import fails', async () => {
  _resetPlugin(); assert.equal((await loadPlugin(() => false)).n, null);
  _resetPlugin(); assert.equal((await loadPlugin(() => true, async () => { throw Error('x'); })).n, null); _resetPlugin();
});
test('context size: sections without ref / title / text do not crash (Android reduce TypeError)', () => {
  const doc = { sections: [{ text: 'abc' }, { ref: 'B', text: 'defg' }, null, { ref: 'C' }, { title: 'T', text: 'hi' }, { text: 42 }] };
  const i = contextInfo(doc); assert.ok(i.total > 0 && !i.truncated);
  assert.ok(sourceContext(doc).includes('[Section 1]'));
  assert.equal(usableSections(doc).length, 3);
  assert.deepEqual(contextInfo({}), { total: 0, used: 0, truncated: false });
  assert.equal(verifySources({ sections: [{ text: 'x' }] }, [{ q: 1 }])[0].sourceVerified, false);
});
