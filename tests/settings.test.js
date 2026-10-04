import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalizeSettings, loadSettings, saveSettings } from '../public/js/settings.js';

const fakeStore = () => {
  const m = new Map();
  return { getMeta: async (k) => m.get(k), setMeta: async (k, v) => { m.set(k, structuredClone(v)); }, m };
};

test('výchozí hodnoty pro prázdný nebo cizí vstup', () => {
  for (const raw of [undefined, null, 5, 'x', []]) {
    assert.deepEqual(normalizeSettings(raw), { ...DEFAULTS, triggers: [...DEFAULTS.triggers], default_triggers: [] });
  }
});

test('intenzita a délka série mimo rozsah nebo ne-celá čísla → výchozí', () => {
  assert.equal(normalizeSettings({ default_intensity: 5 }).default_intensity, 2);
  assert.equal(normalizeSettings({ default_intensity: '3' }).default_intensity, 2);
  assert.equal(normalizeSettings({ default_intensity: 3 }).default_intensity, 3);
  assert.equal(normalizeSettings({ series_minutes: 2 }).series_minutes, 60);
  assert.equal(normalizeSettings({ series_minutes: 500 }).series_minutes, 60);
  assert.equal(normalizeSettings({ series_minutes: 90 }).series_minutes, 90);
});

test('jméno a medikace se ořežou na limit a trimují', () => {
  const s = normalizeSettings({ name: '  ' + 'a'.repeat(100) + '  ', medication: 'm'.repeat(900) });
  assert.equal(s.name.length, 60);
  assert.equal(s.medication.length, 500);
  assert.equal(normalizeSettings({ name: 5 }).name, '');
});

test('štítky: ne-řetězce a prázdné pryč, duplicity bez ohledu na velikost, max 12 po 40 znacích', () => {
  const s = normalizeSettings({ triggers: ['Stres', 'stres', ' horko ', 5, '', 'x'.repeat(80)] });
  assert.deepEqual(s.triggers, ['Stres', 'horko', 'x'.repeat(40)]);
  const many = normalizeSettings({ triggers: Array.from({ length: 30 }, (_, i) => 't' + i) });
  assert.equal(many.triggers.length, 12);
});

test('prázdný seznam štítků je povolen (uživatel je všechny odebral)', () => {
  assert.deepEqual(normalizeSettings({ triggers: [] }).triggers, []);
});

test('předvybrané štítky jsou jen podmnožina existujících', () => {
  const s = normalizeSettings({ triggers: ['a', 'b'], default_triggers: ['b', 'zmizelý', 7] });
  assert.deepEqual(s.default_triggers, ['b']);
});

test('škodlivé klíče se neprosadí', () => {
  const s = normalizeSettings(JSON.parse('{"__proto__":{"x":1},"constructor":"y","name":"Ok"}'));
  assert.equal(s.name, 'Ok');
  assert.equal(({}).x, undefined);
  assert.deepEqual(Object.keys(s).sort(), Object.keys(DEFAULTS).sort());
});

test('load/save: výchozí, uložení a sloučení částečné změny', async () => {
  const st = fakeStore();
  assert.equal((await loadSettings(st)).default_intensity, 2);
  const a = await saveSettings(st, { default_intensity: 3 });
  assert.equal(a.default_intensity, 3);
  const b = await saveSettings(st, { name: 'Eva' });
  assert.equal(b.name, 'Eva');
  assert.equal(b.default_intensity, 3);
  assert.equal((await loadSettings(st)).name, 'Eva');
});
