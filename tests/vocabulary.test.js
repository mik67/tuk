import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PURPOSE, PRIVACY, INSTALL } from '../public/js/cs.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const FORBIDDEN = /zaskub|zachvat|epilep|monitor|sledov|riziko|rizik|predik|lecb|terapi|spoustec|diagnoz/i;

function scannedFiles() {
  const out = [path.join(root, 'README.md'), path.join(root, 'public/index.html'), path.join(root, 'public/manifest.webmanifest')];
  const js = path.join(root, 'public/js');
  for (const f of fs.readdirSync(js)) {
    const p = path.join(js, f);
    if (fs.statSync(p).isFile() && f.endsWith('.js')) out.push(p);
  }
  return out.filter((p) => fs.existsSync(p));
}

test('veřejné texty neobsahují zakázaná slova ani v podobě bez diakritiky (spec §11.3)', () => {
  const bad = [];
  for (const f of scannedFiles()) {
    const text = strip(fs.readFileSync(f, 'utf8'));
    const m = text.match(FORBIDDEN);
    if (m) bad.push(`${path.relative(root, f)}: „${m[0]}“`);
  }
  assert.deepEqual(bad, []);
});

test('prohlášení o účelu obsahuje klíčové věty', () => {
  assert.match(PURPOSE, /osobní deník/);
  assert.match(PURPOSE, /Nehodnotí, nediagnostikuje, nepředpovídá, nedává doporučení a nenahrazuje lékaře/);
  assert.match(PURPOSE, /Není zdravotnickým prostředkem/);
  assert.match(PURPOSE, /112 nebo 155/);
});

test('soukromí říká, že data zůstávají v telefonu, a zmiňuje hosting', () => {
  assert.match(PRIVACY, /jen v tomto telefonu/);
  assert.match(PRIVACY, /IP adres/);
});

test('instalační návody existují pro všechny režimy a mají kroky nebo tlačítko', () => {
  for (const k of ['prompt', 'ios-safari', 'ios-other', 'android-manual', 'desktop', 'installed']) {
    assert.ok(INSTALL[k], `chybí režim ${k}`);
    assert.equal(typeof INSTALL[k].title, 'string');
    assert.ok(Array.isArray(INSTALL[k].steps));
  }
  assert.ok(INSTALL['ios-safari'].steps.length >= 3);
  assert.ok(INSTALL.prompt.button);
});

test('version.js a sw.js mají stejnou verzi (pokud sw.js už existuje)', () => {
  const swPath = path.join(root, 'public/sw.js');
  if (!fs.existsSync(swPath)) return;
  const sw = fs.readFileSync(swPath, 'utf8').match(/const VERSION = '([^']+)'/)[1];
  const v = fs.readFileSync(path.join(root, 'public/js/version.js'), 'utf8').match(/VERSION = '([^']+)'/)[1];
  assert.equal(sw, v);
});
