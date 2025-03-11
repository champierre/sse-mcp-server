import { Context } from "@netlify/edge-functions";

// グローバル変数はEdge Functions間で共有されないため、
// 各リクエストで独立して動作するように設計する必要があります
// 代わりにDurable Objectsなどを使用することも検討できます

// 簡易的なメッセージキューの実装
const MESSAGES: Record<string, string[]> = {};

// メッセージを追加する関数
function addMessage(connectionId: string, message: string) {
  if (!MESSAGES[connectionId]) {
    MESSAGES[connectionId] = [];
  }
  MESSAGES[connectionId].push(message);
  
  // キューのサイズを制限（最新の100メッセージのみ保持）
  if (MESSAGES[connectionId].length > 100) {
    MESSAGES[connectionId] = MESSAGES[connectionId].slice(-100);
  }
}

// メッセージを取得する関数
function getMessages(connectionId: string): string[] {
  return MESSAGES[connectionId] || [];
}

// メッセージを削除する関数
function clearMessages(connectionId: string) {
  MESSAGES[connectionId] = [];
}

export default async (req: Request, context: Context) => {
  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // SSE接続のエンドポイント
    if (path === "/sse" && req.method === "GET") {
      // クエリパラメータからコネクションIDを取得（初回接続時はnull）
      let connectionId = url.searchParams.get("id");
      
      // コネクションIDがない場合は新規作成
      if (!connectionId) {
        connectionId = crypto.randomUUID();
      }
      
      // 初期メッセージを追加
      if (!MESSAGES[connectionId]) {
        addMessage(connectionId, JSON.stringify({
          type: "connection",
          connectionId,
          message: "Connected to SSE server",
          timestamp: new Date().toISOString()
        }));
      }
      
      // 定期的なpingメッセージを追加
      addMessage(connectionId, JSON.stringify({
        type: "ping",
        timestamp: new Date().toISOString()
      }));
      
      // ReadableStreamを作成
      const stream = new ReadableStream({
        start(controller) {
          // 初期メッセージを送信
          controller.enqueue(`data: ${JSON.stringify({
            type: "connection",
            connectionId,
            message: "Connected to SSE server",
            timestamp: new Date().toISOString()
          })}\n\n`);
          
          // 既存のメッセージを送信
          const messages = getMessages(connectionId);
          for (const message of messages) {
            controller.enqueue(`data: ${message}\n\n`);
          }
          
          // メッセージキューをクリア
          clearMessages(connectionId);
          
          // 定期的なpingメッセージを送信するための変数
          let pingCount = 0;
          
          // 定期的なpingメッセージを送信する関数
          const sendPing = () => {
            const pingMessage = JSON.stringify({
              type: "ping",
              count: pingCount++,
              timestamp: new Date().toISOString()
            });
            
            try {
              controller.enqueue(`data: ${pingMessage}\n\n`);
              
              // 次のpingを予約（10秒ごと）
              setTimeout(sendPing, 10000);
            } catch (error) {
              // ストリームが閉じられている場合などのエラーを処理
              console.error("Error sending ping:", error);
            }
          };
          
          // 最初のpingを送信（1秒後）
          setTimeout(sendPing, 1000);
        },
        cancel() {
          // ストリームがキャンセルされた場合の処理
          console.log(`Connection ${connectionId} closed`);
        }
      });

      // SSEレスポンスを返す
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Connection-ID": connectionId
        }
      });
    }
    
    // メッセージ処理のエンドポイント
    if (path === "/message" && req.method === "POST") {
      // コネクションIDをヘッダーから取得
      const connectionId = req.headers.get("X-Connection-ID");
      if (!connectionId) {
        return new Response("Connection ID required", { status: 400 });
      }
      
      try {
        // メッセージを処理
        const body = await req.text();
        const message = JSON.parse(body);
        
        // メッセージをキューに追加
        addMessage(connectionId, JSON.stringify({
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
    
    // ルートパスの場合はHTMLを返す
    if (path === "/" && req.method === "GET") {
      return new Response("SSE MCP Server is running. Access /sse to connect.", {
        headers: {
          "Content-Type": "text/plain"
        }
      });
    }
    
    // その他のリクエストは404を返す
    return new Response("Not Found", { status: 404 });
  } catch (error) {
    console.error("Unhandled error:", error);
    return new Response("Internal Server Error: " + (error instanceof Error ? error.message : String(error)), { 
      status: 500 
    });
  }
};
