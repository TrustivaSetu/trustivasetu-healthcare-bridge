/**
 * One-shot: ensure Postgres is up, migrate, seed.
 * Starts embedded Postgres in background if nothing listens on 5432.
 */
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const DATABASE_URL =
  'postgresql://trustiva:trustiva@127.0.0.1:5432/trustiva_lms?schema=public'

process.chdir(root)

async function canConnect() {
  try {
    const { default: pg } = await import('pg')
    const client = new pg.Client({ connectionString: DATABASE_URL })
    await client.connect()
    await client.query('SELECT 1')
    await client.end()
    return true
  } catch {
    return false
  }
}

function startEmbeddedBackground() {
  const log = join(root, '.pgdata', 'server.log')
  const child = spawn(process.execPath, ['scripts/pg-server.mjs'], {
    cwd: root,
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
    windowsHide: true,
  })
  child.unref()
  console.log(`Started embedded PostgreSQL (pid ${child.pid}). Log: ${log}`)
}

async function waitForDb(maxSeconds = 90) {
  for (let i = 0; i < maxSeconds; i++) {
    if (await canConnect()) return true
    await new Promise((r) => setTimeout(r, 1000))
    if (i % 5 === 4) console.log(`Waiting for database... (${i + 1}s)`)
  }
  return false
}

console.log('Trustiva LMS — database setup\n')

if (!(await canConnect())) {
  console.log('No database on port 5432. Starting embedded PostgreSQL...')
  if (!existsSync(join(root, 'node_modules', 'embedded-postgres'))) {
    console.error('Run: npm install')
    process.exit(1)
  }
  startEmbeddedBackground()
  if (!(await waitForDb())) {
    console.error(
      'Database did not start. Try manually: node scripts/pg-server.mjs'
    )
    process.exit(1)
  }
} else {
  console.log('Database already running.')
}

console.log('Running migrations...')
execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL } })

console.log('Seeding demo data...')
execSync('npm run db:seed', { stdio: 'inherit', env: { ...process.env, DATABASE_URL } })

console.log('\nDone. Database is ready.')
console.log('Super Admin credentials are managed via SUPER_ADMIN_PASSWORD env variable (see prisma/seed.ts).')
console.log('Run: npm run dev')
