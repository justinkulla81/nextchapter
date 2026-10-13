// One-time (and rotation) backfill: encrypts OAuth access/refresh tokens that
// are still plaintext in Postgres. Idempotent — rows already carrying the
// "enc:v1:" prefix are skipped unless --reencrypt is passed (key rotation:
// decrypts with KEY or KEY_PREVIOUS, writes back under KEY).
//
//   npx tsx --env-file=.env.local scripts/encrypt-oauth-tokens.ts            # dry run
//   npx tsx --env-file=.env.local scripts/encrypt-oauth-tokens.ts --apply
//   npx tsx --env-file=.env.local scripts/encrypt-oauth-tokens.ts --apply --reencrypt
//
// Uses a raw PrismaClient on purpose: the app client's extension would
// transparently decrypt on read and hide which rows are still plaintext.
import { PrismaClient } from '@prisma/client'
import { currentKey, decryptToken, encryptToken, isEncryptedToken } from '../src/lib/security/token-crypto'

const apply = process.argv.includes('--apply')
const reencrypt = process.argv.includes('--reencrypt')

const TARGETS = [
  { delegate: 'emailConnection', fields: ['accessToken', 'refreshToken'] },
  { delegate: 'calendarConnection', fields: ['accessToken', 'refreshToken'] },
  { delegate: 'googleInboxConnection', fields: ['accessToken', 'refreshToken'] },
  { delegate: 'adminGoogleCalendarConnection', fields: ['accessToken', 'refreshToken'] },
  { delegate: 'linkedInConnection', fields: ['accessToken'] },
] as const

async function main() {
  if (!currentKey()) {
    console.error('TOKEN_ENCRYPTION_KEY is missing or not 32 bytes (base64 or 64 hex). Nothing to do.')
    process.exit(1)
  }
  const prisma = new PrismaClient()
  // Prisma's per-model delegates have distinct types; the loop only needs the
  // two methods below, so they are reached dynamically.
  type Row = Record<string, unknown> & { id: string }
  type Delegate = {
    findMany(): Promise<Row[]>
    update(a: { where: { id: string }; data: Record<string, string> }): Promise<unknown>
  }
  let total = 0
  for (const t of TARGETS) {
    const delegate = (prisma as unknown as Record<string, Delegate>)[t.delegate]
    const rows = await delegate.findMany()
    let changed = 0
    for (const row of rows) {
      const data: Record<string, string> = {}
      for (const f of t.fields) {
        const v = row[f]
        if (typeof v !== 'string' || !v) continue
        if (isEncryptedToken(v) && !reencrypt) continue
        const plain = isEncryptedToken(v) ? decryptToken(v) : v
        const out = encryptToken(plain)
        // Round-trip check before anything is written.
        if (decryptToken(out) !== plain) throw new Error(`Round-trip failed for ${t.delegate}.${f} ${row.id}`)
        data[f] = out
      }
      if (Object.keys(data).length === 0) continue
      changed++
      if (apply) await delegate.update({ where: { id: row.id }, data })
    }
    total += changed
    console.log(`${t.delegate}: ${rows.length} rows, ${changed} ${apply ? 'encrypted' : 'would be encrypted'}`)
  }
  console.log(apply ? `Done — ${total} rows updated.` : `Dry run — ${total} rows would change. Re-run with --apply.`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
