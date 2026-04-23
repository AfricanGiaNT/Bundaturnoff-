import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hashPassword } from '../lib/session'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const hash = await hashPassword('admin123')

  const user = await prisma.user.upsert({
    where: { username: 'admin' },
    create: {
      username: 'admin',
      display_name: 'Admin',
      role: 'OWNER',
      entity: 'BOTH',
      password_hash: hash,
      is_active: true,
    },
    update: {
      password_hash: hash,
      role: 'OWNER',
      is_active: true,
    },
  })

  console.log(`✓ Admin user ready: username=admin  password=admin123  (id=${user.id})`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
