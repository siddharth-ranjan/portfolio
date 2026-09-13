import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvictMachine } from '../src/hooks/evictPhase.js';

// Runs requests 1..count through the machine. `tapsBefore[n]` taps land just before
// request n starts; `tapsDuring[n]` taps land while request n is in flight.
function run(count, { tapsBefore = {}, tapsDuring = {} } = {}) {
  const m = createEvictMachine();
  const out = [];
  for (let n = 1; n <= count; n++) {
    const taps = [];
    for (let i = 0; i < (tapsBefore[n] || 0); i++) taps.push(m.tap());
    const { miss, forced } = m.start(n);
    for (let i = 0; i < (tapsDuring[n] || 0); i++) taps.push(m.tap());
    const cleared = m.finish(miss);
    out.push({ n, miss, forced, cleared, taps });
  }
  return out;
}
const misses = (rows) => rows.filter((r) => r.miss).map((r) => r.n);

test('the demo misses on schedule when nobody taps', () => {
  assert.deepEqual(misses(run(16)), [3, 9, 15]);
});

test('the scheduled miss restarts its count after an eviction', () => {
  // evicted at request 2, so the next scheduled miss is six requests later (8), not at 3
  assert.deepEqual(misses(run(12, { tapsBefore: { 2: 1 } })), [2, 8]);
});

test('one tap: exactly one miss, then a hit that brings the hint back', () => {
  const rows = run(4, { tapsBefore: { 1: 1 } });
  assert.deepEqual(misses(rows), [1]);
  assert.equal(rows[0].forced, true);
  assert.equal(rows[1].cleared, true);
});

test('taps while the forced miss is in flight are ignored (the phone double tap)', () => {
  const rows = run(5, { tapsBefore: { 1: 1 }, tapsDuring: { 1: 2 } });
  assert.deepEqual(rows[0].taps, ['ok', 'busy', 'busy']);
  assert.deepEqual(misses(rows), [1]);
});

test('a second tap before the request starts is ignored too', () => {
  const rows = run(4, { tapsBefore: { 1: 2 } });
  assert.deepEqual(rows[0].taps, ['ok', 'pending']);
  assert.deepEqual(misses(rows), [1]);
});

test('a scheduled miss right after an eviction is skipped, so it never reads as three misses', () => {
  // tap before request 2: forced miss on 2, and request 3 (scheduled miss) must be the closing hit
  const rows = run(6, { tapsBefore: { 2: 1 }, tapsDuring: { 2: 2 } });
  assert.deepEqual(misses(rows), [2]);
  assert.equal(rows[2].cleared, true);
});

test('after the hint is back, the next tap works again', () => {
  const rows = run(8, { tapsBefore: { 1: 1, 4: 1 } });
  assert.deepEqual(rows[3].taps, ['ok']);
  assert.deepEqual(misses(rows), [1, 4]);
});
