import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { initializeDatabase } from './database/schema';
import { seedDatabase } from './database/seeder';
import { initWebSocketServer } from './services/wsService';
import { auditMiddleware } from './middleware/audit';
import { authenticateToken, AuthRequest } from './middleware/auth';
import { prisma } from './database/prisma';
import { UserRole } from '../generated/prisma';
import { createExamFileDownloadUrl } from './services/fileStorageService';

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
const PORT = process.env.PORT || 4000;

// Render/Vercel and similar deployments sit behind one reverse proxy.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

/**
 * Production รับคำขอจากโดเมนที่กำหนดใน FRONTEND_URL เท่านั้น
 * รองรับหลายโดเมนโดยคั่นด้วย comma เช่น production และ Vercel preview
 */
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Create sample files only for an explicitly enabled local demo.
const mockDocx = path.join(uploadDir, 'mock-exam-cpe101.docx');
if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO_DATA === 'true' && !fs.existsSync(mockDocx)) {
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
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Correlate API errors with one compact structured access log entry.
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = String(req.headers['x-request-id'] || randomUUID()).slice(0, 100);
  const startedAt = Date.now();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  res.on('finish', () => {
    console.log(JSON.stringify({
      type: 'http_request',
      requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    }));
  });
  next();
});

// Cookie-authenticated mutations must originate from an approved frontend.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) return next();
  res.status(403).json({ success: false, message: 'Origin is not allowed' });
});

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

// C-3: Serve uploaded files through authenticated route instead of static
// (ลบ express.static เพื่อป้องกันการเข้าถึงไฟล์ข้อสอบโดยไม่ login)
app.get('/uploads/:filename', authenticateToken, async (req: AuthRequest, res: Response) => {
  const safeName = path.basename(String(req.params.filename)); // ป้องกัน path traversal
  const filePath = path.join(uploadDir, safeName);

  const exam = await prisma.exam.findFirst({
    where: { fileUrl: `/uploads/${safeName}`, deletedAt: null },
    select: {
      createdById: true,
      originalFilename: true,
      course: { select: { instructorId: true } },
    },
  });

  if (!exam) {
    res.status(404).json({ success: false, message: 'ไม่พบข้อมูลไฟล์ข้อสอบ' });
    return;
  }

  const user = req.user!;
  const staffCanAccess =
    user.role === UserRole.AV_STAFF || user.role === UserRole.ADMIN;
  const instructorCanAccess = user.role === UserRole.INSTRUCTOR &&
    (exam.createdById === user.id || exam.course.instructorId === user.id);
  if (!staffCanAccess && !instructorCanAccess) {
    res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงไฟล์ข้อสอบนี้' });
    return;
  }

  const signedUrl = await createExamFileDownloadUrl(safeName);
  if (signedUrl) {
    res.redirect(302, signedUrl);
    return;
  }
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, message: 'ไม่พบไฟล์ที่ร้องขอ' });
    return;
  }

  res.download(filePath, exam.originalFilename || safeName);
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
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'unavailable', timestamp: new Date().toISOString() });
  }
});

// Global Error Handler (L-2: ซ่อน stack trace ใน production)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[Error Handler]', err);
  } else {
    console.error('[Error Handler]', err.message);
  }
  const status = Number(err.status || err.statusCode || 500);
  res.status(status).json({
    success: false,
    request_id: res.locals.requestId,
    message:
      status >= 500 && process.env.NODE_ENV === 'production'
        ? 'เกิดข้อผิดพลาดภายในระบบแม่ข่าย (Internal Server Error)'
        : err.message || 'เกิดข้อผิดพลาดภายในระบบแม่ข่าย (Internal Server Error)',
  });
});

// Start WebSocket Server
initWebSocketServer(server);

// Initialize DB and launch server
async function startServer() {
  try {
    await initializeDatabase();
    if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO_DATA === 'true') {
      await seedDatabase();
    }

    server.listen(PORT, () => {
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

let isShuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(JSON.stringify({ type: 'shutdown', signal }));
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
