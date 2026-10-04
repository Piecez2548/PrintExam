import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

export interface EnvelopeDetails {
  examId: number;
  labelCode: string;
  courseCode: string;
  courseName: string;
  instructorName: string;
  instructorPhone?: string;
  officeRoom?: string;
  facultyName?: string;
  examType: string;
  examDate: string;
  examTime: string;
  room: string;
  section?: string;
  studentCount: number;
  reserveCopies: number;
  numCopies: number;
  numPages: number;
  paperSize: string;
  printFormat: string;
  examLanguage: string;
  allowedMaterials?: string;
  requiresAnswerSheet: boolean;
  specialInstructions?: string;
  semester: number;
  academicYear: string;
  generatedBy: string;
  generatedAt: string;
}

const thaiFontCandidates = [
  process.env.PDF_THAI_FONT_PATH,
  path.join(__dirname, '../../assets/fonts/NotoSansThai.ttf'),
  'C:/Windows/Fonts/LeelawUI.ttf',
  '/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf',
  '/usr/share/fonts/opentype/noto/NotoSansThai-Regular.otf',
].filter(Boolean) as string[];

const thaiFontPath = thaiFontCandidates.find((candidate) => fs.existsSync(candidate));
const psuLogoPath = path.join(__dirname, '../../assets/images/psu-official-logo.png');

function materialText(raw?: string): string {
  if (!raw) return '-';
  const labels: Record<string, string> = {
    RULER: 'อนุญาตไม้บรรทัด',
    BOOK: 'อนุญาตนำตำราเข้าห้องสอบ',
    CALCULATOR: 'อนุญาตเครื่องคิดเลข',
    NO_FORMULA_RULER: 'ไม่อนุญาตไม้บรรทัดสูตร',
    NONE: 'ไม่มีอุปกรณ์เพิ่มเติม',
  };
  try {
    const values = JSON.parse(raw) as string[];
    return values.map((value) => value.startsWith('OTHER:') ? value.slice(6) : labels[value] || value).join(', ') || '-';
  } catch {
    return raw;
  }
}

