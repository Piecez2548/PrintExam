import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'path';
import { resolveUploadDir, resolveUploadFilePath } from '../../src/config/upload';

test('uses backend/uploads when UPLOAD_DIR is not configured', () => {
  assert.equal(resolveUploadDir().endsWith(path.join('backend', 'uploads')), true);
});

test('resolves a configured upload root without changing the value', () => {
  assert.equal(resolveUploadDir('/data/uploads'), path.resolve('/data/uploads'));
});

test('keeps protected file paths inside the configured upload root', () => {
  const safePath = resolveUploadFilePath('/uploads/exam-123.pdf');
  const traversalPath = resolveUploadFilePath('/uploads/../../secret.txt');
  const invalidPath = resolveUploadFilePath('/private/secret.txt');

  assert.equal(safePath?.endsWith(path.join('uploads', 'exam-123.pdf')), true);
  assert.equal(traversalPath?.endsWith(path.join('uploads', 'secret.txt')), true);
  assert.equal(invalidPath, null);
});
