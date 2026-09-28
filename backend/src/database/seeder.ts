import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { UserRole, ExamStatus } from '../../generated/prisma';

export async function seedDatabase(): Promise<void> {
  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      console.log('[Seeder] Database already contains users. Skipping seeder.');
      return; // Already seeded
    }

    console.log('[Seeder] Seeding initial database records into PostgreSQL (Supabase)...');
    const seedDefaultPassword = process.env.SEED_DEFAULT_PASSWORD;
    if (!seedDefaultPassword) {
      throw new Error('SEED_DEFAULT_PASSWORD is required to seed an empty development database');
    }
    if (seedDefaultPassword.length < 8) {
      throw new Error('SEED_DEFAULT_PASSWORD must be at least 8 characters long');
    }
    const passwordHash = bcrypt.hashSync(seedDefaultPassword, 10);

    // 1. Seed Users
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash,
        fullName: 'ผู้ดูแลระบบสูงสุด (System Admin)',
        email: 'admin@university.ac.th',
        role: UserRole.ADMIN,
        department: 'สำนักคอมพิวเตอร์และเทคโนโลยีสารสนเทศ',
        phone: '02-555-0100',
        isActive: true,
      },
    });

    const instructor1 = await prisma.user.create({
      data: {
        username: 'instructor',
        passwordHash,
        fullName: 'รศ.ดร.สมชาย ใจดี (Assoc. Prof. Dr. Somchai)',
        email: 'somchai.j@university.ac.th',
        role: UserRole.INSTRUCTOR,
        department: 'ภาควิชาวิศวกรรมคอมพิวเตอร์',
        phone: '081-234-5678',
        isActive: true,
      },
    });

    const instructor2 = await prisma.user.create({
      data: {
        username: 'instructor2',
        passwordHash,
        fullName: 'ผศ.ดร.วรรณภา มั่นคง (Asst. Prof. Dr. Wannapha)',
        email: 'wannapha.m@university.ac.th',
        role: UserRole.INSTRUCTOR,
        department: 'ภาควิชาวิทยาการสารสนเทศ',
        phone: '089-987-6543',
        isActive: true,
      },
    });

    const avStaff = await prisma.user.create({
      data: {
        username: 'avstaff1',
        passwordHash,
        fullName: 'นายพงศ์สรรค์ ชำนาญพิมพ์ (Mr. Pongsak - Media Staff)',
        email: 'pongsak.av@university.ac.th',
        role: UserRole.AV_STAFF,
        department: 'หน่วยโสตทัศนศึกษาและศูนย์พิมพ์เอกสาร',
        phone: '02-555-0199',
        isActive: true,
      },
    });

    const coordinator = await prisma.user.create({
      data: {
        username: 'coordinator1',
        passwordHash,
        fullName: 'นางกัญญา ปฏิบัติการ (Mrs. Kanya - Exam Coordinator)',
        email: 'kanya.coord@university.ac.th',
        role: UserRole.COORDINATOR,
        department: 'ฝ่ายทะเบียนและประมวลผล / งานบริการการศึกษา',
        phone: '02-555-0155',
        isActive: true,
      },
    });

    // 2. Seed Courses
    const cpe101 = await prisma.course.create({
      data: {
        courseCode: 'CPE101',
        courseName: 'การเขียนโปรแกรมคอมพิวเตอร์เบื้องต้น (Computer Programming I)',
        instructorId: instructor1.id,
        department: 'วิศวกรรมคอมพิวเตอร์',
        semester: 1,
        academicYear: '2569',
      },
    });

    const cpe342 = await prisma.course.create({
      data: {
        courseCode: 'CPE342',
        courseName: 'วิศวกรรมซอฟต์แวร์และการทดสอบระบบ (Software Engineering & System Testing)',
        instructorId: instructor1.id,
        department: 'วิศวกรรมคอมพิวเตอร์',
        semester: 1,
        academicYear: '2569',
      },
    });

    const it201 = await prisma.course.create({
      data: {
        courseCode: 'IT201',
        courseName: 'ระบบจัดการฐานข้อมูล (Database Management Systems)',
        instructorId: instructor2.id,
        department: 'วิทยาการสารสนเทศ',
        semester: 1,
        academicYear: '2569',
      },
    });

    const gen111 = await prisma.course.create({
      data: {
        courseCode: 'GEN111',
        courseName: 'จริยธรรม ธรรมาภิบาล และสังคมดิจิทัล (Ethics & Digital Society)',
        instructorId: instructor2.id,
        department: 'ศึกษาทั่วไป',
        semester: 1,
        academicYear: '2569',
      },
    });

    // 3. Seed Exam Schedules
    const now = new Date();
    const addDays = (d: number) => {
      const target = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
      return target.toISOString().split('T')[0];
    };
    const addDaysDate = (d: number) => {
      return new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
    };

    const sched1 = await prisma.examSchedule.create({
      data: {
        courseId: cpe101.id,
        examType: 'FINAL',
        examDate: addDays(10),
        startTime: '09:00',
        endTime: '12:00',
        room: 'ห้องปฏิบัติการคอมพิวเตอร์ LAB-401, LAB-402',
        coordinatorId: coordinator.id,
        deadlineDate: addDaysDate(6).toISOString(),
        status: 'CONFIRMED',
      },
    });

    const sched2 = await prisma.examSchedule.create({
      data: {
        courseId: cpe342.id,
        examType: 'MIDTERM',
        examDate: addDays(6),
        startTime: '13:30',
        endTime: '16:30',
        room: 'ห้องเรียนรวม CB-2301',
        coordinatorId: coordinator.id,
        deadlineDate: addDaysDate(3).toISOString(),
        status: 'CONFIRMED',
      },
    });

    const sched3 = await prisma.examSchedule.create({
      data: {
        courseId: it201.id,
        examType: 'FINAL',
        examDate: addDays(14),
        startTime: '09:00',
        endTime: '12:00',
        room: 'หอประชุมใหญ่ AUD-101',
        coordinatorId: coordinator.id,
        deadlineDate: addDaysDate(10).toISOString(),
        status: 'CONFIRMED',
      },
    });

    await prisma.examSchedule.create({
      data: {
        courseId: gen111.id,
        examType: 'FINAL',
        examDate: addDays(15),
        startTime: '13:30',
        endTime: '16:30',
        room: 'ห้องบรรยายรวม CB-1101',
        coordinatorId: coordinator.id,
        deadlineDate: addDaysDate(11).toISOString(),
        status: 'CONFIRMED',
      },
    });

    // 4. Seed Exams with various realistic statuses for testing
    // Exam 1: CPE101 - SUBMITTED (Ready for AV Staff validation)
    const exam1 = await prisma.exam.create({
      data: {
        courseId: cpe101.id,
        scheduleId: sched1.id,
        fileUrl: '/uploads/mock-exam-cpe101.docx',
        originalFilename: 'CPE101_Final_Exam_2569_SetA.docx',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 245000,
        numCopies: 120,
        numPages: 6,
        specialInstructions: 'พิมพ์หน้า-หลัง กระดาษ A4 เย็บมุมบนซ้าย ห้ามแยกหน้า',
        isDoubleSided: true,
        paperSize: 'A4',
        status: ExamStatus.SUBMITTED,
        createdById: instructor1.id,
        submittedAt: new Date(now.getTime() - 2 * 3600000),
        deadlineAt: addDaysDate(6),
        statusHistory: {
          create: [
            {
              fromStatus: null,
              toStatus: ExamStatus.DRAFT,
              actionById: instructor1.id,
              actionName: 'รศ.ดร.สมชาย ใจดี',
              actionAt: new Date(now.getTime() - 4 * 3600000),
              note: 'สร้างแบบร่างข้อสอบ',
            },
            {
              fromStatus: ExamStatus.DRAFT,
              toStatus: ExamStatus.SUBMITTED,
              actionById: instructor1.id,
              actionName: 'รศ.ดร.สมชาย ใจดี',
              actionAt: new Date(now.getTime() - 2 * 3600000),
              note: 'ส่งข้อสอบให้หน่วยโสตตรวจสอบ',
            },
          ],
        },
      },
    });

    // Exam 2: CPE342 - APPROVED / "ตัดข้อสอบ" (Ready for Printing)
    const exam2 = await prisma.exam.create({
      data: {
        courseId: cpe342.id,
        scheduleId: sched2.id,
        fileUrl: '/uploads/mock-exam-cpe342.docx',
        originalFilename: 'CPE342_Midterm_Exam_2569.docx',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 184000,
        numCopies: 85,
        numPages: 4,
        specialInstructions: 'ต้องการกระดาษคำตอบ A4 เพิ่ม 85 แผ่นแยกต่างหาก',
        isDoubleSided: true,
        paperSize: 'A4',
        status: ExamStatus.APPROVED,
        createdById: instructor1.id,
        submittedAt: new Date(now.getTime() - 24 * 3600000),
        deadlineAt: addDaysDate(3),
        statusHistory: {
          create: [
            {
              fromStatus: null,
              toStatus: ExamStatus.DRAFT,
              actionById: instructor1.id,
              actionName: 'รศ.ดร.สมชาย ใจดี',
              actionAt: new Date(now.getTime() - 30 * 3600000),
              note: 'สร้างแบบร่าง',
            },
            {
              fromStatus: ExamStatus.DRAFT,
              toStatus: ExamStatus.SUBMITTED,
              actionById: instructor1.id,
              actionName: 'รศ.ดร.สมชาย ใจดี',
              actionAt: new Date(now.getTime() - 24 * 3600000),
              note: 'ส่งข้อสอบ',
            },
            {
              fromStatus: ExamStatus.SUBMITTED,
              toStatus: ExamStatus.APPROVED,
              actionById: avStaff.id,
              actionName: 'นายพงศ์สรรค์ ชำนาญพิมพ์ (AV Staff)',
              actionAt: new Date(now.getTime() - 12 * 3600000),
              note: 'ตรวจสอบไฟล์สมบูรณ์ อนุมัติและตัดข้อสอบเรียบร้อย',
            },
          ],
        },
      },
    });

    // Exam 3: IT201 - PACKED (Pack completed, ready for ready_for_pickup)
    const exam3 = await prisma.exam.create({
      data: {
        courseId: it201.id,
        scheduleId: sched3.id,
        fileUrl: '/uploads/mock-exam-it201.pdf',
        originalFilename: 'IT201_Database_Final_2569.pdf',
        fileType: 'application/pdf',
        fileSize: 412000,
        numCopies: 65,
        numPages: 5,
        specialInstructions: 'ระบุหน้าซอง 65 ชุด + ซองสำรอง 2 ชุด',
        isDoubleSided: true,
        paperSize: 'A4',
        status: ExamStatus.PACKED,
        createdById: instructor2.id,
        submittedAt: new Date(now.getTime() - 48 * 3600000),
        deadlineAt: addDaysDate(10),
        statusHistory: {
          create: [
            {
              fromStatus: null,
              toStatus: ExamStatus.SUBMITTED,
              actionById: instructor2.id,
              actionName: 'ผศ.ดร.วรรณภา มั่นคง',
              actionAt: new Date(now.getTime() - 48 * 3600000),
              note: 'ส่งข้อสอบ',
            },
            {
              fromStatus: ExamStatus.SUBMITTED,
              toStatus: ExamStatus.APPROVED,
              actionById: avStaff.id,
              actionName: 'นายพงศ์สรรค์ ชำนาญพิมพ์',
              actionAt: new Date(now.getTime() - 36 * 3600000),
              note: 'อนุมัติตัดข้อสอบ',
            },
            {
              fromStatus: ExamStatus.APPROVED,
              toStatus: ExamStatus.PRINTING,
              actionById: avStaff.id,
              actionName: 'นายพงศ์สรรค์ ชำนาญพิมพ์',
              actionAt: new Date(now.getTime() - 20 * 3600000),
              note: 'เริ่มสั่งพิมพ์',
            },
            {
              fromStatus: ExamStatus.PRINTING,
              toStatus: ExamStatus.PRINTED,
              actionById: avStaff.id,
              actionName: 'นายพงศ์สรรค์ ชำนาญพิมพ์',
              actionAt: new Date(now.getTime() - 18 * 3600000),
              note: 'พิมพ์เสร็จ 65 ชุด',
            },
            {
              fromStatus: ExamStatus.PRINTED,
              toStatus: ExamStatus.PACKED,
              actionById: avStaff.id,
              actionName: 'นายพงศ์สรรค์ ชำนาญพิมพ์',
              actionAt: new Date(now.getTime() - 10 * 3600000),
              note: 'บรรจุซองและติดใบปะหน้าซองเรียบร้อย',
            },
          ],
        },
        printRecords: {
          create: [
            {
              printedById: avStaff.id,
              printedCopies: 65,
              paperType: 'A4 80gsm หน้า-หลัง',
              printedAt: new Date(now.getTime() - 18 * 3600000),
              notes: 'พิมพ์ครบถ้วน ไม่มีปัญหา',
            },
          ],
        },
        packingRecords: {
          create: [
            {
              packedById: avStaff.id,
              envelopeCount: 2,
              packedAt: new Date(now.getTime() - 10 * 3600000),
              notes: 'บรรจุ 2 ซอง ซองละ 35 และ 30 ชุด',
            },
          ],
        },
      },
    });

    // 5. Seed Notifications
    await prisma.notification.createMany({
      data: [
        {
          userId: instructor1.id,
          type: 'EXAM_APPROVED',
          title: 'ข้อสอบวิชา CPE342 ได้รับการอนุมัติและตัดข้อสอบแล้ว',
          message: 'เจ้าหน้าที่หน่วยโสตตรวจสอบไฟล์ข้อสอบวิชา CPE342 เรียบร้อยแล้ว ขณะนี้อยู่ในคิวจัดพิมพ์',
          link: `/instructor/exams/${exam2.id}`,
          isRead: false,
          createdAt: new Date(now.getTime() - 12 * 3600000),
        },
        {
          userId: avStaff.id,
          type: 'NEW_SUBMISSION',
          title: 'มีข้อสอบใหม่รอตรวจสอบ: CPE101',
          message: 'รศ.ดร.สมชาย ใจดี ได้ส่งข้อสอบวิชา CPE101 เข้าสู่ระบบ กรุณาตรวจสอบความถูกต้องของไฟล์',
          link: `/av-staff/exams/${exam1.id}/review`,
          isRead: false,
          createdAt: new Date(now.getTime() - 2 * 3600000),
        },
      ],
    });

    // 6. Seed Audit Logs
    await prisma.auditLog.createMany({
      data: [
        {
          userId: instructor1.id,
          userName: 'รศ.ดร.สมชาย ใจดี',
          userRole: UserRole.INSTRUCTOR,
          action: 'SUBMIT_EXAM',
          entityType: 'EXAM',
          entityId: exam1.id.toString(),
          ipAddress: '127.0.0.1',
          detailJson: JSON.stringify({ course_code: 'CPE101', num_copies: 120, filename: 'CPE101_Final_Exam_2569_SetA.docx' }),
          createdAt: new Date(now.getTime() - 2 * 3600000),
        },
        {
          userId: avStaff.id,
          userName: 'นายพงศ์สรรค์ ชำนาญพิมพ์',
          userRole: UserRole.AV_STAFF,
          action: 'APPROVE_EXAM',
          entityType: 'EXAM',
          entityId: exam2.id.toString(),
          ipAddress: '127.0.0.1',
          detailJson: JSON.stringify({ course_code: 'CPE342', status: 'APPROVED', note: 'ตัดข้อสอบเรียบร้อย' }),
          createdAt: new Date(now.getTime() - 12 * 3600000),
        },
      ],
    });

    console.log('✅ [Seeder] Database seeding with Prisma completed successfully.');
  } catch (error) {
    console.error('❌ [Seeder] Seeder error:', error);
  }
}

// Allow direct execution via `npm run db:seed`
if (require.main === module) {
  seedDatabase()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error(err);
      prisma.$disconnect();
    });
}