export function generateEnvelopeLabelPdf(details: EnvelopeDetails): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 28 });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      if (thaiFontPath) doc.registerFont('Thai', thaiFontPath);
      const font = thaiFontPath ? 'Thai' : 'Helvetica';
      const line = (x1: number, y: number, x2: number) => doc.moveTo(x1, y).lineTo(x2, y).lineWidth(0.45).dash(1.5, { space: 1.5 }).stroke('#334155').undash();
      const value = (text: string, x: number, y: number, width: number, size = 10) => doc.font(font).fontSize(size).fillColor('#0f172a').text(text || '-', x, y, { width, height: 16, ellipsis: true });
      const label = (text: string, x: number, y: number, width = 110) => doc.font(font).fontSize(9.5).fillColor('#0f172a').text(text, x, y, { width });
      const rawDate = new Date(details.examDate);
      const validDate = !Number.isNaN(rawDate.getTime());
      const day = validDate ? String(rawDate.getDate()) : details.examDate;
      const month = validDate ? rawDate.toLocaleDateString('th-TH', { month: 'long' }) : '-';
      const buddhistYear = validDate ? String(rawDate.getFullYear() + 543) : details.academicYear;
      const material = materialText(details.allowedMaterials);

      doc.rect(30, 20, 535, 800).lineWidth(1.1).stroke('#0f172a');
      if (fs.existsSync(psuLogoPath)) doc.image(psuLogoPath, 280, 28, { fit: [36, 60], align: 'center', valign: 'center' });
      doc.font(font).fillColor('#0f172a').fontSize(13).text('คณะวิทยาศาสตร์', 40, 88, { align: 'center', width: 515 });
      doc.font(font).fontSize(12).text('มหาวิทยาลัยสงขลานครินทร์', 40, 108, { align: 'center', width: 515 });

      label('การสอบวิชา', 48, 140, 60); value(details.courseName, 108, 138, 300, 11); line(105, 157, 407);
      label('รหัสวิชา', 420, 140, 55); value(details.courseCode, 474, 138, 73, 11); line(472, 157, 548);
      label('สอบวันที่', 48, 168, 55); value(day, 102, 166, 43); line(99, 185, 145);
      label('เดือน', 153, 168, 35); value(month, 188, 166, 100); line(186, 185, 286);
      label('พ.ศ.', 296, 168, 32); value(buddhistYear, 328, 166, 55); line(326, 185, 382);
      label('เวลา', 394, 168, 32); value(`${details.examTime} น.`, 426, 166, 122); line(424, 185, 548);
      label('ห้องสอบ', 48, 196, 48); value(details.room, 96, 194, 190); line(94, 213, 286);
      label('เลขประจำซอง', 300, 196, 72); value(details.labelCode, 372, 194, 176, 9); line(370, 213, 548);
      label('จำนวนนักศึกษา', 48, 224, 85); value(String(details.studentCount), 132, 222, 52, 11); line(130, 241, 183); label('คน', 188, 224, 25);
      label('นศ.คณะ', 48, 252, 50); value(details.facultyName || 'วิทยาศาสตร์', 98, 250, 132, 10); line(96, 269, 230);
      label('ตอน', 242, 252, 28); value(details.section || '-', 270, 250, 50, 10); line(268, 269, 320);
      label('ซองนี้มีข้อสอบ', 334, 252, 82); value(String(details.numCopies), 416, 250, 52, 11); line(414, 269, 467); label('ชุด', 474, 252, 25);
      label('ข้อสอบสำรอง', 48, 280, 72); value(String(details.reserveCopies), 120, 278, 45, 11); line(118, 297, 164); label('ชุด', 170, 280, 25);

      doc.font(font).fontSize(11).text('อุปกรณ์ที่ใช้หรือคำแนะนำผู้คุมสอบเพิ่มเติม', 48, 310, { align: 'center', width: 500 });
      const option = (text: string, x: number, y: number, checked: boolean) => {
        doc.font(font).fontSize(9).text(checked ? '( / )' : '(   )', x, y - 1, { width: 25 });
        doc.font(font).fontSize(8.7).text(text, x + 28, y - 1, { width: 206 });
      };
      option('นำตำราเข้าห้องสอบได้', 60, 338, material.includes('ตำรา'));
      option('นำเครื่องคิดเลขเข้าห้องสอบได้', 60, 361, material.includes('เครื่องคิดเลข'));
      option('ห้ามนำไม้บรรทัดมีสูตรคณิตศาสตร์เข้าห้องสอบ', 60, 384, material.includes('ไม่อนุญาตไม้บรรทัดสูตร'));
      option(details.specialInstructions || 'อื่น ๆ โปรดระบุ', 315, 338, Boolean(details.specialInstructions));
      option('', 315, 361, false); line(346, 373, 538);
      option('', 315, 384, false); line(346, 396, 538);

      label('ผู้ออกข้อสอบ', 48, 411, 68); value(details.instructorName, 116, 409, 432, 10); line(114, 428, 548);
      label('ห้องทำงาน', 48, 439, 58); value(details.officeRoom || '', 106, 437, 180, 10); line(104, 456, 286);
      label('โทรศัพท์/มือถือ', 300, 439, 82); value(details.instructorPhone || '', 382, 437, 166, 10); line(380, 456, 548);

      doc.rect(42, 462, 511, 300).lineWidth(0.8).stroke('#0f172a');
      label('จำนวนนักศึกษาที่เข้าสอบ', 52, 476, 125); line(177, 493, 232); label('คน', 236, 476, 25);
      label('จำนวนนักศึกษาที่ขาดสอบ', 282, 476, 136); line(418, 493, 468); label('คน  คือ', 474, 476, 55);
      doc.font(font).fontSize(9).text('รหัส', 70, 509, { width: 120, align: 'center' });
      doc.font(font).fontSize(9).text('ชื่อ-สกุล', 215, 509, { width: 310, align: 'center' });
      [535, 563, 591].forEach((y, index) => {
        doc.font(font).fontSize(9).text(`${index + 1}.`, 57, y - 8);
        line(72, y, 200); line(215, y, 535);
      });
      [1, 2, 3].forEach((number, index) => {
        const y = 620 + index * 28;
        doc.font(font).fontSize(9).text(`${number}.`, 185, y - 8, { width: 18, align: 'right' });
        line(208, y, 455);
        doc.font(font).fontSize(9).text('ผู้คุมสอบ', 465, y - 8, { width: 70 });
      });
      doc.font(font).fontSize(9).text('หมายเหตุ', 52, 714);
      line(102, 726, 535); line(52, 747, 535);

      doc.font(font).fontSize(7.5).fillColor('#64748b').text(`EXAM-${details.examId} | ${details.generatedAt.replace('T', ' ').slice(0, 16)}`, 42, 790, { align: 'right', width: 506 });
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
