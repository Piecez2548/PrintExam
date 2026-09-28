# ระบบจัดการพิมพ์ข้อสอบ (Online Exam Printing Management System)

> คู่มือสำหรับกลับมาอ่านโครงสร้างและหน้าที่ของแต่ละส่วน: `CODE-GUIDE-TH.md`

ระบบจัดการพิมพ์ข้อสอบระดับมหาวิทยาลัยแบบครบวงจร (Full-Stack Web Application) รองรับกระบวนการ **"ส่ง → ตรวจสอบ → ตัดข้อสอบ → พิมพ์ → บรรจุซอง → ส่งมอบ"**

---

## 🛠️ Tech Stack & Architecture

- **Backend**: Node.js, Express, TypeScript, **Prisma ORM**, **PostgreSQL (Supabase)**, WebSockets (`ws`), PDFKit (`pdfkit`), Multer, Bcrypt, JSON Web Token (JWT), Supabase Storage & Auth SDK (`@supabase/supabase-js`).
- **Database & Pooling**: PostgreSQL on Supabase with Connection Pooling (`port 6543`) for high concurrency (NFR-1) and Direct URL (`port 5432`) for migrations.
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React icons, Canvas Confetti.
- **Security & RBAC**: 2-Factor Authentication (2FA TOTP/OTP with 3-minute timeout), Role-Based Access Control (RBAC), Audit Trail Interceptor.

---

## 👥 ผู้ใช้งาน 4 บทบาท (4 User Roles)

1. **อาจารย์ผู้สอน (Instructor)**: กรอกข้อมูลวิชา อัปโหลดไฟล์ (.docx/.pdf) ติดตามสถานะ Real-time แก้ไข/ยกเลิกได้ก่อนตัดข้อสอบและล่วงหน้าอย่างน้อย 2 วันก่อน Deadline (REQ-0004, REQ-0005)
2. **เจ้าหน้าที่หน่วยโสตทัศนศึกษา (AV Staff)**: ตรวจสอบไฟล์ อนุมัติตัดข้อสอบ หรือส่งกลับแก้ไขพร้อมระบุเหตุผล บันทึกจำนวนพิมพ์ พิมพ์ใบปะหน้าซอง และยืนยันบรรจุซอง (REQ-0006 ถึง REQ-0011)
3. **เจ้าหน้าที่ดำเนินการสอบ (Exam Coordinator)**: จัดการรายวิชา วัน-เวลาสอบ ห้องสอบ และตรวจรับมอบซองข้อสอบ (REQ-0003, REQ-0012)
4. **ผู้ดูแลระบบ (Admin)**: จัดการผู้ใช้งานและสิทธิ์ ดูรายงานสรุปภาพรวมทั้งหมด และดูประวัติ Audit Log (REQ-0002, REQ-0013, REQ-0014)

---

## 🚀 วิธีการติดตั้งและเริ่มใช้งาน (Getting Started)

### 1. ติดตั้ง Dependencies
```bash
# ติดตั้ง Backend
cd backend
npm install

# ติดตั้ง Frontend
cd ../frontend
npm install
```

### 2. ตั้งค่า Environment Variables (Supabase / PostgreSQL)
คัดลอกไฟล์ `.env.example` เป็น `.env` ในโฟลเดอร์ `backend/`:
```bash
cd backend
cp .env.example .env
```
กำหนดค่า `DATABASE_URL` (Connection Pooling: Port 6543) และ `DIRECT_URL` (Direct: Port 5432) จากโปรเจกต์ Supabase ของคุณ
ถ้าจะ seed ฐานข้อมูล PrintExam-Dev ที่ยังว่าง ให้กำหนด `SEED_DEFAULT_PASSWORD` ในไฟล์ `.env` แบบ local-only ด้วย
ห้ามใส่ค่าจริงใน `.env.example` หรือ commit ค่า credential ใด ๆ

### 3. รัน Database Migration & Seeder
```bash
cd backend

# สร้างตารางบน Supabase PostgreSQL
npx prisma migrate dev --name init

# (หรือ) อัปเดต Schema ตรงไปยังฐานข้อมูล
npm run prisma:push

# นำเข้าข้อมูลเริ่มต้น (Mock Users, Courses, Schedules, Exams)
# ต้องกำหนด SEED_DEFAULT_PASSWORD ใน backend/.env ก่อน และใช้เฉพาะกับ PrintExam-Dev
npm run db:seed

# (ถ้ามีข้อมูลใน SQLite เดิม) รันสคริปต์ย้ายข้อมูลเข้า Supabase
npm run db:migrate-sqlite
```

