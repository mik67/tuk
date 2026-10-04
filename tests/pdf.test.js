process.env.TZ = 'Europe/Prague';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { buildPdf } from '../public/js/pdf.js';
import { buildReport } from '../public/js/report.js';
import { PURPOSE } from '../public/js/cs.js';

const require = createRequire(import.meta.url);
const PDFLib = require('../public/js/vendor/pdf-lib.js');
const fontkit = require('../public/js/vendor/fontkit.js');
const fontBytes = fs.readFileSync(new URL('../public/fonts/NotoSans-Regular.ttf', import.meta.url));

const DAY = 864e5;
const NOW = Date.UTC(2026, 9, 4, 12, 0, 0);
let n = 0;
const ev = (o) => ({ id: 'e' + ++n, type: 'tuk', occurred_at: NOW - DAY, updated_at: 1, intensity: 2, triggers: [], note: '', deleted_at: null, ...o });

const make = (events, extra = {}) => buildPdf({ PDFLib, fontkit }, buildReport(events, { days: 30, now: NOW, ...extra }), fontBytes, PURPOSE);
const pages = async (bytes) => (await PDFLib.PDFDocument.load(bytes)).getPageCount();
function text(bytes) {
  const f = path.join(os.tmpdir(), `tuk-test-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  fs.writeFileSync(f, bytes);
  try { return execFileSync('pdftotext', ['-enc', 'UTF-8', f, '-'], { encoding: 'utf8' }); } catch { return null; } finally { fs.rmSync(f, { force: true }); }
}

test('vznikne platné PDF s jednou stránkou pro málo záznamů', async () => {
  const bytes = await make([ev({ triggers: ['stres'], note: 'ráno' })], { name: 'Eva' });
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), '%PDF-');
  assert.equal(await pages(bytes), 1);
});

test('prázdné období se vykreslí bez chyby (Review Focus 4)', async () => {
  const bytes = await make([]);
  assert.equal(await pages(bytes), 1);
  const t = text(bytes);
  if (t) assert.match(t, /Žádné záznamy/);
});

test('mnoho záznamů se rozdělí na více stránek', async () => {
  const many = Array.from({ length: 300 }, (_, i) => ev({ occurred_at: NOW - i * 3600e3, triggers: ['stres', 'horko'], note: 'poznámka ' + i }));
  assert.ok((await pages(await make(many))) > 3);
});

test('emoji, nové řádky, tabulátory a velmi dlouhé slovo nespadnou a nepřetečou (Review Focus 3)', async () => {
  const bytes = await make([
    ev({ note: 'emoji 🐣 a\nnový řádek\ttab' }),
    ev({ note: 'x'.repeat(900) }),
    ev({ triggers: ['velmidlouhýštítekbezmezer'.repeat(1)], note: '' }),
  ], { name: 'Ž'.repeat(60), medication: 'Lék 1-0-1\nDruhý řádek 🐣 ' + 'y'.repeat(400) });
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), '%PDF-');
});

test('česká diakritika včetně velkých písmen se do PDF dostane (pokud je dostupné pdftotext)', async () => {
  const bytes = await make([ev({ note: 'příliš žluťoučký kůň úpěl ďábelské ódy ĚŠČŘŽÝÁÍÉÚŮŤĎŇ' })], { name: 'Žofie Čápová' });
  const t = text(bytes);
  if (t === null) return;
  assert.match(t, /příliš žluťoučký kůň úpěl ďábelské ódy ĚŠČŘŽÝÁÍÉÚŮŤĎŇ/);
  assert.match(t, /Žofie Čápová/);
  assert.match(t, /souhrn záznamů/);
  assert.match(t, /myoklonie/);
  assert.match(t, /nepředpovídá/);
});

test('v PDF nejsou žádná porovnání ani průměry (spec §11.3)', async () => {
  const t = text(await make([ev({}), ev({ type: 'davka', dose_slot: 'morning' })]));
  if (t === null) return;
  assert.doesNotMatch(t, /průměr|Ø|porovnán|oproti|trend/i);
  assert.match(t, /Dny se zapsanou vynechanou dávkou: 1/);
});

test('znak mimo font (emoji) se nahradí jedním otazníkem, ne dvěma', async () => {
  const t = text(await make([ev({ note: 'a🐣b' })]));
  if (t === null) return;
  assert.match(t, /a\?b/);
  assert.doesNotMatch(t, /a\?\?b/);
});
