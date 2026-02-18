const STORAGE_KEY = 'em_shift_leaderboard_v1';

function getSupabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

function normalizeRows(rows) {
  return (rows || [])
    .map((row) => ({
      player_name: row.player_name,
      score: Number(row.score) || 0,
      created_at: row.created_at || new Date().toISOString(),
    }))
    .sort((a, b) => (b.score - a.score) || a.created_at.localeCompare(b.created_at));
}

function readLocalRows() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeRows(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeLocalRows(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeRows(rows).slice(0, 100)));
}

async function fetchRemote(limit) {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;
  const params = new URLSearchParams({
    select: 'player_name,score,created_at',
    order: 'score.desc,created_at.asc',
    limit: String(limit),
  });
  const res = await fetch(`${cfg.url}/rest/v1/leaderboard?${params.toString()}`, {
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
    },
  });
  if (!res.ok) throw new Error('Failed to fetch remote leaderboard');
  return normalizeRows(await res.json());
}

async function submitRemote(playerName, score) {
  const cfg = getSupabaseConfig();
  if (!cfg) return false;
  const payload = [{ player_name: playerName, score, created_at: new Date().toISOString() }];
  const res = await fetch(`${cfg.url}/rest/v1/leaderboard`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to save remote leaderboard score');
  return true;
}

export async function submitScore(playerName, score) {
  let usedRemote = false;
  let error = null;
  try {
    usedRemote = await submitRemote(playerName, score);
  } catch (err) {
    error = err;
  }

  const localRows = readLocalRows();
  localRows.push({ player_name: playerName, score, created_at: new Date().toISOString() });
  writeLocalRows(localRows);
  return { usedRemote, error };
}

export async function fetchLeaderboard(limit = 20) {
  try {
    const remoteRows = await fetchRemote(limit);
    if (remoteRows) return remoteRows;
  } catch {
    // Fallback to local storage leaderboard.
  }
  return readLocalRows().slice(0, limit);
}