> ระบบใช้ตารางชื่อ ER-v2 เป็นฐานข้อมูลหลักโดยตรงแล้ว ไม่มีตารางเดิมตัวพิมพ์เล็กหรือระบบซิงก์สองชุด
> มีตารางเสริมเฉพาะข้อมูลกำหนดการ การแจ้งเตือน ใบปะหน้า และ audit ที่ Requirement ต้องใช้แต่ ER ไม่ได้ระบุ
> ห้ามใช้ `prisma db push` หรือ `prisma migrate reset` หลังติดตั้ง RLS และ CHECK constraints ด้วย SQL

### 4. รันระบบ (Development Mode)
```bash
# รัน Backend API (Port 4000) และ WebSocket (ws://localhost:4000/ws)
cd backend
npm run dev

# รัน Frontend (Port 5173)
cd frontend
npm run dev
```

เปิดเว็บเบราว์เซอร์ไปที่: **`http://localhost:5173`**

---

## 🔑 บัญชีตัวอย่างสำหรับทดสอบ (Demo Accounts)

บัญชีและรหัสผ่านสำหรับทดสอบไม่ถูกเผยแพร่ใน repository นี้ ผู้ดูแลระบบต้องสร้างและกำหนด
รหัสผ่านของแต่ละบทบาทในฐานข้อมูลของตนเอง ห้ามใช้รหัสผ่านตัวอย่างกับระบบที่เปิดให้เข้าถึงผ่านอินเทอร์เน็ต

---

## 📋 ความครอบคลุม Functional Requirements

- [x] **REQ-0001**: Login + 2FA นับถอยหลัง 3 นาที (NFR-5)
- [x] **REQ-0002**: Admin จัดการผู้ใช้งาน (CRUD, ระงับ, เปลี่ยนบทบาท)
- [x] **REQ-0003**: จนท.ดำเนินการสอบจัดการรายวิชาและวัน-เวลา-ห้องสอบ
- [x] **REQ-0004**: อาจารย์กรอกข้อมูลและอัปโหลดไฟล์ (.docx/.pdf)
- [x] **REQ-0005**: เงื่อนไขแก้ไข/ยกเลิก (ก่อนตัดข้อสอบ และ $\ge 2$ วันก่อน Deadline)
- [x] **REQ-0006**: ตรวจสอบไฟล์และอนุมัติตัดข้อสอบ (APPROVED)
- [x] **REQ-0007**: ปฏิเสธพร้อมเหตุผล และแจ้งเตือนอาจารย์แบบ Real-time
- [x] **REQ-0008**: แสดงสถานะแบบ Real-time (WebSockets + Toast)
- [x] **REQ-0009**: บันทึกการพิมพ์ จำนวนชุด ชนิดกระดาษ วัน-เวลา และผู้พิมพ์
- [x] **REQ-0010**: พิมพ์ใบปะหน้าซองข้อสอบมาตรฐาน (FORM EXAM-01) พร้อม QR Code
- [x] **REQ-0011**: ยืนยันการบรรจุซองข้อสอบ (PACKED)
- [x] **REQ-0012**: แจ้งเตือนพร้อมรับมอบ + ลงนามส่งมอบข้อสอบ (DELIVERED)
- [x] **REQ-0013**: บันทึก Audit Log ทุกขั้นตอนพร้อมดู JSON diff
- [x] **REQ-0014**: รายงานสรุปภาพรวมพร้อมตัวกรองค้นหาละเอียด และ Export CSV

---

## Phase 6 Demo / Release-Candidate Runbook

การทดสอบและสาธิตในเอกสารนี้ใช้เฉพาะฐานข้อมูลพัฒนา **PrintExam-Dev** เท่านั้น
ห้ามชี้ environment นี้ไปยังฐานข้อมูลภายนอกที่ไม่ทราบ provenance และห้ามเผยแพร่ค่า
credential, password หรือ secret ใน repository

### Prerequisites and environment

