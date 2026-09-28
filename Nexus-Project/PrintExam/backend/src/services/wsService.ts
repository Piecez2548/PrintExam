import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/constants';

interface ExtendedWebSocket extends WebSocket {
  userId?: number;
  userRole?: string;
  isAlive?: boolean;
}

let wss: WebSocketServer | null = null;

export function initWebSocketServer(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: ExtendedWebSocket, req) => {
    // H-1: ตรวจสอบ JWT จาก query string ก่อนอนุญาตให้เชื่อมต่อ
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      if (!token) {
        ws.close(4001, 'Missing authentication token');
        return;
      }
      const decoded = jwt.verify(token, JWT_SECRET) as { id: number; role: string };
      ws.userId = decoded.id;
      ws.userRole = decoded.role;
      ws.isAlive = true;
      console.log(`[WebSocket] Client authenticated: User ${ws.userId} (${ws.userRole})`);
    } catch (err) {
      ws.close(4001, 'Invalid or expired token');
      return;
    }

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      // Disconnected
    });
  });

  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((client: WebSocket) => {
      const extWs = client as ExtendedWebSocket;
      if (extWs.isAlive === false) return extWs.terminate();
      extWs.isAlive = false;
      extWs.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('[WebSocket] Server initialized on /ws (JWT-authenticated)');
  return wss;
}

export function broadcastEvent(event: string, payload: any, targetUserIds?: number[]): void {
  if (!wss) return;

  const message = JSON.stringify({
    event,
    payload,
    timestamp: new Date().toISOString(),
  });

  wss.clients.forEach((client: WebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      const extWs = client as ExtendedWebSocket;
      if (targetUserIds && targetUserIds.length > 0) {
        if (extWs.userId && targetUserIds.includes(extWs.userId)) {
          extWs.send(message);
        }
      } else {
        extWs.send(message);
      }
    }
  });
}
