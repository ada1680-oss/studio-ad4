// STUDIO AD4 制作日誌・管理者専用API

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

// 管理者認証
async function authenticate(request, env) {
  if (!env.ADMIN_TOKEN) return false;

  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return false;

  const supplied = authorization.slice(7);
  const expected = env.ADMIN_TOKEN;

  const encoder = new TextEncoder();
  const a = encoder.encode(supplied);
  const b = encoder.encode(expected);

  if (a.length !== b.length) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    b,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, a)
  );

  const comparison = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, b)
  );

  let diff = 0;
  for (let i = 0; i < signature.length; i++) {
    diff |= signature[i] ^ comparison[i];
  }

  return diff === 0;
}

// 認証とデータベース接続
async function prepare(context) {
  const authorized = await authenticate(
    context.request,
    context.env
  );

  if (!authorized) {
    return { error: json({ error: "認証に失敗しました" }, 401) };
  }

  const db = context.env.DB;

  if (!db) {
    return {
      error: json({ error: "データベースに接続できません" }, 500)
    };
  }

  return { db };
}

// 管理者用の記事一覧
export async function onRequestGet(context) {
  const state = await prepare(context);
  if (state.error) return state.error;

  try {
    const { results } = await state.db.prepare(`
      SELECT *
      FROM diary_posts
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `).all();

    return json({ posts: results || [] });
  } catch (error) {
    console.error(error);
    return json({ error: "記事の取得に失敗しました" }, 500);
  }
}

// 新規投稿
export async function onRequestPost(context) {
  const state = await prepare(context);
  if (state.error) return state.error;

  try {
    const data = await context.request.json();

    const title = String(data.title || "").trim();
    const category = String(data.category || "制作日誌").trim();
    const content = String(data.content || "").trim();
    const imageUrl = String(data.image_url || "").trim();

    const categories = ["制作日誌", "開発報告", "お知らせ"];

    if (
      !title ||
      !content ||
      title.length > 200 ||
      content.length > 20000 ||
      !categories.includes(category) ||
      imageUrl.length > 1000 ||
      (imageUrl && !isSafeImageUrl(imageUrl))
    ) {
      return json({ error: "入力内容を確認してください" }, 400);
    }

    const result = await state.db.prepare(`
      INSERT INTO diary_posts
      (title, category, content, image_url)
      VALUES (?, ?, ?, ?)
    `).bind(
      title,
      category,
      content,
      imageUrl || null
    ).run();

    return json({
      success: true,
      id: result.meta.last_row_id
    }, 201);

  } catch (error) {
    console.error(error);
    return json({ error: "投稿に失敗しました" }, 500);
  }
}

// 記事編集
export async function onRequestPut(context) {
  const state = await prepare(context);
  if (state.error) return state.error;

  try {
    const data = await context.request.json();

    const id = Number(data.id);
    const title = String(data.title || "").trim();
    const category = String(data.category || "制作日誌").trim();
    const content = String(data.content || "").trim();
    const imageUrl = String(data.image_url || "").trim();

    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      !title ||
      !content ||
      title.length > 200 ||
      content.length > 20000 ||
      !["制作日誌", "開発報告", "お知らせ"].includes(category) ||
      imageUrl.length > 1000 ||
      (imageUrl && !isSafeImageUrl(imageUrl))
    ) {
      return json({ error: "入力内容を確認してください" }, 400);
    }

    const result = await state.db.prepare(`
      UPDATE diary_posts
      SET
        title = ?,
        category = ?,
        content = ?,
        image_url = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      title,
      category,
      content,
      imageUrl || null,
      id
    ).run();

    if (!result.meta.changes) {
      return json({ error: "記事が見つかりません" }, 404);
    }

    return json({ success: true });

  } catch (error) {
    console.error(error);
    return json({ error: "編集に失敗しました" }, 500);
  }
}

// 記事削除
export async function onRequestDelete(context) {
  const state = await prepare(context);
  if (state.error) return state.error;

  try {
    const data = await context.request.json();
    const id = Number(data.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return json({ error: "記事IDが不正です" }, 400);
    }

    const result = await state.db.prepare(
      "DELETE FROM diary_posts WHERE id = ?"
    ).bind(id).run();

    if (!result.meta.changes) {
      return json({ error: "記事が見つかりません" }, 404);
    }

    return json({ success: true });

  } catch (error) {
    console.error(error);
    return json({ error: "削除に失敗しました" }, 500);
  }
}

// 画像URLの安全性確認
function isSafeImageUrl(value) {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return !value.includes("\\") && !/[\u0000-\u001f]/.test(value);
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}
