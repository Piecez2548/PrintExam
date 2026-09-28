import fs from 'fs';
import path from 'path';

const DEFAULT_UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

export function resolveUploadDir(configuredDir?: string): string {
  const value = configuredDir?.trim();
  return value ? path.resolve(value) : DEFAULT_UPLOAD_DIR;
}

export function getUploadDir(): string {
  return resolveUploadDir(process.env.UPLOAD_DIR);
}

export function ensureUploadDir(): string {
  const uploadDir = getUploadDir();
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
}

export function resolveUploadFilePath(fileUrl: string | null): string | null {
  const uploadPrefix = '/uploads/';
  if (!fileUrl || !fileUrl.startsWith(uploadPrefix)) return null;

  const filename = path.basename(fileUrl.slice(uploadPrefix.length));
  if (!filename || filename === '.' || filename === '..') return null;

  const uploadDir = getUploadDir();
  const filePath = path.resolve(uploadDir, filename);
  if (filePath !== uploadDir && !filePath.startsWith(`${uploadDir}${path.sep}`)) return null;
  return filePath;
}
