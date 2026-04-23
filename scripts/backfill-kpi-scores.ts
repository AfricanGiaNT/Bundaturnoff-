import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { calculateOverallScore, getRatingBand } from '../lib/kpi-weights'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const records = await prisma.employeeKPI.findMany({
    where: { overall_score: null },
    include: { user: { select: { role: true } } },
  })

  console.log(`Found ${records.length} records to backfill`)
  let updated = 0

  for (const record of records) {
    const score = calculateOverallScore(record as unknown as Record<string, unknown>, record.user.role)
    if (score === 0) continue // no metric data — skip

    const band = getRatingBand(score)
    await prisma.employeeKPI.update({
      where: { id: record.id },
      data: { overall_score: score, rating_band: band },
    })
    updated++
  }

  console.log(`Backfilled ${updated} records. Done.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
