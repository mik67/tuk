import test from 'node:test';
import assert from 'node:assert/strict';
import { addTrigger, removeTrigger, pruneDefaults, MAX_TRIGGERS } from '../public/js/triggers.js';

test('přidá nový štítek a ořízne mezery', () => {
  assert.deepEqual(addTrigger(['stres'], '  horko '), ['stres', 'horko']);
});
test('prázdný štítek se ignoruje', () => {
  assert.deepEqual(addTrigger(['stres'], '   '), ['stres']);
});
test('duplicitu bez ohledu na velikost písmen nepřidá', () => {
  assert.deepEqual(addTrigger(['Stres'], 'stres'), ['Stres']);
});
test('štítek se ořízne na 40 znaků', () => {
  assert.equal(addTrigger([], 'x'.repeat(60))[0].length, 40);
});
test('nepřekročí maximální počet štítků', () => {
  const full = Array.from({ length: MAX_TRIGGERS }, (_, i) => 't' + i);
  assert.equal(addTrigger(full, 'další').length, MAX_TRIGGERS);
});
test('odebrání štítku a vyčištění předvybraných', () => {
  const list = removeTrigger(['a', 'b', 'c'], 'b');
  assert.deepEqual(list, ['a', 'c']);
  assert.deepEqual(pruneDefaults(['b', 'c'], list), ['c']);
});
