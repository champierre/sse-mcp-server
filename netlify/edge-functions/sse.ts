import { Context } from "@netlify/edge-functions";

// SSEコネクションを保持するためのマップ
const connections = new Map<string, {
  controller: ReadableStreamDefaultController;
}>();

// メッセージハンドラー
type MessageHandler = (message: string) => void;
const messageHandlers = new Map<string, MessageHandler>();

// メッセージを登録する関数
function registerMessageHandler(connectionId: string, handler: MessageHandler) {
  messageHandlers.set(connectionId, handler);
}

// メッセージを送信する関数
function sendMessage(connectionId: string, message: string) {
  const handler = messageHandlers.get(connectionId);
  if (handler) {
    handler(message);
  }
}

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // SSE接続のエンドポイント
  if (path === "/sse" && req.method === "GET") {
    // ユニークなコネクションIDを生成
    const connectionId = crypto.randomUUID();
    
    // ReadableStreamを作成
    const stream = new ReadableStream({
      start(controller) {
        // 初期メッセージを送信
        controller.enqueue(`data: Connected with ID ${connectionId}\n\n`);
        
        // コネクションを保存
        connections.set(connectionId, { controller });
        
        // メッセージハンドラーを登録
        registerMessageHandler(connectionId, (message) => {
          controller.enqueue(`data: ${message}\n\n`);
        });
        
        // 定期的にメッセージを送信（テスト用）
        const interval = setInterval(() => {
          if (connections.has(connectionId)) {
            sendMessage(connectionId, JSON.stringify({
              type: "ping",
              timestamp: new Date().toISOString()
            }));
          } else {
            clearInterval(interval);
          }
        }, 10000);
      },
      cancel() {
        // コネクションが閉じられたときの処理
        connections.delete(connectionId);
        messageHandlers.delete(connectionId);
      }
    });

    // SSEレスポンスを返す
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Connection-ID": connectionId
      }
    });
  }
  
  // メッセージ処理のエンドポイント
  if (path === "/message" && req.method === "POST") {
    // コネクションIDをヘッダーから取得
    const connectionId = req.headers.get("X-Connection-ID");
    if (!connectionId || !connections.has(connectionId)) {
      return new Response("Connection not found", { status: 404 });
    }
    
    try {
      // メッセージを処理
      const body = await req.text();
      const message = JSON.parse(body);
      
      // メッセージをクライアントに送信
      sendMessage(connectionId, JSON.stringify({
        type: "response",
        data: message,
        timestamp: new Date().toISOString()
      }));
      
      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Error handling message:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
  
  // その他のリクエストは404を返す
  return new Response("Not Found", { status: 404 });
};
