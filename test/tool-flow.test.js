import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runToolCalls } from '../src/live/tool-flow.js';
import { nextPhase } from '../src/live/phase.js';
import { createTellState } from '../shared/talk-state.js';

test('several calls in one message: one response per call, same id + name, in order', () => {
  const s = createTellState({ stage: 'pregnant' });
  const calls = [
    { id: 'a1', name: 'record_symptom', args: { sign: 'severe_headache', her_words: 'sir dard' } },
    { id: 'a2', name: 'record_symptom', args: { sign: 'swelling_feet', her_words: 'pair suje' } },
    { id: 'a3', name: 'record_symptom', args: { sign: 'severe_headache', her_words: 'sir dard, subah se' } },
    { id: 'a4', name: 'finish_talk', args: {} },
  ];
  const { events, functionResponses } = runToolCalls(s, calls);
  assert.deepEqual(functionResponses.map((r) => [r.id, r.name]), calls.map((c) => [c.id, c.name]));
  for (const r of functionResponses) assert.equal(r.scheduling, undefined);
  // one "noted" event with the deduped list, before the finish
  assert.deepEqual(events.map((e) => e.type), ['noted', 'finish']);
  assert.deepEqual(events[0].signs, ['severe_headache', 'swelling_feet']);
  assert.equal(events[0].symptoms[0].her_words, 'sir dard, subah se');
  assert.equal(events[1].by, 'model');
});

test('unknown tool still gets a response; no events', () => {
  const s = createTellState({ stage: 'postnatal' });
  const { events, functionResponses } = runToolCalls(s, [{ id: 'z', name: 'ask_yes_no', args: { question: 'q' } }]);
  assert.equal(functionResponses.length, 1);
  assert.ok(functionResponses[0].response.error);
  assert.deepEqual(events, []);
});

test('a call without a name is skipped; null calls are fine', () => {
  const s = createTellState({ stage: 'pregnant' });
  assert.deepEqual(runToolCalls(s, [{ id: 'x' }]).functionResponses, []);
  assert.deepEqual(runToolCalls(s, null).functionResponses, []);
});

test('phases: tap → mic → connecting → listening ⇄ speaking → wrapping → heard', () => {
  let p = 'idle';
  const step = (e) => (p = nextPhase(p, e));
  step({ type: 'begin' });
  assert.equal(p, 'mic');
  step({ type: 'status', status: 'connecting' });
  assert.equal(p, 'connecting');
  step({ type: 'status', status: 'live' });
  assert.equal(p, 'listening');
  step({ type: 'speaking', on: true });
  assert.equal(p, 'speaking');
  step({ type: 'speaking', on: false });
  assert.equal(p, 'listening');
  step({ type: 'status', status: 'wrapping' });
  step({ type: 'speaking', on: true });
  step({ type: 'status', status: 'live' });
  assert.equal(p, 'wrapping');
  step({ type: 'finish', by: 'stop' });
  assert.equal(p, 'heard');
  // nothing moves her off Heard
  step({ type: 'status', status: 'failed' });
  assert.equal(p, 'heard');
  // "Say it again"
  step({ type: 'begin' });
  assert.equal(p, 'mic');
});

test('phases: reconnect comes back to listening; failure is shown and a new tap restarts', () => {
  let p = nextPhase('speaking', { type: 'status', status: 'reconnecting' });
  assert.equal(p, 'reconnecting');
  assert.equal(nextPhase(p, { type: 'speaking', on: true }), 'reconnecting');
  assert.equal(nextPhase(p, { type: 'status', status: 'connecting' }), 'reconnecting');
  assert.equal(nextPhase(p, { type: 'status', status: 'live' }), 'listening');
  p = nextPhase('connecting', { type: 'status', status: 'failed', reason: 'no-key' });
  assert.equal(p, 'failed');
  assert.equal(nextPhase(p, { type: 'status', status: 'live' }), 'failed');
  assert.equal(nextPhase(p, { type: 'begin' }), 'mic');
  // finish_talk from the model goes straight to Heard
  assert.equal(nextPhase('listening', { type: 'finish', by: 'model' }), 'heard');
});
