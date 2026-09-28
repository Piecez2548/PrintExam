import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { STATUS_LABELS_TH, ExamStatus } from '../types';

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
  const reconnectTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const connectWs = () => {
      const savedToken = localStorage.getItem('print_exam_token');
      if (!savedToken) return;

      const configuredWsUrl = import.meta.env.VITE_WS_URL as string | undefined;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const baseWsUrl = configuredWsUrl || `${protocol}//${window.location.host}/ws`;
      // H-1: ส่ง JWT token ผ่าน query string เพื่อ authenticate ฝั่ง server
      const wsUrl = `${baseWsUrl}?token=${encodeURIComponent(savedToken)}`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
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

        ws.onclose = () => {
          setIsConnected(false);
          // Auto reconnect in 3s
          reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
        };

        ws.onerror = (err) => {
          console.error('WebSocket error:', err);
          ws.close();
        };
      } catch (err) {
        console.error('WebSocket connection failed:', err);
        reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
      }
    };

    connectWs();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
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
