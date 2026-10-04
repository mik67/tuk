process.env.TZ = 'Europe/Prague';
import test from 'node:test';
import assert from 'node:assert/strict';
import { lostDataStatus, FORMAT, VERSION, normalizeEvent, buildBackup, parseBackup, mergeBackup, backupDue, backupFilename } from '../public/js/backup.js';

const ID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ev = (o = {}) => ({ id: ID(1), type: 'tuk', occurred_at: 1_000, updated_at: 1_000, intensity: 2, note: '', triggers: [], series_id: ID(1), deleted_at: null, ...o });
const DAY = 864e5;

test('normalizeEvent: platná událost projde a dostane jen známá pole', () => {
  const n = normalizeEvent({ ...ev(), dirty: 1, cizi: 'x' });
  assert.equal(n.id, ID(1));
  assert.equal('dirty' in n, false);
  assert.equal('cizi' in n, false);
  assert.equal(n.rescue_given, null);
  assert.equal(n.dose_slot, null);
});

test('normalizeEvent: neplatné vstupy → null (Review Focus 1)', () => {
  const bad = [
    null, 5, 'x', {}, ev({ id: 'neni-uuid' }), ev({ type: 'jine' }), ev({ occurred_at: 0 }), ev({ updated_at: 'x' }),
    ev({ intensity: 5 }), ev({ duration_min: 9999 }), ev({ note: 'x'.repeat(1001) }), ev({ triggers: 'stres' }),
    ev({ triggers: Array(21).fill('a') }), ev({ triggers: [''] }), ev({ series_id: 'x' }), ev({ rescue_given: 'ano' }),
    ev({ dose_slot: 'noon' }), ev({ deleted_at: -1 }),
  ];
  for (const b of bad) assert.equal(normalizeEvent(b), null, JSON.stringify(b)?.slice(0, 60));
});

test('buildBackup a parseBackup: round trip a vynechání neplatných událostí', () => {
  const b = buildBackup([ev(), { id: 'x' }], { name: 'Eva' }, 1234);
  assert.equal(b.format, FORMAT);
  assert.equal(b.version, VERSION);
  assert.equal(b.exported_at, 1234);
  assert.equal(b.events.length, 1);
  assert.equal(b.settings.name, 'Eva');
  const p = parseBackup(JSON.stringify(b));
  assert.equal(p.ok, true);
  assert.equal(p.backup.events.length, 1);
});

test('parseBackup: poškozený, cizí, novější a prázdný soubor (Review Focus 1)', () => {
  assert.equal(parseBackup('{není json').ok, false);
  assert.equal(parseBackup('').ok, false);
  assert.equal(parseBackup(null).ok, false);
  assert.match(parseBackup('{"format":"jiny","version":1,"events":[]}').error, /není záloha aplikace Ťuk/);
  assert.match(parseBackup(JSON.stringify({ format: FORMAT, version: 99, events: [] })).error, /novější verze/);
  assert.equal(parseBackup(JSON.stringify({ format: FORMAT, version: 1 })).ok, false);
  assert.equal(parseBackup(JSON.stringify({ format: FORMAT, version: 1.5, events: [] })).ok, false);
  assert.equal(parseBackup('x'.repeat(21_000_000)).ok, false);
});

test('mergeBackup: přidá nové, novější přepíše, starší a stejné přeskočí (Review Focus 2)', () => {
  const local = [ev({ id: ID(1), updated_at: 5000, note: 'lokální' }), ev({ id: ID(2), updated_at: 1000 })];
  const backup = { events: [
    ev({ id: ID(1), updated_at: 4000, note: 'starší záloha' }),   // starší → přeskočit
    ev({ id: ID(2), updated_at: 3000, note: 'novější záloha' }),  // novější → update
    ev({ id: ID(3), updated_at: 100 }),                           // nové → add
    { id: 'rozbité' },                                            // neplatné
  ] };
  const r = mergeBackup(local, backup);
  assert.deepEqual({ a: r.added, u: r.updated, s: r.skipped, i: r.invalid }, { a: 1, u: 1, s: 1, i: 1 });
  assert.deepEqual(r.put.map((e) => e.id).sort(), [ID(2), ID(3)].sort());
  assert.equal(r.put.find((e) => e.id === ID(2)).note, 'novější záloha');
});

test('mergeBackup: smazání (tombstone) z novější zálohy se uplatní, starší tombstone záznam neoživí (Review Focus 2)', () => {
  const local = [ev({ id: ID(1), updated_at: 2000, deleted_at: null })];
  const newer = mergeBackup(local, { events: [ev({ id: ID(1), updated_at: 3000, deleted_at: 3000 })] });
  assert.equal(newer.put[0].deleted_at, 3000);
  const localDeleted = [ev({ id: ID(1), updated_at: 3000, deleted_at: 3000 })];
  const older = mergeBackup(localDeleted, { events: [ev({ id: ID(1), updated_at: 2000, deleted_at: null })] });
  assert.equal(older.put.length, 0);
  assert.equal(older.skipped, 1);
});

test('mergeBackup: škodlivé klíče a prototypy nic nezpůsobí', () => {
  const evil = JSON.parse(`{"events":[{"id":"${ID(9)}","type":"tuk","occurred_at":5,"updated_at":5,"__proto__":{"polluted":true},"constructor":"x"}]}`);
  const r = mergeBackup([], evil);
  assert.equal(r.added, 1);
  assert.equal(({}).polluted, undefined);
  assert.equal('constructor' in r.put[0] && Object.hasOwn(r.put[0], 'constructor'), false);
});

test('backupDue: bez dat nikdy; bez zálohy po 7 dnech; po 30 dnech; po 50 změnách', () => {
  const now = 100 * DAY;
  assert.equal(backupDue({ events: [], lastBackupAt: null, now }), false);
  assert.equal(backupDue({ events: [ev({ occurred_at: now - 2 * DAY })], lastBackupAt: null, now }), false);
  assert.equal(backupDue({ events: [ev({ occurred_at: now - 8 * DAY })], lastBackupAt: null, now }), true);
  const e = ev({ occurred_at: now - 40 * DAY, updated_at: now - 40 * DAY });
  assert.equal(backupDue({ events: [e], lastBackupAt: now - 29 * DAY, now }), false);
  assert.equal(backupDue({ events: [e], lastBackupAt: now - 31 * DAY, now }), true);
  const many = Array.from({ length: 50 }, (_, i) => ev({ id: ID(i + 10), occurred_at: now - DAY, updated_at: now - 1000 }));
  assert.equal(backupDue({ events: many, lastBackupAt: now - 2000, now }), true);
  const deletedOnly = [ev({ occurred_at: now - 90 * DAY, deleted_at: 5 })];
  assert.equal(backupDue({ events: deletedOnly, lastBackupAt: null, now }), false);
});

test('backupFilename', () => {
  assert.equal(backupFilename(Date.UTC(2026, 9, 4, 10)), 'tuk-zaloha-2026-10-04.json');
});

test('lostDataStatus: panel „Data zmizela“ přetrvá i po prvním novém záznamu (Review Focus 5)', () => {
  assert.equal(lostDataStatus({ hadData: false, eventCount: 0, flag: false }), false);
  assert.equal(lostDataStatus({ hadData: true, eventCount: 3, flag: false }), false);
  assert.equal(lostDataStatus({ hadData: true, eventCount: 0, flag: false }), true);
  assert.equal(lostDataStatus({ hadData: true, eventCount: 1, flag: true }), true);
});
