// src/lib/seed-schemes.ts
// Run once: npx ts-node src/lib/seed-schemes.ts
// Or add to prisma/seed.ts

import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

const DEFAULT_SCHEMES = [
  { name: '3/0',   tenure: 3,  advanceEmi: 0 },
  { name: '4/1',   tenure: 4,  advanceEmi: 1 },
  { name: '5/0',   tenure: 5,  advanceEmi: 0 },
  { name: '6/0',   tenure: 6,  advanceEmi: 0 },
  { name: '6/1',   tenure: 6,  advanceEmi: 1 },
  { name: '8/0',   tenure: 8,  advanceEmi: 0 },
  { name: '8/2',   tenure: 8,  advanceEmi: 2 },
  { name: '9/0',   tenure: 9,  advanceEmi: 0 },
  { name: '9/3',   tenure: 9,  advanceEmi: 3 },
  { name: '10/0',  tenure: 10, advanceEmi: 0 },
  { name: '10/2',  tenure: 10, advanceEmi: 2 },
  { name: '10/3',  tenure: 10, advanceEmi: 3 },
  { name: '12/0',  tenure: 12, advanceEmi: 0 },
  { name: '12/2',  tenure: 12, advanceEmi: 2 },
  { name: '12/3',  tenure: 12, advanceEmi: 3 },
  { name: '12/4',  tenure: 12, advanceEmi: 4 },
  { name: '18/0',  tenure: 18, advanceEmi: 0 },
  { name: '18/4',  tenure: 18, advanceEmi: 4 },
  { name: '18/6',  tenure: 18, advanceEmi: 6 },
  { name: '24/8',  tenure: 24, advanceEmi: 8 },
  { name: '27/9',  tenure: 27, advanceEmi: 9 },
  { name: '36/12', tenure: 36, advanceEmi: 12 },
]

async function main() {
  for (const s of DEFAULT_SCHEMES) {
    await (db as any).schemeTemplate.upsert({
      where: { name: s.name },
      update: {},
      create: {
        name: s.name,
        tenure: s.tenure,
        advanceEmi: s.advanceEmi,
        balanceEmi: s.tenure - s.advanceEmi,
        isCustom: false,
      },
    })
    console.warn(`✅ Scheme ${s.name} seeded`)
  }
  await db.$disconnect()
}

main().catch(console.error)