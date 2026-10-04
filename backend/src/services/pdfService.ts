import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';

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
  deadlineDate?: string;
  coordinatorName?: string;
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

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const FONT_PATH = path.resolve(__dirname, '../../assets/fonts/NotoSansThai-Regular.ttf');
const BOLD_FONT_PATH = path.resolve(__dirname, '../../assets/fonts/NotoSansThai-Bold.ttf');

const COLORS = {
  navy: '#0f172a',
  ink: '#1e293b',
  muted: '#64748b',
  line: '#cbd5e1',
  pale: '#f8fafc',
  card: '#f1f5f9',
  sky: '#0369a1',
  emerald: '#047857',
  emeraldPale: '#ecfdf5',
  white: '#ffffff',
};

type TextOptions = {
  color?: string;
  size?: number;
  minSize?: number;
  align?: 'left' | 'center' | 'right';
  lineGap?: number;
  bold?: boolean;
  maxHeight?: number;
};

const valueOrDash = (value: string | number | undefined | null): string =>
  value === undefined || value === null || value === '' ? '-' : String(value);

const fontName = (bold = false): string => (bold ? 'NotoSansThaiBold' : 'NotoSansThai');

const fitText = (
  doc: PDFKit.PDFDocument,
  value: string | number | undefined | null,
  x: number,
  y: number,
  width: number,
  options: TextOptions = {},
): number => {
  const text = valueOrDash(value);
  const initialSize = options.size ?? 9;
  const minSize = options.minSize ?? Math.max(6, initialSize - 2);
  const lineGap = options.lineGap ?? 0;
  let size = initialSize;
  let height = 0;

  doc.font(fontName(options.bold));
  while (size >= minSize) {
    doc.fontSize(size);
    height = doc.heightOfString(text, { width, lineGap });
    if (!options.maxHeight || height <= options.maxHeight) break;
    size -= 0.5;
  }

  doc.font(fontName(options.bold)).fontSize(size).fillColor(options.color ?? COLORS.ink);
  doc.text(text, x, y, {
    width,
    align: options.align ?? 'left',
    lineGap,
    continued: false,
  });

  return height;
};

const drawLabel = (
  doc: PDFKit.PDFDocument,
  label: string,
  value: string | number | undefined | null,
  x: number,
  y: number,
  width: number,
  valueSize = 9,
  valueColor = COLORS.ink,
) => {
  fitText(doc, label, x, y, width, { size: 7, minSize: 6, color: COLORS.muted, bold: true });
  fitText(doc, value, x, y + 10, width, {
    size: valueSize,
    minSize: Math.max(6, valueSize - 2),
    color: valueColor,
    maxHeight: 30,
    bold: true,
  });
};

const drawFinder = (doc: PDFKit.PDFDocument, x: number, y: number, cell: number) => {
  doc.rect(x, y, cell * 7, cell * 7).fill(COLORS.navy);
  doc.rect(x + cell, y + cell, cell * 5, cell * 5).fill(COLORS.white);
  doc.rect(x + cell * 2, y + cell * 2, cell * 3, cell * 3).fill(COLORS.navy);
};

const drawTrackingCode = (doc: PDFKit.PDFDocument, x: number, y: number, size: number, seed: string) => {
  const cells = 21;
  const cell = size / cells;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;

  doc.save();
  doc.rect(x, y, size, size).fill(COLORS.white);
  drawFinder(doc, x, y, cell);
  drawFinder(doc, x + cell * 14, y, cell);
  drawFinder(doc, x, y + cell * 14, cell);

  for (let row = 0; row < cells; row += 1) {
    for (let column = 0; column < cells; column += 1) {
      const inFinder =
        (row < 8 && column < 8) ||
        (row < 8 && column >= 13) ||
        (row >= 13 && column < 8);
      if (inFinder) continue;
      hash = (hash * 1664525 + 1013904223) >>> 0;
      if ((hash & 7) < 3) doc.rect(x + column * cell, y + row * cell, cell, cell).fill(COLORS.navy);
    }
  }
  doc.restore();
};

const drawCard = (
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  valueColor = COLORS.ink,
  valueSize = 9,
) => {
  doc.roundedRect(x, y, width, height, 3).fillAndStroke(COLORS.card, COLORS.line);
  drawLabel(doc, label, value, x + 8, y + 8, width - 16, valueSize, valueColor);
};

const drawSignoffColumn = (
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  title: string,
  checks: string[],
  receiver: string,
) => {
  doc.roundedRect(x + 5, y + 5, width - 10, 22, 2).fill(COLORS.card);
  fitText(doc, title, x + 10, y + 10, width - 20, { size: 7.4, minSize: 6.2, color: COLORS.ink });

  checks.forEach((check, index) => {
    const checkY = y + 38 + index * 17;
    doc.rect(x + 10, checkY, 9, 9).lineWidth(0.7).stroke(COLORS.muted);
    fitText(doc, check, x + 25, checkY - 2, width - 35, { size: 7, minSize: 5.8, color: COLORS.muted });
  });

  fitText(doc, receiver, x + 10, y + 83, width - 20, { size: 7, minSize: 5.8, color: COLORS.muted, maxHeight: 22 });
  fitText(doc, 'ลงนาม: ................................', x + 10, y + 112, width - 20, { size: 7, minSize: 5.8, color: COLORS.muted });
  fitText(doc, 'วันที่: ...... / ...... / ..........', x + 10, y + 132, width - 20, { size: 7, minSize: 5.8, color: COLORS.muted });
};

