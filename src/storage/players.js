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
  return { id: `p_${slug}_${suffix}`, name: trimmed, archived: false };
}

export async function savePlayer(player) {
  const db = await openDb();
  const tx = db.transaction(STORES.players, 'readwrite');
  await promisifyRequest(tx.objectStore(STORES.players).put(player));
  db.close();
}

/**
 * All player profiles — archived and active alike — sorted by name for
 * stable display. Deliberately unfiltered: a past session's roster and the
 * history/stats screens look players up here by id, and an archived player
 * must still resolve to their real name. Filtering to "not archived" for
 * the "who's playing" picker is the setup screen's job, not this store's.
 * Degrades to [] if storage is unavailable.
 */
export async function loadAllPlayers() {
  try {
    const db = await openDb();
    const tx = db.transaction(STORES.players, 'readonly');
    const players = await promisifyRequest(tx.objectStore(STORES.players).getAll());
    db.close();
    return players.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.warn('Could not load players; continuing with none.', error);
    return [];
  }
}

async function loadPlayer(id) {
  const db = await openDb();
  const tx = db.transaction(STORES.players, 'readonly');
  const player = await promisifyRequest(tx.objectStore(STORES.players).get(id));
  db.close();
  return player;
}

/**
 * Soft-remove/restore a player profile. This flips a flag on the existing
 * record — id and name are untouched, so every past session, summary, and
 * history/stats entry that already references this id keeps resolving to
 * their real name. Reversible by design ("soft" implies recoverable).
 *
 * A no-op (not an error) if the id doesn't exist, matching savePlayer's
 * own tolerance for an id that was never seen.
 */
async function setPlayerArchived(id, archived) {
  const player = await loadPlayer(id);
  if (!player) return;
  await savePlayer({ ...player, archived });
}

export function archivePlayer(id) {
  return setPlayerArchived(id, true);
}

export function restorePlayer(id) {
  return setPlayerArchived(id, false);
}
