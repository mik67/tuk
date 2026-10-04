import test from 'node:test';
import assert from 'node:assert/strict';
import { bumpVersion, saveEvent, applyMerge } from '../public/js/repo.js';
import { mergeBackup } from '../public/js/backup.js';

const ID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ev = (o = {}) => ({ id: ID(1), type: 'tuk', occurred_at: 1_000, updated_at: 1_000, intensity: 2, note: '', triggers: [], series_id: ID(1), deleted_at: null, ...o });
const fakeStore = (failOnCall = 0) => {
  const m = new Map();
  let calls = 0;
  return {
    m,
    putEvent: async (e) => { calls++; if (failOnCall && calls === failOnCall) throw new Error('quota'); m.set(e.id, structuredClone(e)); },
    getEvent: async (id) => m.get(id),
  };
};

test('bumpVersion je vždy větší než předchozí verze', () => {
  assert.equal(bumpVersion({ updated_at: 5000 }, 1000), 5001);
  assert.equal(bumpVersion({}, 1000), 1000);
});

test('saveEvent: zapíše do úložiště i seznamu, vrátí novou kopii a původní objekt nezmění', async () => {
  const store = fakeStore();
  const list = [];
  const orig = ev();
  const saved = await saveEvent(store, list, orig);
  assert.equal(orig.updated_at, 1_000);
  assert.ok(saved.updated_at > 1_000);
  assert.equal(list.length, 1);
  assert.equal(list[0], saved);
  assert.equal(store.m.get(ID(1)).updated_at, saved.updated_at);
});

test('saveEvent: nahradí existující záznam podle id', async () => {
  const store = fakeStore();
  const list = [ev({ note: 'stará' })];
  await saveEvent(store, list, ev({ note: 'nová' }));
  assert.equal(list.length, 1);
  assert.equal(list[0].note, 'nová');
});

test('saveEvent: při chybě úložiště se seznam nezmění a chyba se předá (chyba nesmí nechat v paměti neuložené změny)', async () => {
  const store = fakeStore(1);
  const original = ev({ note: 'původní' });
  const list = [original];
  await assert.rejects(saveEvent(store, list, { ...original, note: 'neuloženo' }), /quota/);
  assert.equal(list[0], original);
  assert.equal(list[0].note, 'původní');
});

test('applyMerge zachová updated_at ze zálohy (obnova nesmí přepsat časy aktuálním časem)', async () => {
  const store = fakeStore();
  const list = [];
  await applyMerge(store, list, [ev({ updated_at: 300 })]);
  assert.equal(store.m.get(ID(1)).updated_at, 300);
  assert.equal(list[0].updated_at, 300);
});

test('obnova dvou záloh po sobě: starší a pak novější se smazaným záznamem → záznam zůstane smazaný (Review Focus 2)', async () => {
  const store = fakeStore();
  const list = [];
  const monday = { events: [ev({ updated_at: 100, deleted_at: null }), ev({ id: ID(2), updated_at: 100, note: 'a' })] };
  const wednesday = { events: [ev({ updated_at: 300, deleted_at: 300 }), ev({ id: ID(2), updated_at: 250, note: 'upraveno' })] };
  await applyMerge(store, list, mergeBackup(list, monday).put);
  const second = mergeBackup(list, wednesday);
  assert.equal(second.updated, 2);
  await applyMerge(store, list, second.put);
  assert.equal(list.find((e) => e.id === ID(1)).deleted_at, 300);
  assert.equal(list.find((e) => e.id === ID(2)).note, 'upraveno');
  assert.equal(mergeBackup(list, monday).put.length, 0);
});

test('applyMerge: při chybě uprostřed vyhodí chybu s počtem zapsaných záznamů', async () => {
  const store = fakeStore(2);
  const list = [];
  await assert.rejects(
    applyMerge(store, list, [ev({ id: ID(1) }), ev({ id: ID(2) }), ev({ id: ID(3) })]),
    (err) => err.message === 'quota' && err.written === 1
  );
  assert.equal(list.length, 1);
});
