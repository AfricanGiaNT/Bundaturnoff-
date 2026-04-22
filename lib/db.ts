import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Shared row types so every API route has explicit annotations
// (avoids implicit-any in Promise.all destructuring on strict builds)
import type { StaffRegistry, WeeklySales } from '@prisma/client'
export type DbStaffRow = StaffRegistry
export type DbSalesRow = WeeklySales
