import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

function loadSw({ stored = new Map(), cacheNames = [], fetchImpl = async () => { throw new Error('offline'); } } = {}) {
  const handlers = {};
  const calls = { skipWaiting: 0, claim: 0, added: [], deleted: [], put: [], fetches: 0 };
  const cache = {
    addAll: async (list) => { calls.added.push(...list); },
    put: async (req) => { calls.put.push(req.url); },
  };
  const caches = {
    open: async () => cache,
    match: async (req) => {
      const url = typeof req === 'string' ? req : req.url;
      const p = new URL(url, 'http://localhost/').pathname.replace(/^\//, '') || 'index.html';
      return stored.get(p);
    },
    keys: async () => cacheNames,
    delete: async (k) => { calls.deleted.push(k); return true; },
  };
  const ctx = {
    self: { addEventListener: (t, fn) => { handlers[t] = fn; }, skipWaiting() { calls.skipWaiting++; }, clients: { claim() { calls.claim++; } } },
    caches, location: { origin: 'http://localhost' }, URL,
    Request: class { constructor(url, opts = {}) { this.url = url; this.cache = opts.cache; } },
    fetch: async (...a) => { calls.fetches++; return fetchImpl(...a); },
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { handlers, calls };
}
const res = (body, ok = true) => ({ ok, body, clone() { return this; } });
const fetchEv = (path, method = 'GET', origin = 'http://localhost') => ({
  request: { url: `${origin}/${path}`, method }, respondWith(p) { this.p = p; }, waitUntil(p) { this.w = p; },
});

test('install předcacheuje shell a NEvolá skipWaiting (Review Focus 6)', async () => {
  const { handlers, calls } = loadSw();
  const e = { waitUntil(p) { this.p = p; } };
  handlers.install(e);
  await e.p;
  const urls = calls.added.map((r) => r.url);
  assert.ok(urls.includes('index.html'));
  assert.ok(urls.includes('js/app.js'));
  assert.ok(urls.includes('fonts/NotoSans-Regular.ttf'));
  assert.ok(calls.added.every((r) => r.cache === 'reload'), 'předcache musí obejít HTTP cache, jinak se smíchají staré a nové soubory');
  assert.equal(calls.skipWaiting, 0);
});

test('všechny soubory ze SHELL skutečně existují', () => {
  const list = [...code.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => f !== './');
  const missing = list.filter((f) => !fs.existsSync(new URL('../public/' + f, import.meta.url)));
  assert.deepEqual(missing, []);
});

test('zpráva SKIP_WAITING volá skipWaiting, jiná zpráva ne', () => {
  const { handlers, calls } = loadSw();
  handlers.message({ data: 'SKIP_WAITING' });
  handlers.message({ data: 'cokoli' });
  assert.equal(calls.skipWaiting, 1);
});

test('activate smaže jen starší cache s prefixem tuk- a převezme klienty', async () => {
  const { handlers, calls } = loadSw({ cacheNames: ['tuk-0.9.0-abc1234', 'tuk-1.0.0-dev', 'cizi-cache'] });
  const e = { waitUntil(p) { this.p = p; } };
  handlers.activate(e);
  await e.p;
  assert.deepEqual(calls.deleted, ['tuk-0.9.0-abc1234']);
  assert.equal(calls.claim, 1);
});

test('cache-first: z cache bez sítě, i s ?query (Review Focus 6)', async () => {
  const cached = res('z cache');
  const { handlers, calls } = loadSw({ stored: new Map([['index.html', cached]]) });
  const e = fetchEv('index.html?pair=1');
  handlers.fetch(e);
  assert.equal(await e.p, cached);
  assert.equal(calls.fetches, 0);
});

test('mimo cache se použije síť a odpověď se uloží', async () => {
  const net = res('ze sítě');
  const { handlers, calls } = loadSw({ fetchImpl: async () => net });
  const e = fetchEv('neco.css');
  handlers.fetch(e);
  assert.equal(await e.p, net);
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(calls.put, ['http://localhost/neco.css']);
});

test('bez cache a bez sítě se vrátí index.html', async () => {
  const index = res('index');
  const { handlers } = loadSw({ stored: new Map([['index.html', index]]) });
  const e = fetchEv('neexistuje');
  handlers.fetch(e);
  assert.equal(await e.p, index);
});

test('cizí původ a ne-GET požadavky se nepřebírají', () => {
  const { handlers } = loadSw();
  const a = fetchEv('x.js', 'GET', 'https://cizi.example');
  const b = fetchEv('x.js', 'POST');
  handlers.fetch(a);
  handlers.fetch(b);
  assert.equal(a.p, undefined);
  assert.equal(b.p, undefined);
});

test('název cache obsahuje VERSION i BUILD a CI vkládá BUILD při každém nasazení (Review: žádné nasazení bez nové cache)', () => {
  assert.match(code, /const BUILD = 'dev';/);
  assert.match(code, /const CACHE = 'tuk-' \+ VERSION \+ '-' \+ BUILD;/);
  const yml = fs.readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  assert.match(yml, /sed -i .*const BUILD = .*public\/sw\.js/);
});

test('každý modul z public/js je v SHELL, jinak by aplikace offline nenaběhla', () => {
  const shell = [...code.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const mods = fs.readdirSync(new URL('../public/js/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);
  assert.deepEqual(mods.filter((m) => !shell.includes(m)), []);
});
