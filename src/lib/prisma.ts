import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var dbConnected: boolean | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

let isDbReachable = global.dbConnected !== undefined ? global.dbConnected : false;
let lastCheckTime = 0;

export async function checkDatabaseConnection(): Promise<boolean> {
  const now = Date.now();
  // Cache check result for 30 seconds
  if (now - lastCheckTime < 30000 && global.dbConnected !== undefined) {
    return isDbReachable;
  }

  lastCheckTime = now;
  try {
    // Quick test query with timeout
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 1500)),
    ]);
    isDbReachable = true;
    global.dbConnected = true;
    return true;
  } catch {
    isDbReachable = false;
    global.dbConnected = false;
    return false;
  }
}

// Initial probe in background
checkDatabaseConnection().then((connected) => {
  if (!connected && process.env.NODE_ENV === 'development') {
    console.info('[Prisma] Database offline on localhost:5432. Using fast In-Memory mock for development.');
  }
});

export function isDatabaseOnline(): boolean {
  return isDbReachable;
}

export default prisma;
