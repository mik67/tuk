process.env.TZ = 'Europe/Prague';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, fmtDate, fmtTime } from '../public/js/report.js';

const DAY = 864e5;
const NOW = Date.UTC(2026, 9, 4, 12, 0, 0);
let n = 0;
const ev = (o) => ({ id: 'e' + ++n, type: 'tuk', occurred_at: NOW - DAY, updated_at: 1, intensity: 2, triggers: [], note: '', deleted_at: null, ...o });

test('tvar výstupu je pevný: žádná porovnání, průměry ani trendy (spec §11.3)', () => {
  const r = buildReport([], { days: 30, now: NOW });
  assert.deepEqual(Object.keys(r).sort(), ['days', 'from', 'generatedAt', 'labels', 'medication', 'missedDoseDays', 'name', 'rows', 'to', 'totals', 'weeks', 'weeksCapped'].sort());
  assert.deepEqual(Object.keys(r.totals).sort(), ['davka', 'tuk', 'velka']);
});

test('prázdná data → nuly a prázdné seznamy, žádná chyba (Review Focus 4)', () => {
  const r = buildReport([], { days: 30, now: NOW });
  assert.deepEqual(r.totals, { tuk: 0, velka: 0, davka: 0 });
  assert.equal(r.rows.length, 0);
  assert.equal(r.labels.length, 0);
  assert.equal(r.missedDoseDays, 0);
  assert.equal(r.weeks.length, 5);
  assert.ok(r.weeks.every((w) => w.tuk === 0));
});

test('počty podle typu, smazané a mimo období se nepočítají', () => {
  const r = buildReport([
    ev({}), ev({}), ev({ type: 'velka' }), ev({ type: 'davka', dose_slot: 'morning' }),
    ev({ deleted_at: 5 }), ev({ occurred_at: NOW - 60 * DAY }),
  ], { days: 30, now: NOW });
  assert.deepEqual(r.totals, { tuk: 2, velka: 1, davka: 1 });
  assert.equal(r.rows.length, 4);
});

test('týdny: součet odpovídá počtu ťuků, nejstarší první, poslední týden obsahuje „teď“', () => {
  const r = buildReport([ev({ occurred_at: NOW }), ev({ occurred_at: NOW - 8 * DAY }), ev({ occurred_at: NOW - 15 * DAY })], { days: 28, now: NOW });
  assert.equal(r.weeks.length, 4);
  assert.equal(r.weeks.reduce((s, w) => s + w.tuk, 0), 3);
  assert.equal(r.weeks[3].tuk, 1);
  assert.equal(r.weeksCapped, false);
});

test('týdny: nejvýše 13 a příznak weeksCapped u dlouhého období', () => {
  const r = buildReport([], { days: 365, now: NOW });
  assert.equal(r.weeks.length, 13);
  assert.equal(r.weeksCapped, true);
});

test('štítky: četnost jen u ťuků, sestupně, pak abecedně', () => {
  const r = buildReport([
    ev({ triggers: ['stres', 'horko'] }), ev({ triggers: ['stres'] }), ev({ triggers: ['alkohol'] }),
    ev({ type: 'velka', triggers: ['stres'] }),
  ], { days: 30, now: NOW });
  assert.deepEqual(r.labels, [{ label: 'stres', count: 2 }, { label: 'alkohol', count: 1 }, { label: 'horko', count: 1 }]);
});

test('dny se zapsanou dávkou: různé dny, ne počet záznamů', () => {
  const d1 = Date.UTC(2026, 9, 1, 7);
  const r = buildReport([ev({ type: 'davka', occurred_at: d1 }), ev({ type: 'davka', occurred_at: d1 + 3600e3 }), ev({ type: 'davka', occurred_at: d1 + 2 * DAY })], { days: 30, now: NOW });
  assert.equal(r.missedDoseDays, 2);
});

test('řádky: chronologicky, odborné termíny, formát data a času', () => {
  const t = Date.UTC(2026, 9, 3, 5, 7);
  const r = buildReport([
    ev({ type: 'velka', occurred_at: t + 1000, intensity: null, duration_min: 5, rescue_given: true }),
    ev({ occurred_at: t, triggers: ['stres', 'horko'], note: 'ráno' }),
    ev({ type: 'davka', occurred_at: t + 2000, intensity: null, dose_slot: 'evening' }),
  ], { days: 30, now: NOW });
  assert.deepEqual(r.rows.map((x) => x.type), ['myoklonie', 'GTCS', 'vynechaná/opožděná dávka']);
  assert.equal(r.rows[0].date, '03.10.2026');
  assert.equal(r.rows[0].time, '07:07');
  assert.equal(r.rows[0].labels, 'stres; horko');
  assert.equal(r.rows[1].rescue, 'ano');
  assert.equal(r.rows[1].duration, 5);
  assert.equal(r.rows[2].slot, 'večer');
});

test('jméno a medikace se přenesou, fmtDate/fmtTime jsou lokální', () => {
  const r = buildReport([], { days: 30, now: NOW, name: 'Eva', medication: 'Lék A 1-0-1' });
  assert.equal(r.name, 'Eva');
  assert.equal(r.medication, 'Lék A 1-0-1');
  assert.equal(fmtDate(Date.UTC(2026, 0, 2, 12)), '02.01.2026');
  assert.equal(fmtTime(Date.UTC(2026, 0, 2, 12)), '13:00');
});
