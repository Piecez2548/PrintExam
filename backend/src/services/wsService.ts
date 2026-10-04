import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/constants';
import { prisma } from '../database/prisma';
import { AUTH_COOKIE_NAME, readCookie } from './authTokenService';

interface ExtendedWebSocket extends WebSocket {
  userId?: number;
  userRole?: string;
  isAlive?: boolean;
}

let wss: WebSocketServer | null = null;

export function initWebSocketServer(server: Server): WebSocketServer {
  wss = new WebSocketServer({
    server,
    path: '/ws',
  });

  wss.on('connection', async (ws: ExtendedWebSocket, req) => {
    try {
      const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const origin = req.headers.origin;
      if (origin && !allowedOrigins.includes(origin)) throw new Error('WebSocket origin is not allowed');
      if (!origin && process.env.NODE_ENV === 'production') throw new Error('WebSocket origin is required');

      const token = readCookie(req.headers.cookie, AUTH_COOKIE_NAME);
      if (!token) {
        ws.close(4001, 'Missing authentication token');
        return;
      }
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as {
        id: number;
        role: string;
        pending2FA?: boolean;
        sessionVersion?: number;
      };
      if (decoded.pending2FA) throw new Error('2FA is not complete');

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, role: true, isActive: true, sessionVersion: true },
      });
      if (!user?.isActive) throw new Error('Account is inactive');
      if (decoded.sessionVersion !== user.sessionVersion) throw new Error('Session has been revoked');
      ws.userId = user.id;
      ws.userRole = user.role;
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
