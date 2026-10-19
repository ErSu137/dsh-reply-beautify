const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize, parsePreferences, createPreferences, STORAGE_KEY, replyCSS } = require('../src/core.cjs');

test('corrupt and future saved preferences recover to usable defaults', () => {
  for (const raw of ['not json', 'null', '[]', '{"schema":99,"font":20}']) assert.equal(parsePreferences(raw).font, 15);
  const safe = normalize({ preset: '__proto__', font: Infinity, code: -50, leading: 9, paragraph: 99, family: 'evil;}' });
  assert.equal(safe.preset, 'default'); assert.equal(safe.font, 15); assert.equal(safe.code, 11); assert.equal(safe.leading, 2); assert.equal(safe.paragraph, 24);
  assert.ok(!replyCSS(safe).includes('evil'));
});
test('disable and restart keep custom settings; reset stays in the chosen preset', () => {
  const map = new Map(); const storage = { getItem: key => map.get(key) ?? null, setItem: (key,value) => map.set(key,value) };
  const first = createPreferences(storage); first.setPreset('claude'); first.update({font:17,code:15}); first.update({enabled:false});
  const second = createPreferences(storage); assert.equal(second.getSnapshot().preferences.enabled,false); assert.equal(second.getSnapshot().preferences.font,17);
  second.update({enabled:true}); assert.equal(second.getSnapshot().preferences.code,15); second.reset();
  assert.equal(second.getSnapshot().preferences.preset,'claude'); assert.equal(second.getSnapshot().preferences.font,15); assert.equal(second.getSnapshot().preferences.leading,1.8);
  assert.equal(JSON.parse(map.get(STORAGE_KEY)).font,15);
});
test('unavailable storage leaves controls usable and reports the save failure', () => {
  const store = createPreferences({getItem(){throw Error('blocked');},setItem(){throw Error('quota');}});
  store.update({font:16}); assert.equal(store.getSnapshot().preferences.font,16); assert.equal(store.getSnapshot().storageAvailable,false);
  let notifications=0; const off=store.subscribe(()=>notifications++); store.update({enabled:false}); off(); store.update({font:18}); assert.equal(notifications,1);
});
test('turning off removes all content rules rather than approximating the native theme', () => {
  assert.equal(replyCSS({enabled:false,font:20}), '');
});
