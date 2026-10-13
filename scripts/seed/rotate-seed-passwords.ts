/**
 * One-off: replaces the password on every seeded sample account
 * (justin.kulla+N@gmail.com, user_metadata.seeded = true) with a random value.
 *
 * Those accounts were created with a single shared password that was committed
 * to the repo. Nobody needs that password: the accounts are reached through a
 * password-reset email to the plus-addressed inbox. This overwrites it with
 * unrecoverable random strings.
 *
 *   npx tsx --env-file=.env.local scripts/seed/rotate-seed-passwords.ts           # dry run
 *   npx tsx --env-file=.env.local scripts/seed/rotate-seed-passwords.ts --apply
 *
 * Only touches users whose metadata says seeded: true AND whose email starts
 * with the seed prefix; anything else is skipped and listed.
 */
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const apply = process.argv.includes('--apply')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
  let page = 1
  let matched = 0
  let rotated = 0
  const skipped: string[] = []
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    if (data.users.length === 0) break
    for (const u of data.users) {
      const email = u.email ?? ''
      if (!email.startsWith('justin.kulla+')) continue
      if (u.user_metadata?.seeded !== true) {
        skipped.push(email)
        continue
      }
      matched++
      if (apply) {
        const { error: upErr } = await admin.auth.admin.updateUserById(u.id, { password: randomBytes(24).toString('base64url') })
        if (upErr) throw new Error(`${email}: ${upErr.message}`)
        rotated++
      }
    }
    if (data.users.length < 200) break
    page++
  }
  console.log(`Seeded accounts found: ${matched}`)
  if (skipped.length) console.log(`Skipped (prefix matches but not flagged seeded): ${skipped.join(', ')}`)
  console.log(apply ? `Rotated: ${rotated}` : 'Dry run. Re-run with --apply to rotate.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
