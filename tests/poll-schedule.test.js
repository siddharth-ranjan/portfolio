import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextPoll, POLL_MS, SLOW_POLL_MS, SLOW_AFTER_MS, STOP_AFTER_MS
} from '../src/chess/pollSchedule.js';

const NOW = 1_800_000_000_000;
const MIN = 60_000;
const at = (inputAgo, changeAgo = inputAgo, extra = {}) =>
  nextPoll({ first: false, visible: true, lastInput: NOW - inputAgo, lastChange: NOW - changeAgo, now: NOW, ...extra });

test('the first load always happens, even in a background tab', () => {
  assert.deepEqual(nextPoll({ first: true, visible: false, lastInput: 0, lastChange: 0, now: NOW }), { poll: true, delay: POLL_MS, asleep: false });
});

test('a hidden tab never polls', () => {
  assert.equal(at(1000, 1000, { visible: false }).poll, false);
});

test('while someone is using the page it polls every second', () => {
  assert.deepEqual(at(10_000), { poll: true, delay: POLL_MS, asleep: false });
});

test('no input for a while, but moves still coming in: stays fast', () => {
  assert.deepEqual(at(SLOW_AFTER_MS + MIN, 20_000), { poll: true, delay: POLL_MS, asleep: false });
});

test('no input and no moves for five minutes: slows to every five seconds', () => {
  assert.deepEqual(at(SLOW_AFTER_MS + 1000), { poll: true, delay: SLOW_POLL_MS, asleep: false });
});

test('no input for ten minutes: stops, even if other people keep moving', () => {
  assert.deepEqual(at(STOP_AFTER_MS + 1000), { poll: false, delay: 5000, asleep: true });
  assert.equal(at(STOP_AFTER_MS + 1000, 2000).poll, false);
});
