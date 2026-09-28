import PDFDocument from 'pdfkit';
import { db } from '../config/database';

export interface EnvelopeDetails {
  examId: number;
  labelCode: string;
  courseCode: string;
  courseName: string;
  instructorName: string;
  examType: string;
  examDate: string;
  examTime: string;
  room: string;
  numCopies: number;
  numPages: number;
  paperSize: string;
  isDoubleSided: boolean;
  specialInstructions?: string;
  semester: number;
  academicYear: string;
  generatedBy: string;
  generatedAt: string;
}

export function generateEnvelopeLabelPdf(details: EnvelopeDetails): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 30,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Border and Outer Frame (Official envelope label box)
      doc.rect(20, 20, 802, 555).lineWidth(2).stroke('#1e293b');
      doc.rect(24, 24, 794, 547).lineWidth(0.8).stroke('#64748b');

      // Header Banner
      doc.rect(24, 24, 794, 70).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
         .text('UNIVERSITY EXAMINATION CENTER - OFFICIAL ENVELOPE LABEL', 30, 38, { align: 'center', width: 782 });
      doc.fontSize(14).font('Helvetica')
         .text('ใบปะหน้าซองข้อสอบมาตรฐานประจำห้องสอบ', 30, 62, { align: 'center', width: 782 });

      // Tracking Code & QR representation box
      doc.rect(630, 105, 175, 80).lineWidth(1).stroke('#0284c7');
      doc.fillColor('#0284c7').fontSize(9).font('Helvetica-Bold')
         .text('SECURITY TRACKING CODE', 635, 112, { align: 'center', width: 165 });
      doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold')
         .text(details.labelCode, 635, 128, { align: 'center', width: 165 });
      doc.fontSize(8).font('Helvetica')
         .text(`REF ID: EXAM-${details.examId}`, 635, 148, { align: 'center', width: 165 });
      doc.text(`DATE: ${details.generatedAt.split('T')[0]}`, 635, 162, { align: 'center', width: 165 });

      // Main Course Information Box
      doc.fillColor('#0f172a');
      let y = 110;

      doc.fontSize(12).font('Helvetica-Bold').text('COURSE CODE / รหัสวิชา:', 40, y);
      doc.fontSize(16).fillColor('#0369a1').text(details.courseCode, 210, y - 2);

      y += 30;
      doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text('COURSE NAME / ชื่อวิชา:', 40, y);
      doc.fontSize(12).font('Helvetica').text(details.courseName, 210, y);

      y += 26;
      doc.fontSize(11).font('Helvetica-Bold').text('INSTRUCTOR / อาจารย์ผู้สอน:', 40, y);
      doc.fontSize(12).font('Helvetica').text(details.instructorName, 210, y);

      y += 26;
      doc.fontSize(11).font('Helvetica-Bold').text('TERM / ภาคการศึกษา:', 40, y);
      doc.fontSize(12).font('Helvetica').text(`Semester ${details.semester} / Academic Year ${details.academicYear}`, 210, y);

      // Dividing Line
      y += 22;
      doc.moveTo(35, y).lineTo(615, y).lineWidth(0.5).stroke('#cbd5e1');

      // Schedule and Room Box
      y += 15;
      doc.rect(35, y, 580, 75).fillAndStroke('#f8fafc', '#94a3b8');
      doc.fillColor('#0f172a');

      doc.fontSize(11).font('Helvetica-Bold').text('EXAM TYPE:', 50, y + 10);
      doc.fontSize(12).font('Helvetica').text(details.examType, 160, y + 10);

      doc.fontSize(11).font('Helvetica-Bold').text('EXAM DATE:', 320, y + 10);
      doc.fontSize(12).font('Helvetica').text(details.examDate, 420, y + 10);

      doc.fontSize(11).font('Helvetica-Bold').text('TIME:', 50, y + 35);
      doc.fontSize(12).font('Helvetica').text(details.examTime, 160, y + 35);

      doc.fontSize(11).font('Helvetica-Bold').text('EXAM ROOM:', 320, y + 35);
      doc.fontSize(12).fillColor('#b91c1c').font('Helvetica-Bold').text(details.room, 420, y + 35);

      // Quantities & Printing Specs Box
      y += 90;
      doc.fillColor('#0f172a');
      doc.rect(35, y, 770, 75).fillAndStroke('#f0fdf4', '#86efac');

      doc.fontSize(11).fillColor('#14532d').font('Helvetica-Bold').text('PRINT SPECIFICATIONS & QUANTITY / รายละเอียดจำนวนการพิมพ์', 50, y + 8);

      doc.fillColor('#0f172a');
      doc.fontSize(11).font('Helvetica-Bold').text('COPIES / จำนวนชุด:', 50, y + 30);
      doc.fontSize(16).fillColor('#15803d').font('Helvetica-Bold').text(`${details.numCopies} ชุด (Copies)`, 170, y + 26);

      doc.fillColor('#0f172a');
      doc.fontSize(11).font('Helvetica-Bold').text('PAGES / จำนวนหน้า:', 320, y + 30);
      doc.fontSize(12).font('Helvetica').text(`${details.numPages} หน้า / ชุด`, 440, y + 30);

      doc.fontSize(11).font('Helvetica-Bold').text('PRINT TYPE / รูปแบบ:', 570, y + 30);
      doc.fontSize(12).font('Helvetica').text(`${details.isDoubleSided ? 'หน้า-หลัง (Double)' : 'หน้าเดียว (Single)'} [${details.paperSize}]`, 700, y + 30);

      if (details.specialInstructions) {
        doc.fontSize(10).font('Helvetica-Oblique').fillColor('#475569')
           .text(`Special Notes: ${details.specialInstructions}`, 50, y + 55, { width: 740, lineBreak: false });
      }

      // Verification Checkboxes & Signatures Area
      y += 90;
      doc.rect(35, y, 770, 140).lineWidth(1).stroke('#94a3b8');

      // Column 1: AV Staff Packing Sign-off
      doc.rect(35, y, 256, 25).fill('#e2e8f0');
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold')
         .text('1. AV STAFF / หน่วยโสตทัศนูปกรณ์', 40, y + 8);
      doc.fontSize(9).font('Helvetica').fillColor('#334155')
         .text('[ X ] ตรวจสอบจำนวนครบถ้วนสมบูรณ์', 45, y + 35)
         .text('[ X ] บรรจุซองและปิดผนึกซีลเรียบร้อย', 45, y + 55)
         .text(`ผู้พิมพ์/บรรจุ: ${details.generatedBy}`, 45, y + 80)
         .text('ลงนาม: .................................................', 45, y + 105)
         .text(`วันที่: ${details.generatedAt.split('T')[0]}`, 45, y + 122);

      // Column 2: Handover / Dispatch
      doc.rect(291, y, 256, 25).fill('#e2e8f0');
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold')
         .text('2. DISPATCH / การส่งมอบข้อสอบ', 296, y + 8);
      doc.fontSize(9).font('Helvetica').fillColor('#334155')
         .text('[   ] ส่งมอบข้อสอบให้ฝ่ายดำเนินการสอบ', 300, y + 35)
         .text('[   ] ซีลซองอยู่ในสภาพสมบูรณ์ ไม่มีการเปิด', 300, y + 55)
         .text('ผู้ส่งมอบ: ...........................................', 300, y + 80)
         .text('ลงนาม: .................................................', 300, y + 105)
         .text('วันที่: ...... / ...... / ..........  เวลา: ..........', 300, y + 122);

      // Column 3: Exam Coordinator Receiving Sign-off
      doc.rect(547, y, 258, 25).fill('#e2e8f0');
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold')
         .text('3. COORDINATOR / จนท.ดำเนินการสอบ', 552, y + 8);
      doc.fontSize(9).font('Helvetica').fillColor('#334155')
         .text('[   ] ได้รับซองข้อสอบครบถ้วนตามรายการ', 555, y + 35)
         .text('[   ] ตรวจสอบรหัสวิชาและห้องสอบถูกต้อง', 555, y + 55)
         .text('ผู้รับมอบ: ...........................................', 555, y + 80)
         .text('ลงนาม: .................................................', 555, y + 105)
         .text('วันที่: ...... / ...... / ..........  เวลา: ..........', 555, y + 122);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
