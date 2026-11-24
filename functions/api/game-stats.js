export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT game_id, play_count FROM game_stats"
  ).all();

  return Response.json({ games: results });
}

export async function onRequestPost({ request, env }) {
  let data;

  try {
    data = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const gameId = data?.game_id;

  if (
    typeof gameId !== "string" ||
    !/^[a-z0-9_-]{1,50}$/.test(gameId)
  ) {
    return Response.json(
      { error: "Invalid game ID" },
      { status: 400 }
    );
  }

  await env.DB.prepare(`
    INSERT INTO game_stats (game_id, play_count)
    VALUES (?, 1)
    ON CONFLICT(game_id) DO UPDATE SET
      play_count = play_count + 1,
      updated_at = CURRENT_TIMESTAMP
  `).bind(gameId).run();

  return Response.json({ success: true });
}
