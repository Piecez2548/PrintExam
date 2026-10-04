import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCoverSheetPrintDocument } from '../src/utils/printCoverSheet';

test('print document preserves the selected cover-sheet record dynamically', () => {
  const examA = '<div id="printable-envelope">PHY101|Physics Lab|2026-10-04</div>';
  const examB = '<div id="printable-envelope">BIO202|Biology II|2026-10-29</div>';

  const printedA = buildCoverSheetPrintDocument(examA, '<style>.text-slate-900{color:#0f172a}</style>');
  const printedB = buildCoverSheetPrintDocument(examB, '<style>.text-slate-900{color:#0f172a}</style>');

  assert.notEqual(printedA, printedB);
  assert.match(printedA, /PHY101/);
  assert.match(printedA, /Physics Lab/);
  assert.doesNotMatch(printedA, /BIO202/);
  assert.match(printedB, /BIO202/);
  assert.match(printedB, /Biology II/);
  assert.doesNotMatch(printedB, /PHY101/);
  assert.match(printedA, /@page \{ size: A4 portrait;/);
  assert.match(printedA, /id="printable-envelope"/);
  assert.doesNotMatch(printedA, /Reports|Navbar|dashboard/i);
});
