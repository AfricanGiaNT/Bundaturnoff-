import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashPassword } from '../lib/session'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const INITIAL_USERS = [
  { username: 'director',     display_name: 'Operations Director',      role: 'OPERATIONS_DIRECTOR',      entity: 'BOTH',         password: 'changeme123' },
  { username: 'fuel_mgr',     display_name: 'Fuel Station Manager',     role: 'FUEL_MANAGER',             entity: 'FUEL_STATION', password: 'changeme123' },
  { username: 'construction', display_name: 'Construction Coordinator', role: 'CONSTRUCTION_COORDINATOR', entity: 'CONSTRUCTION', password: 'changeme123' },
  { username: 'hr',           display_name: 'HR Officer',               role: 'HR',                       entity: 'BOTH',         password: 'changeme123' },
  { username: 'accountant',   display_name: 'Accountant',               role: 'ACCOUNTANT',               entity: 'BOTH',         password: 'changeme123' },
  { username: 'warehouse',    display_name: 'Warehouse Clerk',          role: 'WAREHOUSE',                entity: 'FUEL_STATION', password: 'changeme123' },
  { username: 'qa',           display_name: 'QA Officer',               role: 'QA',                       entity: 'BOTH',         password: 'changeme123' },
  { username: 'pump1',        display_name: 'Pump Attendant',           role: 'PUMP_ATTENDANT',           entity: 'FUEL_STATION', password: 'changeme123' },
  { username: 'siteworker1',  display_name: 'Site Worker',              role: 'SITE_WORKER',              entity: 'CONSTRUCTION', password: 'changeme123' },
]

async function main() {
  for (const u of INITIAL_USERS) {
    const hash = await hashPassword(u.password)
    await prisma.user.upsert({
      where: { username: u.username },
      create: {
        username: u.username,
        display_name: u.display_name,
        role: u.role,
        entity: u.entity,
        password_hash: hash,
      },
      update: {},
    })
    console.log(`Seeded: ${u.username} (${u.role})`)
  }
  console.log('Done. All users seeded with password: changeme123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
