import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import { ProfileEditModal } from '../src/components/profile/ProfileEditModal';
import { UserRole } from '../src/types';

const modalSource = readFileSync(new URL('../src/components/common/Modal.tsx', import.meta.url), 'utf8');

test('modal keeps the panel inside the viewport and scrolls only its body', () => {
  assert.match(modalSource, /fixed inset-0 z-50 overflow-y-auto/);
  assert.match(modalSource, /p-4 text-center sm:p-6/);
  assert.match(modalSource, /h-\[calc\(100dvh-2rem\)\]/);
  assert.match(modalSource, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(modalSource, /sm:max-h-\[calc\(100dvh-3rem\)\]/);
  assert.match(modalSource, /relative flex h-\[calc\(100dvh-2rem\)\][\s\S]*flex-col/);
  assert.match(modalSource, /flex shrink-0 items-center justify-between/);
  assert.match(modalSource, /min-h-0 flex-1 overflow-y-auto overscroll-contain/);
  assert.doesNotMatch(modalSource, /sm:p-0/);
});

test('ProfileEditModal renders inside the constrained modal body with reachable actions', () => {
  const html = renderToStaticMarkup(
    React.createElement(ProfileEditModal, {
      user: {
        id: 2,
        username: 'instructor',
        full_name: 'Instructor Demo',
        email: 'instructor@example.com',
        role: UserRole.INSTRUCTOR,
        department: 'Engineering',
        phone: '0812345678',
        is_active: true,
        created_at: '2026-10-04T00:00:00.000Z',
      },
      isOpen: true,
      onClose: () => undefined,
      onSubmit: async () => undefined,
    })
  );

  const overlayIndex = html.indexOf('data-testid="modal-overlay"');
  const panelIndex = html.indexOf('data-testid="modal-panel"');
  const headerIndex = html.indexOf('data-testid="modal-header"');
  const bodyIndex = html.indexOf('data-testid="modal-body"');
  const actionsIndex = html.indexOf('data-testid="profile-edit-actions"');

  assert.ok(overlayIndex >= 0);
  assert.ok(panelIndex > overlayIndex);
  assert.ok(headerIndex > panelIndex);
  assert.ok(bodyIndex > headerIndex);
  assert.ok(actionsIndex > bodyIndex);
  assert.match(html, /name="username"|value="instructor"/);
  assert.match(html, /ชื่อ-นามสกุล/);
  assert.match(html, /อีเมล/);
  assert.match(html, /หน่วยงาน \/ ภาควิชา/);
  assert.match(html, /เบอร์โทรศัพท์/);
  assert.match(html, /บันทึกข้อมูล/);
  assert.match(html, /ยกเลิก/);
});
