const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });

async function authenticate(request, env) {
  if (!env.ADMIN_TOKEN) return false;

  const authorization = request.headers.get("Authorization") || "";
  const prefix = "Bearer ";

  if (!authorization.startsWith(prefix)) return false;

  const supplied = authorization.slice(prefix.length);
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

  const expectedSignature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, b)
  );

  let difference = 0;
  for (let i = 0; i < signature.length; i++) {
    difference |= signature[i] ^ expectedSignature[i];
  }

  return difference === 0;
}

async function checkAccess(request, env) {
  if (!env.DB) {
    return json({ error: "データベース未設定" }, 503);
  }

  if (!env.ADMIN_TOKEN) {
    return json({ error: "管理者認証が未設定です" }, 503);
  }

  if (!(await authenticate(request, env))) {
    return json({ error: "管理者トークンが正しくありません" }, 401);
  }

  return null;
}

// 全作品の投稿一覧
export async function onRequestGet({ request, env }) {
  const error = await checkAccess(request, env);
  if (error) return error;

  try {
    const result = await env.DB.prepare(
      `SELECT id, work, name, category, body,
              reply, status, created_at
       FROM posts
       ORDER BY id DESC
       LIMIT 100`
    ).all();

    return json({ posts: result.results || [] });
  } catch (e) {
    return json({ error: "投稿一覧を取得できません" }, 500);
  }
}

// 投稿の承認・非公開・返信
export async function onRequestPatch({ request, env }) {
  const error = await checkAccess(request, env);
  if (error) return error;

  let data;

  try {
    data = await request.json();
  } catch {
    return json({ error: "入力形式が正しくありません" }, 400);
  }

  const id = Number(data?.id);
  const status = data?.status;
  const reply = data?.reply ?? "";

  if (!Number.isSafeInteger(id) || id < 1) {
    return json({ error: "投稿IDが正しくありません" }, 400);
  }

  if (!["approved", "rejected"].includes(status)) {
    return json({ error: "公開状態が正しくありません" }, 400);
  }

  if (typeof reply !== "string" || reply.length > 2000) {
    return json({ error: "返信は2000文字以内にしてください" }, 400);
  }

  try {
    const result = await env.DB.prepare(
      `UPDATE posts
       SET status = ?, reply = ?
       WHERE id = ?`
    ).bind(status, reply, id).run();

    if (!result.meta?.changes) {
      return json({ error: "投稿が見つかりません" }, 404);
    }

    return json({ ok: true });
  } catch {
    return json({ error: "投稿を更新できません" }, 500);
  }
}

// 投稿の削除
export async function onRequestDelete({ request, env }) {
  const error = await checkAccess(request, env);
  if (error) return error;

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));

  if (!Number.isSafeInteger(id) || id < 1) {
    return json({ error: "投稿IDが正しくありません" }, 400);
  }

  try {
    const result = await env.DB.prepare(
      "DELETE FROM posts WHERE id = ?"
    ).bind(id).run();

    if (!result.meta?.changes) {
      return json({ error: "投稿が見つかりません" }, 404);
    }

    return json({ ok: true });
  } catch {
    return json({ error: "投稿を削除できません" }, 500);
  }
}
