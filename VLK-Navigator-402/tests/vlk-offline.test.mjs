import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const code = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const release = 'a'.repeat(64);
const name = `vlk-402-release-${release}`;
const asset = '/_next/static/chunks/article-87.js';
function harness({ failAsset = false, version = release } = {}) {
  const handlers = new Map(); const data = new Map();
  let offline = false; let skipped = 0; let stalled = false; let networkReads = 0;
  const key = (request) => typeof request === 'string' ? request : new URL(request.url).pathname;
  const caches = {
    keys: async () => [...data.keys()],
    delete: async (id) => data.delete(id),
    open: async (id) => {
      if (!data.has(id)) data.set(id, new Map());
      const store = data.get(id);
      return {
        match: async (request) => store.get(key(request))?.clone(),
        put: async (request, response) => store.set(key(request), response),
        addAll: async (urls) => {
          if (failAsset) throw new Error('missing chunk');
          for (const url of urls) store.set(url, new Response(`cached:${url}`));
        },
      };
    },
  };
  const fetch = async (request) => {
    networkReads++;
    if (stalled) return new Promise(() => {});
    if (offline) throw new Error('offline');
    if (request === '/offline-manifest.json') return Response.json({ version, assets: [asset, '/_next/static/chunks/app.css'] });
    return new Response('online');
  };
  const self = { location: { href: `https://app.test/sw.js?release=${release}`, origin: 'https://app.test' }, addEventListener: (kind, fn) => handlers.set(kind, fn), skipWaiting: async () => { skipped++; }, clients: { claim: async () => {} } };
  vm.runInNewContext(code, { self, URL, caches, fetch, Response });
  return { data, caches, setOffline: () => { offline = true; }, setStalled: () => { stalled = true; }, networkReads: () => networkReads, skipped: () => skipped,
    async dispatch(kind, fields = {}) { let result; handlers.get(kind)({ ...fields, waitUntil(value) { result = value; }, respondWith(value) { result = value; } }); return result; },
  };
}
function request(path, mode = 'cors') { return { url: `https://app.test${path}`, method: 'GET', mode, headers: new Headers() }; }

test('first install precaches the shell and every manifest asset, including unopened explanation chunks', async () => {
  const h = harness(); await h.dispatch('install'); h.setOffline();
  assert.equal(await (await h.dispatch('fetch', { request: request('/', 'navigate') })).text(), 'cached:/');
  assert.equal(await (await h.dispatch('fetch', { request: request(asset) })).text(), `cached:${asset}`);
  assert.equal(h.skipped(), 0, 'an update must wait for user action');
  await h.dispatch('message', { data: { type: 'ACTIVATE_UPDATE' } }); assert.equal(h.skipped(), 1);
});
test('a missing chunk rejects installation and leaves the working release intact', async () => {
  const h = harness({ failAsset: true });
  const previous = await h.caches.open('vlk-402-release-previous'); await previous.put('/', new Response('old shell'));
  await assert.rejects(h.dispatch('install'), /missing chunk/);
  assert.equal(await (await previous.match('/')).text(), 'old shell'); assert.equal(h.data.has(name), false);
});
test('a deployment race cannot install a mismatched manifest', async () => {
  const h = harness({ version: 'b'.repeat(64) }); await assert.rejects(h.dispatch('install'), /does not match/); assert.equal(h.data.size, 0);
});
test('activation preserves unrelated caches and one previous release for existing tabs', async () => {
  const h = harness(); await h.caches.open('another-app'); await h.caches.open('vlk-402-shell-v2');
  const previous = await h.caches.open('vlk-402-shell-v4'); await previous.put('/assets/old.js', new Response('old chunk'));
  await h.dispatch('install'); await h.dispatch('activate');
  assert.equal(h.data.has('another-app'), true); assert.equal(h.data.has('vlk-402-shell-v2'), false); assert.equal(h.data.has('vlk-402-shell-v4'), true);
  h.setOffline(); assert.equal(await (await h.dispatch('fetch', { request: request('/assets/old.js') })).text(), 'old chunk');
});
test('online navigation never replaces the precached release HTML with another deployment', async () => {
  const h = harness(); await h.dispatch('install');
  assert.equal(await (await h.dispatch('fetch', { request: request('/', 'navigate') })).text(), 'cached:/');
  h.setOffline(); assert.equal(await (await h.dispatch('fetch', { request: request('/', 'navigate') })).text(), 'cached:/');
});
test('RSC, API, cross-origin and non-GET requests bypass the shell cache', async () => {
  const h = harness(); await h.dispatch('install');
  const cases = [request('/?_rsc=abc', 'navigate'), request('/api/chat'), request('/api/chat', 'navigate'), request('/signin-with-chatgpt', 'navigate'), { ...request('/'), method: 'POST' }, { ...request('/'), url: 'https://other.test/' }, { ...request('/', 'navigate'), headers: new Headers({ RSC: '1' }) }];
  for (const req of cases) assert.equal(await h.dispatch('fetch', { request: req }), undefined);
});

test('a stalled mobile connection cannot hold the cached application hostage', async () => {
  const h = harness(); await h.dispatch('install'); h.setStalled();
  const before = h.networkReads();
  let timer;
  try {
    const response = await Promise.race([
      h.dispatch('fetch', { request: request('/', 'navigate') }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Cached navigation waited for network')), 100); }),
    ]);
    assert.equal(await response.text(), 'cached:/');
    assert.equal(h.networkReads(), before);
  } finally { clearTimeout(timer); }
});

test('an evicted shell recovers online and returns a readable error offline', async () => {
  const h = harness();
  assert.equal(await (await h.dispatch('fetch', { request: request('/', 'navigate') })).text(), 'online');
  h.setOffline();
  const response = await h.dispatch('fetch', { request: request('/', 'navigate') });
  assert.equal(response.status, 503);
  assert.match(await response.text(), /Немає з’єднання/);
});

test('the production manifest includes every generated script, stylesheet and font', async () => {
  const { readdir } = await import('node:fs/promises');
  const base = new URL('../dist/client/assets/', import.meta.url);
  async function collect(directory, prefix = '/assets/') {
    const entries = await readdir(directory, { withFileTypes: true });
    const groups = await Promise.all(entries.map((entry) => entry.isDirectory()
      ? collect(new URL(`${entry.name}/`, directory), `${prefix}${entry.name}/`)
      : /\.(js|css|woff2?)$/.test(entry.name) ? [`${prefix}${entry.name}`] : []));
    return groups.flat();
  }
  const manifest = JSON.parse(await readFile(new URL('../dist/client/offline-manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual([...manifest.assets].sort(), (await collect(base)).sort());
  assert.match(manifest.version, /^[a-f0-9]{64}$/);
});
