# SSE MCP Server

このリポジトリは、Server-Sent Events (SSE) を使用したModel Context Protocol (MCP) サーバーのサンプル実装です。Netlify Edge Functionsを使用してデプロイできるように設計されています。

## 機能

- SSEを使用したリアルタイム通信
- Netlify Edge Functionsでのサーバーサイド実装
- シンプルなクライアントインターフェース

## 開発環境のセットアップ

1. リポジトリをクローン
   ```
   git clone https://github.com/yourusername/sse-mcp-server.git
   cd sse-mcp-server
   ```

2. 依存関係をインストール
   ```
   npm install
   ```

3. 開発サーバーを起動
   ```
   npm run dev
   ```

## Netlifyへのデプロイ

1. Netlify CLIをインストール（既にインストール済みの場合はスキップ）
   ```
   npm install -g netlify-cli
   ```

2. Netlifyにログイン
   ```
   netlify login
   ```

3. サイトを初期化（初回のみ）
   ```
   netlify init
   ```

4. デプロイ
   ```
   npm run deploy
   ```

## Netlifyデプロイ後の動作確認方法

デプロイが完了したら、以下の手順で動作確認を行うことができます：

1. デプロイされたサイトのURLにアクセスする
   - デプロイ完了時にコンソールに表示されるURLか、Netlifyダッシュボードから確認できます
   - 例: `https://your-site-name.netlify.app`

2. トップページにアクセスすると、「SSE MCP Server is running. Access /sse to connect.」というメッセージが表示されます
   - これはサーバーが正常に動作していることを示しています

3. デモページを使用してSSE接続をテストする
   - トップページ（index.html）にはSSE接続をテストするためのUIが用意されています
   - 「接続」ボタンをクリックしてSSEサーバーに接続します
   - 接続が成功すると、ステータスが「接続中」に変わり、接続IDが表示されます

4. メッセージの送受信をテストする
   - テキスト入力欄にメッセージを入力し、「送信」ボタンをクリックします
   - 送信したメッセージがサーバーから返信され、画面に表示されます

5. 以下の点を確認する
   - 接続状態が正しく表示されるか
   - 定期的なpingメッセージが受信されるか
   - メッセージの送受信が正常に行われるか
   - エラー発生時の処理が適切に行われるか

6. 必要に応じて、開発者ツール（F12）のネットワークタブでSSE接続の詳細を確認する
   - `/sse` エンドポイントへのリクエストと、イベントストリームの状態を確認できます
   - `/message` エンドポイントへのPOSTリクエストが正常に処理されているか確認できます

これらの確認が成功すれば、SSE MCP Serverが正常にNetlifyにデプロイされ、動作していることが確認できます。

## ファイル構成

- `everything.ts` - MCPサーバーの実装
- `sse.ts` - Express.jsを使用したSSEサーバー
- `netlify/edge-functions/sse.ts` - Netlify Edge Functionsを使用したSSEサーバー
- `index.html` - クライアント側のデモページ

## ライセンス

MITライセンス
