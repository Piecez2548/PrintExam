# ระบบจัดการพิมพ์ข้อสอบ (Online Exam Printing Management System)

> คู่มือสำหรับกลับมาอ่านโครงสร้างและหน้าที่ของแต่ละส่วน: `CODE-GUIDE-TH.md`

ระบบจัดการพิมพ์ข้อสอบระดับมหาวิทยาลัยแบบครบวงจร (Full-Stack Web Application) รองรับกระบวนการ **"ส่ง → ตรวจสอบ → ตัดข้อสอบ → พิมพ์ → บรรจุซอง → ส่งมอบ"**

ลำดับก่อนส่งข้อสอบ: แอดมินสร้างบัญชี → อาจารย์ลงรายวิชาที่สอน (ภาค 1/2/ซัมเมอร์) → เจ้าหน้าที่ดำเนินการสอบกำหนดและยืนยันรอบกลางภาค/ปลายภาค วัน เวลา ห้อง และ Deadline → อาจารย์เลือกตารางที่ยืนยันแล้วและกรอกฟอร์มส่งข้อสอบ

---

## 🛠️ Tech Stack & Architecture

- **Backend**: Node.js, Express, TypeScript, **Prisma ORM**, **PostgreSQL (Supabase)**, WebSockets (`ws`), PDFKit (`pdfkit`), Multer, Bcrypt, JSON Web Token (JWT), Supabase Storage & Auth SDK (`@supabase/supabase-js`).
- **Database & Pooling**: PostgreSQL on Supabase with Connection Pooling (`port 6543`) for high concurrency (NFR-1) and Direct URL (`port 5432`) for migrations.
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React icons, Canvas Confetti.
- **Security & RBAC**: OTP อายุ 3 นาที, HttpOnly session cookie, Role-Based Access Control (RBAC), session revocation และ Audit Trail.

---

## 👥 ผู้ใช้งาน 4 บทบาท (4 User Roles)

1. **อาจารย์ผู้สอน (Instructor)**: เลือกตารางสอบของวิชาตนเองที่เจ้าหน้าที่ดำเนินการสอบยืนยันแล้ว กรอกรายละเอียดการพิมพ์ อัปโหลดไฟล์ (.docx/.pdf) และติดตามสถานะ Real-time แก้ไข/ยกเลิกได้ก่อนตัดข้อสอบและล่วงหน้าอย่างน้อย 2 วันก่อน Deadline (REQ-0004, REQ-0005)
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

ไฟล์ `.env` ถูกกันออกจาก Git แม้ repository จะเป็น private เพราะรหัสฐานข้อมูล/JWT/Service Role สามารถให้สิทธิ์กับระบบจริงได้ ให้ส่งค่าเหล่านี้กับสมาชิกผ่านช่องทางลับ และเปลี่ยนค่าทันทีหากเคย commit ไปแล้ว

### 3. รัน Database Migration & Seeder
```bash
cd backend

# สร้างตารางบน Supabase PostgreSQL
npx prisma migrate dev --name init

# (หรือ) อัปเดต Schema ตรงไปยังฐานข้อมูล
npm run prisma:push

# นำเข้าข้อมูลเริ่มต้น (Mock Users, Courses, Schedules, Exams)
npm run db:seed

# (ถ้ามีข้อมูลใน SQLite เดิม) รันสคริปต์ย้ายข้อมูลเข้า Supabase
npm run db:migrate-sqlite
```

> ระบบใช้ตารางชื่อ ER-v2 เป็นฐานข้อมูลหลักโดยตรงแล้ว ไม่มีตารางเดิมตัวพิมพ์เล็กหรือระบบซิงก์สองชุด
> มีตารางเสริมเฉพาะข้อมูลกำหนดการ การแจ้งเตือน ใบปะหน้า และ audit ที่ Requirement ต้องใช้แต่ ER ไม่ได้ระบุ
> ห้ามใช้ `prisma db push` หรือ `prisma migrate reset` หลังติดตั้ง RLS และ CHECK constraints ด้วย SQL

สำหรับฐานข้อมูลเดิม ให้สำรองข้อมูลก่อนแล้วรัน migration แบบเพิ่มคอลัมน์ (ไม่ลบข้อมูลเดิม):
```bash
cd backend
npm run db:upgrade:schedule-profile-form
npm run db:upgrade:envelope-profile-section
npm run db:upgrade:security-integrity
npm run prisma:generate
```

