import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../app/generated/prisma/client.js'
import bcrypt from 'bcryptjs'

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const passwordHash = await bcrypt.hash('changeme123', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@boxncase.com' },
    update: {},
    create: {
      email: 'admin@boxncase.com',
      name: 'Admin User',
      passwordHash,
      role: 'ADMIN',
    },
  })

  const employee = await prisma.user.upsert({
    where: { email: 'employee@boxncase.com' },
    update: {},
    create: {
      email: 'employee@boxncase.com',
      name: 'Employee User',
      passwordHash,
      role: 'EMPLOYEE',
    },
  })

  console.log({ admin, employee })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
