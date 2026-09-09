const modes = new Set(['stand', 'walk', 'rest']);
const views = new Set(['home', 'roof', 'terrace', 'chassis', 'back']);
export const initialState = (reducedMotion = false) => ({ mode: 'stand', night: false, orbit: false, petals: !reducedMotion, view: 'home' });
export function transition(state, action, value) {
  if (action === 'mode' && modes.has(value)) return { ...state, mode: value };
  if (action === 'view' && views.has(value)) return { ...state, view: value };
  if (['night', 'orbit', 'petals'].includes(action)) return { ...state, [action]: !state[action] };
  return { ...state };
}
