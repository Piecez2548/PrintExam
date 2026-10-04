import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { STATUS_LABELS_TH, ExamStatus } from '../types';
import { BACKEND_ORIGIN } from '../api/client';

interface WebSocketContextType {
  isConnected: boolean;
  lastEvent: { event: string; payload: any; timestamp: string } | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<{ event: string; payload: any; timestamp: string } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let disposed = false;
    let reconnectAttempts = 0;

    if (!isAuthenticated || !user) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const connectWs = () => {
      if (disposed) return;
      const configuredWsUrl = import.meta.env.VITE_WS_URL as string | undefined;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const backendWsOrigin = BACKEND_ORIGIN
        ? BACKEND_ORIGIN.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
        : `${protocol}//${window.location.host}`;
      const baseWsUrl = configuredWsUrl || `${backendWsOrigin}/ws`;
      try {
        const ws = new WebSocket(baseWsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (disposed) {
            ws.close(1000, 'Component disposed');
            return;
          }
          reconnectAttempts = 0;
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setLastEvent(data);

            if (data.event === 'EXAM_STATUS_CHANGED') {
              const { examId, toStatus, rejectionReason } = data.payload;
              const statusLabel = STATUS_LABELS_TH[toStatus as ExamStatus] || toStatus;

              if (toStatus === ExamStatus.REJECTED) {
                toast.error(
                  `ข้อสอบ #${examId}: ไม่ผ่านตรวจสอบ`,
                  `สาเหตุ: ${rejectionReason || 'โปรดตรวจสอบรายละเอียดในระบบ'}`
                );
              } else if (toStatus === ExamStatus.APPROVED) {
                toast.success(`ข้อสอบ #${examId}: อนุมัติตัดข้อสอบแล้ว`, 'พร้อมเข้าสู่กระบวนการพิมพ์');
              } else if (toStatus === ExamStatus.READY_FOR_PICKUP) {
                toast.info(`ข้อสอบ #${examId}: พร้อมส่งมอบ`, 'เจ้าหน้าที่สามารถมารับซองข้อสอบได้แล้ว');
              } else {
                toast.info(`อัปเดตสถานะข้อสอบ #${examId}`, `สถานะใหม่: ${statusLabel}`);
              }
            } else if (data.event === 'NEW_NOTIFICATION') {
              toast.info(data.payload.title, data.payload.message);
            }
          } catch (err) {
            console.error('WS Parse Error:', err);
          }
        };

        ws.onclose = (event) => {
          setIsConnected(false);
          if (disposed) return;
          // Authentication rejection needs a fresh login/profile completion;
          // retrying it forever only floods the browser console.
          if (event.code === 4001 || event.code === 4003) return;
          const delay = Math.min(1000 * 2 ** reconnectAttempts, 15_000);
          reconnectAttempts += 1;
          reconnectTimeoutRef.current = setTimeout(connectWs, delay);
        };

        ws.onerror = () => {
          setIsConnected(false);
          // onclose performs the bounded reconnect. Avoid logging the opaque
          // browser Event object, which does not contain a useful cause.
        };
      } catch (err) {
        if (!disposed) {
          console.warn('ไม่สามารถเริ่มการเชื่อมต่อแบบเรียลไทม์ได้', err);
          reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
        }
      }
    };

    // Deferring one tick prevents React StrictMode's development-only setup /
    // cleanup cycle from closing a socket before its handshake completes.
    reconnectTimeoutRef.current = setTimeout(connectWs, 100);

    return () => {
      disposed = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        const socket = wsRef.current;
        socket.onclose = null;
        if (socket.readyState === WebSocket.OPEN) {
          socket.close(1000, 'Component disposed');
        } else if (socket.readyState === WebSocket.CONNECTING) {
          socket.onopen = () => socket.close(1000, 'Component disposed');
          socket.onerror = null;
        }
        wsRef.current = null;
      }
    };
  }, [isAuthenticated, user]);

  return (
    <WebSocketContext.Provider value={{ isConnected, lastEvent }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
