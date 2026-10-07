import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Neon is far from local dev machines; give interactive transactions enough time.
export const TX_OPTS = { maxWait: 10000, timeout: 20000 } as const;