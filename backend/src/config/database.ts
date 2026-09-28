import { prisma, connectPrisma, disconnectPrisma } from '../database/prisma';

export { prisma, connectPrisma, disconnectPrisma };
export const db = prisma;
