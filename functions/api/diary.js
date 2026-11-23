export async function onRequestGet(context) {
  try {
    const db = context.env.DB;

    if (!db) {
      return Response.json(
        { error: "データベースに接続できません" },
        { status: 500 }
      );
    }

    const { results } = await db
      .prepare(`
        SELECT
          id,
          title,
          category,
          content,
          image_url,
          created_at,
          updated_at
        FROM diary_posts
        ORDER BY created_at DESC, id DESC
        LIMIT 100
      `)
      .all();

    return Response.json(
      { posts: results || [] },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );

  } catch (error) {
    console.error("Diary API error:", error);

    return Response.json(
      { error: "記事の取得に失敗しました" },
      { status: 500 }
    );
  }
}
