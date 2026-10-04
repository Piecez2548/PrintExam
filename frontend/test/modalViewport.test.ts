import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const modalSource = readFileSync(new URL('../src/components/common/Modal.tsx', import.meta.url), 'utf8');

test('modal keeps the panel inside the viewport and scrolls only its body', () => {
  assert.match(modalSource, /fixed inset-0 z-50 overflow-y-auto/);
  assert.match(modalSource, /p-4 text-center sm:p-6/);
  assert.match(modalSource, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(modalSource, /sm:max-h-\[calc\(100dvh-3rem\)\]/);
  assert.match(modalSource, /flex max-h-\[calc\(100dvh-2rem\)\].*flex-col/);
  assert.match(modalSource, /flex shrink-0 items-center justify-between/);
  assert.match(modalSource, /min-h-0 flex-1 overflow-y-auto overscroll-contain/);
  assert.doesNotMatch(modalSource, /sm:p-0/);
});