- Node.js และ npm ตาม lockfiles ที่ commit ไว้ใน `backend/` และ `frontend/`
- Backend ใช้ตัวแปร `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `JWT_SECRET`,
  `FRONTEND_URL`, `PORT` และ `SEED_DEFAULT_PASSWORD` เมื่อ seed ฐานข้อมูลว่าง
- Frontend ใช้ `VITE_API_URL` และ `VITE_WS_URL` ตาม `.env.example`
- ค่าจริงให้เก็บในไฟล์ `.env` ที่ถูก ignore และห้าม commit หรือพิมพ์ลง log
- `DATABASE_URL` ใช้ Supabase pooler transaction mode (port 6543) และ
  `DIRECT_URL` ใช้ direct session mode (port 5432)

### Safe local setup

```bash
cd backend
npm install
npm run prisma:generate
```

การสร้าง schema, seed หรือการเปลี่ยนข้อมูลให้ทำกับ PrintExam-Dev ที่ตรวจสอบ identity
แล้วเท่านั้น ห้ามใช้ `prisma migrate reset` และห้ามรัน `prisma db push` กับฐานข้อมูล
ที่มี RLS/CHECK constraints อยู่แล้วโดยไม่มีแผน migration ที่ตรวจสอบแล้ว

### Start and verify

```bash
# terminal 1
cd backend
npm run dev

# terminal 2
cd frontend
npm run dev
```

เปิด `http://localhost:5173` แล้วทดสอบ login + OTP ตามบทบาททั้ง 4 บทบาท
(`instructor`, `avstaff1`, `coordinator1`, `admin`) ด้วย credential ที่จัดการแบบ local-only

ตรวจสอบก่อนส่งมอบด้วยคำสั่ง:

```bash
cd backend
npm run build
npm run test:security
cd ../frontend
npm run build
```

### Demo workflow and external dependencies

เส้นทางสาธิตหลักคือ instructor ส่งข้อสอบ → AV ตรวจ/อนุมัติหรือ reject →
พิมพ์ → บรรจุซอง → coordinator รับมอบ พร้อมตรวจ notification, audit log,
รายงาน และ CSV export. University SSO/ระบบ OTP ภายนอกและเครื่องพิมพ์จริงยังเป็น
external dependencies; development ใช้ local username/password + OTP และบันทึก
สถานะการพิมพ์ในระบบแทนการสั่งงานเครื่องพิมพ์จริง

### Local demo authentication and development OTP

การสาธิตในเครื่องใช้บัญชี demo ที่มีอยู่ใน PrintExam-Dev และให้ผู้ดูแลกำหนด
รหัสผ่านผ่านกลไก local-only เท่านั้น ห้ามบันทึกรหัสผ่านไว้ใน README, source code,
หรือ log ที่ commit เข้า repository

หลังจากตรวจ username/password สำเร็จ ระบบจะสร้าง OTP 6 หลักใหม่แบบสุ่มทุกครั้ง
และ OTP มีอายุ 3 นาที ผู้ใช้ต้องกรอก OTP ในหน้าเว็บตามปกติ ระบบจะไม่แสดง OTP
บน frontend และจะไม่ข้ามขั้นตอน 2FA

สำหรับ development ที่ `NODE_ENV` ไม่ใช่ `production` ให้เปิด backend ด้วย
`npm run dev` แล้วดู terminal เดียวกับ backend หลังจาก login จะมีบรรทัดรูปแบบ
`[2FA OTP] ...` แสดง OTP ที่สร้างขึ้นสำหรับการทดสอบในเครื่องเท่านั้น หาก redirect
output ไปยังไฟล์ ให้ดูไฟล์ log ของ backend ด้วยเครื่องมือ local-only ที่ผู้ดูแลเลือก

เมื่อรัน production โดยไม่ได้เปิด private demo flag ระบบจะไม่ log OTP การยืนยันตัวตนของมหาวิทยาลัยจริง
เช่น University SSO หรือบริการ OTP ภายนอกยังเป็น external integration และไม่ได้
ถูกแทนที่ด้วย development OTP นี้

สำหรับ public demo บน Railway ให้คง `NODE_ENV=production` และปิด
`ENABLE_PRIVATE_DEMO_OTP_LOG` เป็นค่าเริ่มต้น หากผู้ดูแลอนุมัติการสาธิตแบบ private
จึงเปิด flag นี้ใน backend service เท่านั้น แล้วดู OTP จาก private Railway log console
โดยตรง ห้ามใส่ flag นี้ใน `VITE_*`, ห้ามสร้าง OTP viewer/API และห้ามเปิดเผย OTP
ผ่าน frontend หรือ WebSocket
