import { PrismaClient } from '../../generated/prisma';

declare global {
  // Prevent multiple instances of Prisma Client in development (hot reload)
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export async function connectPrisma(): Promise<void> {
  try {
    await prisma.$connect();
    console.log(' [Database] Prisma successfully connected to PostgreSQL (Supabase)');
  } catch (error) {
    console.error(' [Database] Failed to connect to PostgreSQL via Prisma:', error);
    // Do not crash immediately to allow offline / local testing if configured
  }
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

export default prisma;
