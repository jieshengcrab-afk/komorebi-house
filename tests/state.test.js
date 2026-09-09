import test from 'node:test';
import assert from 'node:assert/strict';

test('view state starts still and updates only supported controls', async () => {
  const { initialState, transition } = await import('../src/state.js');
  assert.deepEqual(initialState(false), { mode: 'stand', night: false, orbit: false, petals: true, view: 'home' });
  const state = initialState(false);
  assert.equal(transition(state, 'mode', 'walk').mode, 'walk');
  assert.equal(transition(state, 'mode', 'bad').mode, 'stand');
  assert.equal(transition(state, 'night').night, true);
  assert.equal(state.night, false, 'does not mutate input');
  assert.equal(transition(state, 'view', 'roof').view, 'roof');
  assert.equal(transition(state, 'view', 'missing').view, 'home');
  assert.equal(initialState(true).petals, false, 'reduced motion defaults to no petals');
});
