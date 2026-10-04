import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateEnvelopeLabelPdf } from '../../src/services/pdfService';

const sampleEnvelope = {
  examId: 1,
  labelCode: 'ENV-TEST-1-2569',
  courseCode: 'TEST-101',
  courseName: 'Test Course',
  instructorName: 'Test Instructor',
  examType: 'สอบกลางภาค (Midterm)',
  examDate: '2026-10-12',
  examTime: '09:00 - 12:00',
  room: 'LAB-401',
  deadlineDate: '2026-10-07',
  coordinatorName: 'Test Coordinator',
  numCopies: 1,
  numPages: 1,
  paperSize: 'A4',
  isDoubleSided: false,
  specialInstructions: 'ไม่มี',
  semester: 1,
  academicYear: '2569',
  generatedBy: 'Test Admin',
  generatedAt: '2026-10-04T00:00:00.000Z',
};

test('generates one A4 portrait page for standalone cover-sheet printing', async () => {
  const pdf = await generateEnvelopeLabelPdf(sampleEnvelope);
  const documentText = pdf.toString('latin1');
  const mediaBox = documentText.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);

  assert.ok(mediaBox, 'PDF should contain a MediaBox');
  assert.equal(Number(mediaBox[1]), 595.28);
  assert.equal(Number(mediaBox[2]), 841.89);
  assert.equal((documentText.match(/\/Type \/Page\b/g) || []).length, 1);
});
