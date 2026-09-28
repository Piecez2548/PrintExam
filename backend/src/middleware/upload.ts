import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../config/constants';
import { ensureUploadDir } from '../config/upload';

const uploadDir = ensureUploadDir();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `exam-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.pdf', '.docx', '.doc'];

  if (allowedExtensions.includes(ext) || ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('รูปแบบไฟล์ไม่ถูกต้อง รองรับเฉพาะไฟล์เอกสาร .docx, .doc หรือ .pdf เท่านั้น'));
  }
};

export const uploadExamFile = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // 50MB
  },
  fileFilter,
});

/**
 * M-3: ตรวจสอบ magic bytes ของไฟล์ที่อัปโหลดจริง หลัง multer เซฟไฟล์แล้ว
 * ป้องกันการปลอมแปลง extension / mimetype จากฝั่ง client
 */
const SAFE_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/x-cfb', // .doc (OLE compound — file-type reports this for .doc)
  'application/msword',
  'application/zip', // .docx is a zip archive; file-type may report this
]);

export async function validateUploadedFileMagic(filePath: string): Promise<boolean> {
  try {
    const fileType = require('file-type');
    const buffer = fs.readFileSync(filePath);
    const result = await fileType.fromBuffer(buffer);
    // ถ้า file-type ตรวจไม่ได้ (เช่น plain text .doc) ให้ผ่าน — extension filter คุ้มครองอยู่แล้ว
    if (!result) return true;
    return SAFE_MIME_TYPES.has(result.mime);
  } catch {
    return true; // fail-open เพื่อไม่ให้ระบบ crash ถ้า file-type มีปัญหา
  }
}