คำสั่ง `db:upgrade:security-integrity` รักษาประวัติเดิมไว้: ตารางสอบซ้ำจะถูกยกเลิกแทนการลบ และรายการข้อสอบเก่าจะไม่ถูกทำลาย ควรสำรองฐานข้อมูลก่อนรันบนฐานจริงเสมอ

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
- [x] **REQ-0010**: พิมพ์ใบปะหน้าซองข้อสอบตามแบบคณะ พร้อมข้อมูลรายวิชา รอบสอบ จำนวนชุด รายชื่อผู้ขาดสอบ และผู้คุมสอบ
- [x] **REQ-0011**: ยืนยันการบรรจุซองข้อสอบ (PACKED)
- [x] **REQ-0012**: แจ้งเตือนพร้อมรับมอบ + ลงนามส่งมอบข้อสอบ (DELIVERED)
- [x] **REQ-0013**: บันทึก Audit Log ทุกขั้นตอนพร้อมดู JSON diff
- [x] **REQ-0014**: รายงานสรุปภาพรวมพร้อมตัวกรองค้นหาละเอียด และ Export CSV

---

## การตั้งค่าที่ต้องใช้เมื่อ Deploy

- ตั้ง `NODE_ENV=production`, ใช้ `JWT_SECRET` แบบสุ่มยาว และห้ามเปิด `ENABLE_DEMO_QUICK_LOGIN`
- สำหรับสาธิตบน Render โดยไม่ส่งอีเมล ตั้ง `OTP_DELIVERY_MODE=demo-log` และ `ENABLE_DEMO_OTP_LOGGING=true` แล้วอ่านรหัสจาก Render Logs; ผู้ที่เข้าถึง Logs จะเห็น OTP ได้ จึงห้ามใช้โหมดนี้กับระบบจริง
- สำหรับระบบจริง ตั้ง `OTP_DELIVERY_MODE=resend`, `RESEND_API_KEY` และผู้ส่งใน `OTP_FROM_EMAIL`
- หาก frontend และ backend คนละโดเมน ให้ใช้ HTTPS และตั้ง `AUTH_COOKIE_SAME_SITE=none`; ถ้าโดเมนเดียวกันใช้ `lax`
- ตั้ง `STORAGE_DRIVER=supabase` และสร้าง bucket แบบ private ชื่อเดียวกับ `SUPABASE_STORAGE_BUCKET`; ระบบจะออกลิงก์ดาวน์โหลดชั่วคราวหลังตรวจสิทธิ์
- กำหนด `FRONTEND_URL` ให้ตรงโดเมนที่อนุญาต คั่นหลายโดเมนด้วย comma ได้
- สำรอง PostgreSQL ตามรอบของหน่วยงานและทดสอบกู้คืนจริง ไม่ควรถือว่า Git เป็นที่สำรองฐานข้อมูลหรือไฟล์ข้อสอบ

## Non-functional requirements ที่ใช้วัดงาน

| ด้าน | เป้าหมายสำหรับ mini project | วิธีตรวจ |
|---|---|---|
| ความปลอดภัย | OTP 3 นาที, ล็อก OTP หลังผิด 5 ครั้ง, รหัสผ่าน 12+ ตัวครบ 4 กลุ่ม, session ถูกยกเลิกเมื่อเปลี่ยน/รีเซ็ตรหัส | automated tests + ทดลองผ่าน 4 roles |
| ประสิทธิภาพ | API รายการทั่วไปตอบภายใน 2 วินาทีที่ข้อมูลไม่เกิน 500 รายการ และผู้ใช้พร้อมกัน 50 คน | load test ใน environment เดียวกับ demo |
| ความพร้อมใช้ | `/api/health` ต้องตรวจฐานข้อมูลจริง; ปิดโปรเซสโดยรอ request และ disconnect database | health monitor + shutdown test |
| ความถูกต้องของข้อมูล | หนึ่งรายวิชามีตารางสอบที่ใช้งานได้หนึ่งรอบ และหนึ่งรอบมีข้อสอบที่ใช้งานได้หนึ่งรายการ | database unique indexes + concurrency test |
| การตรวจสอบย้อนหลัง | การเปลี่ยนสถานะสำคัญมีผู้กระทำ เวลา และเหตุผล โดยไม่เก็บ password/token ในรายละเอียด | ตรวจ Audit Log และ security test |
| การกู้คืน | เป้าหมาย RPO 24 ชั่วโมง, RTO 4 ชั่วโมงสำหรับการสาธิต | backup/restore drill ก่อนส่งงาน |

ตัวเลขข้างต้นเป็นเกณฑ์รับงาน ไม่ใช่คำรับรองอัตโนมัติของผู้ให้บริการ จึงควรบันทึกผลทดสอบจริงไว้ในรายงานโครงงาน