export function generateEnvelopeLabelPdf(details: EnvelopeDetails): Promise<Buffer> {
  if (!fs.existsSync(FONT_PATH) || !fs.existsSync(BOLD_FONT_PATH)) {
    return Promise.reject(new Error(`Required Thai PDF fonts are missing: ${FONT_PATH}`));
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'portrait',
        margin: 0,
        compress: true,
        info: {
          Title: `Cover Sheet ${details.courseCode}`,
          Subject: 'PrintExam Cover Sheet',
          Creator: 'PrintExam',
        },
      });

      doc.registerFont('NotoSansThai', FONT_PATH);
      doc.registerFont('NotoSansThaiBold', BOLD_FONT_PATH);
      doc.font('NotoSansThai');

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const frame = { x: 18, y: 18, width: PAGE_WIDTH - 36, height: PAGE_HEIGHT - 36 };
      const content = { x: 22, width: PAGE_WIDTH - 44 };
      const right = content.x + content.width;

      doc.rect(frame.x, frame.y, frame.width, frame.height).lineWidth(1.3).stroke(COLORS.navy);
      doc.rect(frame.x + 3, frame.y + 3, frame.width - 6, frame.height - 6).lineWidth(0.5).stroke(COLORS.muted);

      let y = 22;
      const headerHeight = 58;
      doc.rect(content.x, y, content.width, headerHeight).fill(COLORS.navy);
      doc.circle(content.x + 25, y + 29, 14).fillAndStroke('#1e293b', '#64748b');
      fitText(doc, 'U', content.x + 17, y + 20, 16, { size: 13, color: COLORS.white, align: 'center', bold: true });
      fitText(doc, 'UNIVERSITY EXAMINATION CENTER', content.x + 49, y + 12, 290, { size: 12, minSize: 9, color: COLORS.white, bold: true });
      fitText(doc, 'ศูนย์ประสานงานการสอบและพิมพ์ข้อสอบมาตรฐานมหาวิทยาลัย', content.x + 49, y + 32, 300, { size: 7.2, minSize: 5.8, color: '#cbd5e1' });

      const badgeWidth = 176;
      const badgeX = right - badgeWidth - 8;
      doc.roundedRect(badgeX, y + 10, badgeWidth, 20, 3).fillAndStroke('#164e63', '#38bdf8');
      fitText(doc, 'ใบปะหน้าซองข้อสอบมาตรฐาน (FORM EXAM-01)', badgeX + 6, y + 15, badgeWidth - 12, { size: 7.2, minSize: 5.7, color: '#7dd3fc', align: 'center' });
      fitText(doc, `ภาคเรียนที่ ${details.semester} ปีการศึกษา ${details.academicYear}`, badgeX, y + 36, badgeWidth, { size: 7, minSize: 5.8, color: '#cbd5e1', align: 'right' });
      y += headerHeight;

      const courseHeight = 91;
      doc.rect(content.x, y, content.width, courseHeight).fillAndStroke(COLORS.pale, COLORS.navy);
      const trackingWidth = 126;
      const courseWidth = content.width - trackingWidth - 12;
      fitText(doc, 'รหัสวิชา:', content.x + 10, y + 12, 54, { size: 7, color: COLORS.muted });
      fitText(doc, details.courseCode, content.x + 67, y + 8, courseWidth - 67, { size: 16, minSize: 11, color: COLORS.sky, bold: true });
      fitText(doc, 'ชื่อวิชา:', content.x + 10, y + 37, 54, { size: 7, color: COLORS.muted });
      fitText(doc, details.courseName, content.x + 67, y + 34, courseWidth - 75, { size: 9.5, minSize: 7, color: COLORS.ink, maxHeight: 27, lineGap: 1, bold: true });
      fitText(doc, `อาจารย์ผู้สอน: ${details.instructorName}`, content.x + 10, y + 69, (courseWidth / 2) - 14, { size: 7, minSize: 5.8, color: COLORS.ink, maxHeight: 18 });
      fitText(doc, `ประเภทการสอบ: ${details.examType}`, content.x + courseWidth / 2, y + 69, (courseWidth / 2) - 8, { size: 7, minSize: 5.8, color: COLORS.ink, maxHeight: 18 });

      const trackingX = content.x + courseWidth + 12;
      doc.roundedRect(trackingX, y + 8, trackingWidth - 10, courseHeight - 16, 3).fillAndStroke(COLORS.white, COLORS.line);
      drawTrackingCode(doc, trackingX + 43, y + 14, 39, details.labelCode);
      fitText(doc, details.labelCode, trackingX + 8, y + 57, trackingWidth - 26, { size: 6.4, minSize: 5.3, color: COLORS.ink, align: 'center' });
      fitText(doc, 'SECURITY VERIFIED', trackingX + 8, y + 70, trackingWidth - 26, { size: 5.8, minSize: 5, color: COLORS.muted, align: 'center' });
      y += courseHeight;

      const scheduleHeight = 112;
      doc.rect(content.x, y, content.width, scheduleHeight).fillAndStroke(COLORS.white, COLORS.navy);
      const gap = 6;
      const cardWidth = (content.width - gap * 3 - 16) / 4;
      const cardY = y + 10;
      drawCard(doc, content.x + 8, cardY, cardWidth, 58, 'วันสอบ (Exam Date)', details.examDate);
      drawCard(doc, content.x + 8 + cardWidth + gap, cardY, cardWidth, 58, 'เวลาสอบ (Time)', details.examTime);
      drawCard(doc, content.x + 8 + (cardWidth + gap) * 2, cardY, cardWidth, 58, 'ห้องสอบ (Exam Room)', details.room, COLORS.sky);
      drawCard(doc, content.x + 8 + (cardWidth + gap) * 3, cardY, cardWidth, 58, 'กำหนดส่งไฟล์ (Deadline)', valueOrDash(details.deadlineDate), COLORS.ink, 8.5);
      doc.roundedRect(content.x + 8, y + 76, content.width - 16, 27, 3).fillAndStroke(COLORS.pale, COLORS.line);
      drawLabel(doc, 'ผู้ประสานงานการสอบ (Coordinator)', details.coordinatorName || 'ยังไม่กำหนด', content.x + 16, y + 81, content.width - 32, 8.5);
      y += scheduleHeight;

      const specsHeight = 82;
      doc.rect(content.x, y, content.width, specsHeight).fillAndStroke(COLORS.emeraldPale, COLORS.navy);
      fitText(doc, 'รายละเอียดการจัดพิมพ์และจำนวนชุด', content.x + 10, y + 10, 260, { size: 8, minSize: 7, color: '#065f46', bold: true });
      const specGap = 8;
      const specWidth = (content.width - 20 - specGap * 3) / 4;
      const specX = content.x + 10;
      drawLabel(doc, 'จำนวนที่พิมพ์:', `${details.numCopies} ชุด`, specX, y + 29, specWidth, 13, COLORS.emerald);
      drawLabel(doc, 'จำนวนหน้า/ชุด:', `${details.numPages} หน้า`, specX + specWidth + specGap, y + 29, specWidth, 9);
      drawLabel(doc, 'รูปแบบการพิมพ์:', `${details.isDoubleSided ? 'หน้า-หลัง (Double)' : 'หน้าเดียว (Single)'} [${details.paperSize}]`, specX + (specWidth + specGap) * 2, y + 29, specWidth, 7.8);
      drawLabel(doc, 'หมายเหตุพิเศษ:', details.specialInstructions || '-', specX + (specWidth + specGap) * 3, y + 29, specWidth, 7, COLORS.muted);
      y += specsHeight;

      const signoffHeight = 181;
      doc.rect(content.x, y, content.width, signoffHeight).fillAndStroke(COLORS.white, COLORS.navy);
      const columnWidth = content.width / 3;
      doc.moveTo(content.x + columnWidth, y).lineTo(content.x + columnWidth, y + signoffHeight).lineWidth(0.6).stroke(COLORS.line);
      doc.moveTo(content.x + columnWidth * 2, y).lineTo(content.x + columnWidth * 2, y + signoffHeight).lineWidth(0.6).stroke(COLORS.line);
      drawSignoffColumn(doc, content.x, y, columnWidth, '1. หน่วยโสตทัศนศึกษา (พิมพ์ & บรรจุ)', [
        `ตรวจจำนวนครบถ้วน (${details.numCopies} ชุด)`,
        'ปิดผนึกซองและซีลเรียบร้อย',
      ], `ผู้บรรจุ: ${details.generatedBy}`);
      drawSignoffColumn(doc, content.x + columnWidth, y, columnWidth, '2. การส่งมอบข้อสอบ (Dispatch)', [
        'ส่งมอบซองข้อสอบครบตามจำนวน',
        'ซีลอยู่ในสภาพสมบูรณ์ ไม่มีการเปิด',
      ], 'ผู้ส่งมอบ: ................................');
      drawSignoffColumn(doc, content.x + columnWidth * 2, y, columnWidth, '3. จนท.ดำเนินการสอบ (ผู้รับมอบ)', [
        'ได้รับซองข้อสอบตามวิชา/ห้องสอบ',
        'นำส่งเข้าห้องสอบตามกำหนดการ',
      ], `ผู้รับมอบ: ${details.coordinatorName || '................................'}`);

      fitText(doc, `PrintExam • ${details.labelCode} • ${details.generatedAt.split('T')[0]}`, content.x, PAGE_HEIGHT - 34, content.width, { size: 5.5, minSize: 5, color: COLORS.muted, align: 'right' });
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
