import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateEnvelopeLabelPdf } from '../../src/services/pdfService';

const makeEnvelope = (courseCode: string, courseName: string) => ({
  examId: 1,
  labelCode: 'ENV-TEST-1-2569',
  courseCode,
  courseName,
  instructorName: 'อาจารย์ทดสอบ ภาษาไทย',
  examType: 'สอบกลางภาค (Midterm)',
  examDate: '2026-10-12',
  examTime: '09:00 - 12:00',
  room: 'LAB-401',
  deadlineDate: '2026-10-07',
  coordinatorName: 'ผู้ประสานงานทดสอบ',
  numCopies: 85,
  numPages: 4,
  paperSize: 'A4',
  isDoubleSided: true,
  specialInstructions: 'พิมพ์หน้า-หลังและตรวจสอบจำนวนชุด',
  semester: 1,
  academicYear: '2569',
  generatedBy: 'เจ้าหน้าที่ทดสอบ',
  generatedAt: '2026-10-04T00:00:00.000Z',
});

test('generates exactly one A4 portrait page with an embedded Thai font', async () => {
  const pdf = await generateEnvelopeLabelPdf(makeEnvelope('PHY101', 'Physics Lab'));
  const documentText = pdf.toString('latin1');
  const mediaBox = documentText.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);

  assert.ok(mediaBox, 'PDF should contain a MediaBox');
  assert.equal(Number(mediaBox[1]), 595.28);
  assert.equal(Number(mediaBox[2]), 841.89);
  assert.equal((documentText.match(/\/Type \/Page\b/g) || []).length, 1);
  assert.match(documentText, /NotoSansThai/);
  assert.match(documentText, /NotoSansThai-Bold/);
  assert.match(documentText, /\/ToUnicode/);
});

test('keeps dynamic data from two different exams in separate PDF outputs', async () => {
  const first = await generateEnvelopeLabelPdf(makeEnvelope('PHY101', 'Physics Lab'));
  const second = await generateEnvelopeLabelPdf(makeEnvelope('BIO202', 'Biology II'));

  assert.notDeepEqual(first, second);
  assert.notEqual(first.length, second.length);
});
