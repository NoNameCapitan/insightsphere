import assert from 'node:assert/strict';
import test from 'node:test';
import { clearStoredSession, readStored, writeStored, SESSION_DATA_KEYS, SESSION_RESET_KEY } from '../lib/vlk-local-storage.ts';
import { restoreSession } from '../lib/vlk-session.ts';

function fixture() {
  const data = new Map(SESSION_DATA_KEYS.map((key) => [key, 'private session']));
  data.set('theme', 'dark'); data.set('another-app', 'keep');
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}
test('ending a session clears all current and legacy data, preserves preferences and signals other tabs', () => {
  const storage = fixture();
  assert.equal(clearStoredSession(storage), true);
  for (const key of SESSION_DATA_KEYS) {
    assert.equal(storage.getItem(key), null, key);
    assert.equal(restoreSession(storage.getItem(key)).basket.length, 0);
  }
  assert.equal(storage.getItem('theme'), 'dark');
  assert.equal(storage.getItem('another-app'), 'keep');
  assert.ok(storage.getItem(SESSION_RESET_KEY));
});
test('a denied storage operation cannot crash loading and partial cleanup is reported honestly', () => {
  const storage = fixture();
  const blocked = { ...storage, getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceeded'); }, removeItem(key) { if (key === SESSION_DATA_KEYS[0]) throw new Error('SecurityError'); storage.removeItem(key); } };
  assert.equal(readStored('key', blocked), null);
  assert.equal(writeStored('key', 'value', blocked), false);
  assert.equal(clearStoredSession(blocked), false);
  for (const key of SESSION_DATA_KEYS.slice(1)) assert.equal(storage.getItem(key), null);
});
