STUDIO AD4 Ver.0.3 — 掲示板付き Cloudflare Pages サイト

重要：index.htmlをローカルで開いた場合、掲示板の送受信は動作しません。
Cloudflare Pages Functions + D1 の設定が必要です。

手順（Git連携デプロイ推奨）
1. CloudflareにログインしてD1データベース（例 ad4-bbs）を作成する。
2. D1のSQLコンソールで migrations/0001_create_posts.sql の内容を実行する。
3. PagesプロジェクトをGitHubリポジトリに連携してデプロイする。
   リポジトリのルートに index.html, functions/, admin.html を配置する。
   ビルドコマンドは空、出力ディレクトリは「.」（ルート）に設定する。
   注意：PagesのダイレクトアップロードではFunctionsが期待どおり反映されない場合があります。
4. Pages > Settings > Bindings に D1 binding を追加。変数名は必ず DB、対象は作成したD1。
5. Pages > Settings > Variables and Secrets に ADMIN_TOKEN をシークレットとして登録。
   32文字以上のランダムな文字列を推奨。RATE_SALT もランダム値で設定推奨。
6. 再デプロイする。掲示板に投稿し、/admin.html にアクセスして承認すると公開される。

仕様：匿名投稿、作品別一覧、投稿承認、管理者返信、削除、1時間3件/IP相当の制限、ハニーポット。
投稿内容は承認まで非公開。投稿者のIPアドレスそのものは保存せずハッシュ化した値を保存。
実運用前にCloudflare Turnstile等の追加対策、プライバシーポリシー、利用規約の整備を推奨。
ADMIN_TOKENは絶対にサイト内のHTMLや公開リポジトリに記載しないこと。

Ver.0.4: スマホのメニューを2列表示に変更。PCの左側メニューは維持。
Cloudflare Pagesでは既存のstudio-ad4プロジェクトに新しいデプロイとしてアップロードしてください。
注意：掲示板APIはD1設定・デプロイ方式の確認が必要です。
