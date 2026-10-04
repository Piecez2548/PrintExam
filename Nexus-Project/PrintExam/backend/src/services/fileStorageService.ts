import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const uploadDir = path.join(__dirname, '../../uploads');

function storageDriver(): 'local' | 'supabase' {
  return process.env.STORAGE_DRIVER === 'supabase' ? 'supabase' : 'local';
}
function supabaseClient(): SupabaseClient {
  const { url, key } = supabaseCredentials();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function supabaseCredentials(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase storage');
  return { url, key };
}

function bucketName(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || 'exam-documents';
}

export async function persistExamUpload(file: Express.Multer.File): Promise<string> {
  const routeUrl = `/uploads/${file.filename}`;
  if (storageDriver() === 'local') return routeUrl;

  // Stream to Storage instead of loading a potentially 50 MB exam into RAM.
  const { url, key } = supabaseCredentials();
  const objectPath = `${encodeURIComponent(bucketName())}/exams/${encodeURIComponent(file.filename)}`;
  const response = await fetch(`${url}/storage/v1/object/${objectPath}`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': file.mimetype,
      'x-upsert': 'false',
    },
    body: fs.createReadStream(file.path) as any,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Unable to save exam file to object storage (${response.status}): ${detail}`);
  }
  await fs.promises.unlink(file.path).catch(() => undefined);
  return routeUrl;
}

export async function deleteStoredExamFile(fileUrl?: string | null): Promise<void> {
  if (!fileUrl || !fileUrl.startsWith('/uploads/exam-')) return;
  const filename = path.basename(fileUrl);
  if (storageDriver() === 'supabase') {
    await supabaseClient().storage.from(bucketName()).remove([`exams/${filename}`]);
    return;
  }
  await fs.promises.unlink(path.join(uploadDir, filename)).catch(() => undefined);
}

export async function createExamFileDownloadUrl(filename: string): Promise<string | null> {
  if (storageDriver() !== 'supabase') return null;
  const { data, error } = await supabaseClient().storage
    .from(bucketName())
    .createSignedUrl(`exams/${filename}`, 60);
  if (error) throw new Error(`Unable to create protected download URL: ${error.message}`);
  return data.signedUrl;
}
