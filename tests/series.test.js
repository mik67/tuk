import test from 'node:test';
import assert from 'node:assert/strict';
import { seriesIdFor, isDuplicateTap } from '../public/js/series.js';

const prev = { id: 'a', series_id: 'a', occurred_at: 1_000_000 };

test('první ťuk začíná novou sérii', () => {
  assert.equal(seriesIdFor(undefined, 5_000_000, 60, 'new'), 'new');
});
test('ťuk do N minut po předchozím patří do jeho série', () => {
  assert.equal(seriesIdFor(prev, 1_000_000 + 59 * 60000, 60, 'new'), 'a');
});
test('ťuk po N minutách začíná novou sérii', () => {
  assert.equal(seriesIdFor(prev, 1_000_000 + 60 * 60000, 60, 'new'), 'new');
});
test('hodiny jdou zpět: čas před předchozím ťukem sérii nesloučí (Review Focus 5)', () => {
  assert.equal(seriesIdFor(prev, 999_000, 60, 'new'), 'new');
});
test('předchozí ťuk bez series_id nevytvoří sérii', () => {
  assert.equal(seriesIdFor({ id: 'b', series_id: null, occurred_at: 1_000_000 }, 1_001_000, 60, 'new'), 'new');
});
test('dvojklik do 1 s je duplicita (Review Focus 5)', () => {
  assert.equal(isDuplicateTap(10_000, 10_500), true);
  assert.equal(isDuplicateTap(10_000, 11_000), false);
  assert.equal(isDuplicateTap(0, 500), false);
  assert.equal(isDuplicateTap(10_000, 9_000), false);
});
