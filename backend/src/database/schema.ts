import { connectPrisma } from './prisma';

export async function initializeDatabase(): Promise<void> {
  console.log('[Database] Initializing Prisma PostgreSQL connection...');
  await connectPrisma();
}
