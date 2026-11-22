const WORKS = ['ノボル2','最後の1秒。ラストコード','装甲機動兵器バイアーム','叫べ！俺の必殺技','名探偵犬アーサー','ガムテープ勇者試験','D-06号'];
const CATEGORIES = ['感想','改善要望','不具合報告'];
const json = (value,status=200) => new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function onRequestGet({request,env}) {
  if(!env.DB)return json({error:'データベース未設定'},503);
  const url=new URL(request.url),work=url.searchParams.get('work'),before=url.searchParams.get('before');
  if(!WORKS.includes(work))return json({error:'作品を選んでください'},400);
  if(before && !/^\d{1,12}$/.test(before))return json({error:'不正なページ指定'},400);
  try{
    const query=before ? 'SELECT id,name,category,body,reply,created_at FROM posts WHERE work=? AND status=\'approved\' AND id<? ORDER BY id DESC LIMIT 21' : 'SELECT id,name,category,body,reply,created_at FROM posts WHERE work=? AND status=\'approved\' ORDER BY id DESC LIMIT 21';
    const args=before?[work,Number(before)]:[work];
    const result=await env.DB.prepare(query).bind(...args).all();const rows=result.results||[];const hasMore=rows.length>20;const posts=rows.slice(0,20);
    return json({posts,nextCursor:hasMore?String(posts.at(-1).id):null});
  }catch{return json({error:'投稿を取得できません'},500)}
}
export async function onRequestPost({request,env}) {
  if(!env.DB)return json({error:'掲示板は準備中です'},503);
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'形式が正しくありません'},415);
  if(Number(request.headers.get('content-length')||0)>10000)return json({error:'投稿が長すぎます'},413);
  let data;try{data=await request.json()}catch{return json({error:'内容を確認してください'},400)}
  const work=data?.work,name=String(data?.name||'').trim()||'匿名',category=data?.category,body=String(data?.body||'').trim();
  if(!WORKS.includes(work)||!CATEGORIES.includes(category)||name.length>30||body.length<2||body.length>2000)return json({error:'入力内容を確認してください（本文2〜2000文字）'},400);
  if(data.website)return json({ok:true}); // bot honeypot
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const encoder=new TextEncoder();const hash=await crypto.subtle.digest('SHA-256',encoder.encode(ip+':'+(env.RATE_SALT||'ad4')));
  const ipHash=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
  try{
    const recent=await env.DB.prepare("SELECT COUNT(*) AS count FROM posts WHERE ip_hash=? AND created_at >= datetime('now','-1 hour')").bind(ipHash).first();
    if((recent?.count||0)>=3)return json({error:'投稿回数の上限です。しばらくお待ちください'},429);
    await env.DB.prepare("INSERT INTO posts (work,name,category,body,ip_hash,status) VALUES (?,?,?,?,?,'pending')").bind(work,name,category,body,ipHash).run();
    return json({ok:true,status:'pending'},201);
  }catch{return json({error:'保存できませんでした'},500)}
}
