import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { initializeDatabase } from './database/schema';
import { seedDatabase } from './database/seeder';
import { initWebSocketServer } from './services/wsService';
import { auditMiddleware } from './middleware/audit';
import { authenticateToken, AuthRequest } from './middleware/auth';
import { ensureUploadDir } from './config/upload';
import { getTrustProxySetting } from './config/proxy';

// Import Routes
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import courseRoutes from './routes/courseRoutes';
import scheduleRoutes from './routes/scheduleRoutes';
import examRoutes from './routes/examRoutes';
import avRoutes from './routes/avRoutes';
import deliveryRoutes from './routes/deliveryRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import auditRoutes from './routes/auditRoutes';
import notificationRoutes from './routes/notificationRoutes';

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 4000;

// Railway terminates the public connection at one reverse proxy. Trust only
// that hop in production so express-rate-limit can safely use X-Forwarded-For.
// Local development remains direct (trust proxy disabled).
app.set('trust proxy', getTrustProxySetting());

/**
 * Production รับคำขอจากโดเมนที่กำหนดใน FRONTEND_URL เท่านั้น
 * รองรับหลายโดเมนโดยคั่นด้วย comma เช่น production และ Vercel preview
 */
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Ensure upload directory exists
const uploadDir = ensureUploadDir();

// Create sample mock files if not present for instant preview
const mockDocx = path.join(uploadDir, 'mock-exam-cpe101.docx');
if (!fs.existsSync(mockDocx)) {
  fs.writeFileSync(mockDocx, 'MOCK EXAM DOCUMENT CPE101');
}

// ─── Security Middlewares (M-1: helmet, H-3: body limit, H-2: rate limit) ───
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // คำขอจาก server-to-server ไม่มี Origin และอนุญาต local frontend ใน development
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// H-2: Global rate limiting — 100 requests per minute per IP
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'คำขอมากเกินไป กรุณารอสักครู่ (Too many requests)' },
  })
);

// C-3: Raw upload URLs are intentionally not file servers. Exam files are served
// through GET /api/exams/:id/file, where the exam ownership/role is checked.
// Keeping the auth middleware here preserves a 401 response for unauthenticated
// legacy/guessed URLs without exposing arbitrary files to authenticated users.
app.get('/uploads/:filename', authenticateToken, (_req: AuthRequest, res: Response) => {
  res.status(404).json({ success: false, message: 'ไม่พบไฟล์ที่ร้องขอ' });
});

// Request Audit Middleware for mutations (REQ-0013)
app.use('/api', auditMiddleware);

// API Routes Mapping
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/exam-schedules', scheduleRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/exams', avRoutes);
app.use('/api/exams', deliveryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global Error Handler (L-2: ซ่อน stack trace ใน production)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[Error Handler]', err);
  } else {
    console.error('[Error Handler]', err.message);
  }
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'เกิดข้อผิดพลาดภายในระบบแม่ข่าย (Internal Server Error)',
  });
});

// Start WebSocket Server
initWebSocketServer(server);

// Initialize DB and launch server
async function startServer() {
  try {
    await initializeDatabase();
    await seedDatabase();

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(`🚀 PrintExam Backend API Server running on port ${PORT}`);
      console.log(`📡 WebSocket endpoint ready at ws://localhost:${PORT}/ws`);
      console.log(`📁 File uploads served from ${uploadDir}`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
