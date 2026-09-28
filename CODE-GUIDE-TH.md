# คู่มืออ่านโค้ด PrintExam

เอกสารนี้สรุปว่าแต่ละส่วนทำอะไรและข้อมูลไหลผ่านระบบอย่างไร เพื่อกลับมาเปิดอ่านภายหลังได้ง่าย

## ภาพรวมการทำงาน

```text
React frontend -> REST API / WebSocket -> Express backend -> Prisma -> Supabase PostgreSQL
```

- Frontend แสดงหน้าจอตามบทบาทและเรียก API เท่านั้น ไม่ต่อฐานข้อมูลโดยตรง
- Backend ตรวจ JWT/RBAC, ตรวจเงื่อนไขธุรกิจ, จัดการไฟล์ และบันทึกข้อมูล
- Prisma เป็นชั้นเชื่อม PostgreSQL
- ตาราง ER-v2 เป็นแหล่งข้อมูลหลักโดยตรง ไม่มีตารางเงาตัวพิมพ์เล็กและไม่มี sync trigger สองชุด
- `Exam_Schedule`, `Notification`, `Envelope_Label` และ `System_Audit_Log` เป็นตารางเสริมสำหรับฟังก์ชันที่ ER ไม่ได้ระบุ

## Backend

### จุดเริ่มระบบ

- `backend/src/index.ts` สร้าง Express/HTTP/WebSocket server และผูก route ทั้งหมด
- `backend/src/database/prisma.ts` สร้าง Prisma Client ตัวกลาง ห้ามสร้าง client ซ้ำใน route
- `backend/src/database/schema.ts` เชื่อมฐานข้อมูลและเรียก seeder ตอนเริ่มระบบ
- `backend/src/database/seeder.ts` สร้างข้อมูลตัวอย่างเฉพาะเมื่อยังไม่มีผู้ใช้

### Middleware

- `middleware/auth.ts` อ่าน Bearer token, ตรวจ JWT และโหลดผู้ใช้ล่าสุดจากฐานข้อมูล
- `middleware/rbac.ts` จำกัด route ตาม `UserRole`
- `middleware/upload.ts` ตรวจชนิด/ขนาดไฟล์และจัดเก็บไฟล์ข้อสอบ
- `middleware/audit.ts` บันทึกว่าใครทำอะไรกับข้อมูลใด

### Routes

- `authRoutes.ts` login, OTP 3 นาที, JWT และ profile ปัจจุบัน
- `userRoutes.ts` CRUD/ระงับ/เปลี่ยนบทบาทผู้ใช้โดย Admin
- `courseRoutes.ts` จัดการรายวิชาและจำกัดวิชาของอาจารย์
- `scheduleRoutes.ts` กำหนดวัน เวลา ห้อง และผู้ประสานงานสอบ
- `examRoutes.ts` ส่งไฟล์ ดูรายละเอียด แก้ไข และยกเลิกข้อสอบ
- `avRoutes.ts` ตรวจไฟล์ อนุมัติ/ตีกลับ พิมพ์ใบปะหน้า และบรรจุซอง
- `deliveryRoutes.ts` แจ้งพร้อมรับและยืนยันการส่งมอบ
- `dashboardRoutes.ts` ค่าสรุปและตัวกรองรายงาน
- `notificationRoutes.ts` อ่าน/ทำเครื่องหมายการแจ้งเตือน
- `auditRoutes.ts` ดูประวัติการดำเนินงาน

### Services

- `notificationService.ts` สร้าง notification และส่ง event แบบ real-time
- `wsService.ts` ดูแล WebSocket clients และ broadcast การเปลี่ยนสถานะ
- `pdfService.ts` สร้าง PDF ใบปะหน้าซองข้อสอบ

## Frontend

### โครงหลัก

- `src/App.tsx` กำหนด URL และหน้าที่แต่ละบทบาทเข้าถึงได้
- `context/AuthContext.tsx` เก็บ token/user และเรียก login/OTP
- `context/WebSocketContext.tsx` รับเหตุการณ์สถานะและ notification แบบ real-time
- `context/ToastContext.tsx` แสดงข้อความสำเร็จ คำเตือน และข้อผิดพลาด
- `api/client.ts` ตั้ง Axios base URL, แนบ JWT และจัดการ token หมดอายุ
- `api/*.ts` รวมคำสั่งเรียก API แยกตามหมวดงาน

### หน้าตามบทบาท

- `pages/auth/LoginPage.tsx` username/password -> OTP -> redirect ตามบทบาท
- `pages/instructor/ExamCreatePage.tsx` ข้อมูลวิชา จำนวนที่ขอพิมพ์ deadline และไฟล์ข้อสอบ
- `pages/instructor/ExamDetailPage.tsx` ดู/แก้/ยกเลิกก่อนตัดข้อสอบและก่อนเวลา lock
- `pages/instructor/InstructorDashboard.tsx` ติดตามสถานะแบบ real-time
- `pages/av-staff/ExamReviewPage.tsx` ตรวจไฟล์และอนุมัติหรือตีกลับพร้อมเหตุผล
- `pages/av-staff/ExamPrintPage.tsx` บันทึกจำนวนที่พิมพ์จริง แยกจากจำนวนที่อาจารย์ขอ
- `pages/av-staff/ExamPackPage.tsx` ตรวจใบปะหน้าและยืนยันบรรจุซอง
- `pages/coordinator/CourseSchedulePage.tsx` จัดการรายวิชาและกำหนดการสอบ
- `pages/coordinator/ReceiveExamPage.tsx` ตรวจและลงนามรับมอบ
- `pages/admin/UserManagementPage.tsx` จัดการผู้ใช้
- `pages/admin/ReportsPage.tsx` สรุป/ค้นหา/ส่งออก CSV
- `pages/admin/AuditLogPage.tsx` ประวัติการทำงาน

## สถานะข้อสอบ

```text
DRAFT -> SUBMITTED -> APPROVED -> PRINTING -> PRINTED -> PACKED -> READY_FOR_PICKUP -> DELIVERED
                    -> REJECTED -> SUBMITTED
```

- `REJECTED` ต้องแก้และส่งใหม่ได้
- ตั้งแต่ `APPROVED` ถือว่าตัดข้อสอบแล้ว อาจารย์แก้/ลบไม่ได้
- แม้เป็น DRAFT/SUBMITTED/REJECTED จะถูกล็อกเมื่อเหลือไม่ถึง 2 วันก่อน deadline

## จำนวนพิมพ์สองค่า

- `Exam.numCopies` คือจำนวนที่อาจารย์ขอพิมพ์
- `PrintRecord.printedCopies` คือจำนวนที่หน่วยโสตพิมพ์จริง
- ใบปะหน้า การบรรจุ และรับมอบต้องแสดงจำนวนพิมพ์จริงเมื่อมี record แล้ว

## OTP

- Browser ไม่ได้รับค่า OTP จาก API
- Development แสดง OTP ใน Terminal ของ backend เท่านั้น
- OTP ถูกเก็บชั่วคราว มีอายุ 3 นาที และถูกล้างหลังใช้งานสำเร็จ
- Production ต้องแทนที่ terminal log ด้วย university authentication, email หรือ SMS provider

## กฎก่อนแก้ฐานข้อมูล

- สำรอง Supabase ก่อนเปลี่ยน schema
- อย่าใช้ `prisma db push` หรือ `prisma migrate reset` เพราะ ER-v2 มี RLS และ CHECK constraints ที่สร้างด้วย SQL
- หากแก้ schema ให้ปรับ `backend/prisma/schema.prisma` และสร้าง Prisma Client ใหม่ก่อนทดสอบ workflow
