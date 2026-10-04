import test from 'node:test';
import assert from 'node:assert/strict';
import { shareFiles } from '../public/js/share.js';

const files = [{ name: 'a.pdf' }, { name: 'b.csv' }];

test('sdílení podporováno → shared a nic se nestahuje', async () => {
  const dl = [];
  const nav = { canShare: () => true, share: async () => {} };
  assert.equal(await shareFiles({ files, title: 't' }, nav, (f) => dl.push(f)), 'shared');
  assert.equal(dl.length, 0);
});

test('canShare nepodporuje soubory → stažení všech souborů (Review Focus 7)', async () => {
  const dl = [];
  const nav = { canShare: () => false, share: async () => { throw new Error('nemělo se volat'); } };
  assert.equal(await shareFiles({ files }, nav, (f) => dl.push(f.name)), 'downloaded');
  assert.deepEqual(dl, ['a.pdf', 'b.csv']);
});

test('chybí navigator.share → stažení', async () => {
  const dl = [];
  assert.equal(await shareFiles({ files }, {}, (f) => dl.push(f.name)), 'downloaded');
  assert.equal(dl.length, 2);
});

test('uživatel sdílení zruší (AbortError) → cancelled, nic se nestahuje (Review Focus 7)', async () => {
  const dl = [];
  const nav = { canShare: () => true, share: async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; } };
  assert.equal(await shareFiles({ files }, nav, (f) => dl.push(f)), 'cancelled');
  assert.equal(dl.length, 0);
});

test('jiná chyba sdílení → fallback na stažení', async () => {
  const dl = [];
  const nav = { canShare: () => true, share: async () => { throw new Error('NotAllowedError'); } };
  assert.equal(await shareFiles({ files }, nav, (f) => dl.push(f)), 'downloaded');
  assert.equal(dl.length, 2);
});
