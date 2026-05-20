import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Re-export Prisma types für einfachen Import
export type { Prisma } from '@prisma/client'
export {
  Role,
  Visibility,
  FileFormat,
  MapType,
} from '@prisma/client'

// Supabase DB type placeholder – wird nach `prisma generate` aus den generierten Typen befüllt
export type Database = {
  public: {
    Tables: Record<string, unknown>
    Views: Record<string, unknown>
    Functions: Record<string, unknown>
    Enums: Record<string, unknown>
  }
}
