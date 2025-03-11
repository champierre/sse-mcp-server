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

## ファイル構成

- `everything.ts` - MCPサーバーの実装
- `sse.ts` - Express.jsを使用したSSEサーバー
- `netlify/edge-functions/sse.ts` - Netlify Edge Functionsを使用したSSEサーバー
- `index.html` - クライアント側のデモページ

## ライセンス

MITライセンス
