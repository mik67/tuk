process.env.TZ = 'Europe/Prague';
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCsv } from '../public/js/csv.js';

const DAY = 864e5;
const NOW = Date.UTC(2026, 9, 4, 12, 0, 0);
const ev = (o) => ({ id: 'x', type: 'tuk', occurred_at: NOW - DAY, intensity: 2, triggers: [], note: '', deleted_at: null, ...o });

test('hlavička, BOM a středníky', () => {
  const csv = buildCsv([], 30, NOW);
  assert.equal(csv, '﻿"datum";"cas";"typ";"intenzita";"co_predchazelo";"delka_min";"zachranny_lek";"davka";"poznamka"');
});
test('ťuk se exportuje jako myoklonie s lokálním datem a časem', () => {
  const t = Date.UTC(2026, 9, 3, 5, 7, 0);
  const lines = buildCsv([ev({ occurred_at: t, triggers: ['stres', 'málo spánku'], note: 'ráno' })], 30, NOW).split('\r\n');
  assert.equal(lines[1], '"03.10.2026";"07:07";"myoklonie";"2";"stres; málo spánku";"";"";"";"ráno"');
});
test('velká událost a dávka používají odborné termíny', () => {
  const rows = buildCsv([
    ev({ id: 'v', type: 'velka', intensity: null, duration_min: 5, rescue_given: true, occurred_at: NOW - 2 * DAY }),
    ev({ id: 'd', type: 'davka', intensity: null, dose_slot: 'morning', occurred_at: NOW - 3 * DAY }),
  ], 30, NOW);
  assert.match(rows, /"GTCS";"";"";"5";"ano";""/);
  assert.match(rows, /"vynechaná\/opožděná dávka";"";"";"";"";"ráno"/);
});
test('filtruje podle období, vynechává smazané a řadí chronologicky', () => {
  const rows = buildCsv([
    ev({ id: '1', occurred_at: NOW - 40 * DAY }),
    ev({ id: '2', occurred_at: NOW - 2 * DAY, note: 'novější' }),
    ev({ id: '3', occurred_at: NOW - 5 * DAY, note: 'starší' }),
    ev({ id: '4', occurred_at: NOW - 1 * DAY, deleted_at: 1 }),
  ], 30, NOW).split('\r\n');
  assert.equal(rows.length, 3);
  assert.match(rows[1], /starší/);
  assert.match(rows[2], /novější/);
});
test('uvozovky se zdvojují', () => {
  assert.match(buildCsv([ev({ note: 'řekl "ahoj"' })], 30, NOW), /"řekl ""ahoj"""/);
});
test('poznámka začínající = + - @ se nevykoná jako vzorec (Review Focus 4)', () => {
  for (const bad of ['=1+1', '+cmd', '-2', '@SUM(A1)']) {
    const csv = buildCsv([ev({ note: bad })], 30, NOW);
    assert.ok(csv.includes(`"'${bad}"`), `chybí escapovaná podoba pro ${bad}`);
  }
});
