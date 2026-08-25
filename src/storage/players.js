import { openDb, promisifyRequest, STORES } from './db.js';

/**
 * Build a new player profile. The id is stable for the life of the profile,
 * so renaming a player never forks their history.
 */
export function createPlayer(name) {
  const trimmed = name.trim();
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'player';
  // crypto.randomUUID() (widely supported in the target browsers) gives a
  // collision-safe id; savePlayer does a `put`, so a colliding id would
  // silently overwrite an unrelated player rather than erroring.
  const suffix = crypto.randomUUID().slice(0, 8);
  return { id: `p_${slug}_${suffix}`, name: trimmed };
}

export async function savePlayer(player) {
  const db = await openDb();
  const tx = db.transaction(STORES.players, 'readwrite');
  await promisifyRequest(tx.objectStore(STORES.players).put(player));
  db.close();
}

/** All player profiles, sorted by name for stable display in the picker. */
export async function loadAllPlayers() {
  const db = await openDb();
  const tx = db.transaction(STORES.players, 'readonly');
  const players = await promisifyRequest(tx.objectStore(STORES.players).getAll());
  db.close();
  return players.sort((a, b) => a.name.localeCompare(b.name));
}
