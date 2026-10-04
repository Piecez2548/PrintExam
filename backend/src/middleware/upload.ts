import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../config/constants';

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `exam-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.pdf', '.docx', '.doc'];

  const mimeAllowed = ALLOWED_MIME_TYPES.includes(file.mimetype) || file.mimetype === 'application/octet-stream';
  if (allowedExtensions.includes(ext) && mimeAllowed) {
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
export async function validateUploadedFileMagic(filePath: string): Promise<boolean> {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const handle = await fs.promises.open(filePath, 'r');
    const header = Buffer.alloc(8);
    await handle.read(header, 0, header.length, 0);
    await handle.close();
    if (ext === '.pdf') return header.subarray(0, 5).toString('ascii') === '%PDF-';
    if (ext === '.docx') {
      if (header[0] !== 0x50 || header[1] !== 0x4b) return false;
      const markers = [Buffer.from('[Content_Types].xml'), Buffer.from('word/document.xml')];
      const found = [false, false];
      let carry = Buffer.alloc(0);
      for await (const rawChunk of fs.createReadStream(filePath, { highWaterMark: 64 * 1024 })) {
        const chunk = Buffer.concat([carry, Buffer.from(rawChunk)]);
        markers.forEach((marker, index) => {
          if (!found[index] && chunk.includes(marker)) found[index] = true;
        });
        if (found.every(Boolean)) return true;
        carry = chunk.subarray(Math.max(0, chunk.length - 64));
      }
      return false;
    }
    if (ext === '.doc') {
      const oleHeader = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
      return header.subarray(0, oleHeader.length).equals(oleHeader);
    }
    return false;
  } catch {
    return false;
  }
}
