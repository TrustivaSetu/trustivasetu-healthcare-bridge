/**
 * Local PostgreSQL (no Docker). Keeps running until stopped.
 * Stop: taskkill /F /IM postgres.exe (or close this terminal)
 */
import EmbeddedPostgres from 'embedded-postgres'
import { existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const pgData = join(root, '.pgdata')

if (!existsSync(pgData)) mkdirSync(pgData, { recursive: true })

const pg = new EmbeddedPostgres({
  databaseDir: pgData,
  user: 'trustiva',
  password: 'trustiva',
  port: 5432,
  persistent: true,
})

console.log('Starting embedded PostgreSQL on port 5432...')

// Only run initdb on first-time setup; skip if cluster already exists
const alreadyInitialised = existsSync(join(pgData, 'PG_VERSION'))
if (!alreadyInitialised) {
  await pg.initialise()
  await pg.start()
  try {
    await pg.createDatabase('trustiva_lms')
    console.log('Created database trustiva_lms')
  } catch {
    console.log('Database trustiva_lms already exists')
  }
} else {
  console.log('Existing cluster detected — skipping initdb')
  await pg.start()
  console.log('Database trustiva_lms already exists')
}

console.log('PostgreSQL ready.')
console.log('DATABASE_URL=postgresql://trustiva:trustiva@127.0.0.1:5432/trustiva_lms?schema=public')
console.log('Leave this process running. Press Ctrl+C to stop.')

const shutdown = async () => {
  console.log('Stopping PostgreSQL...')
  await pg.stop()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// Keep process alive
setInterval(() => {}, 60_000)
