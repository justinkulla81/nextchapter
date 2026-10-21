import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// Application-layer encryption for third-party OAuth tokens stored in Postgres
// (Gmail/Calendar/LinkedIn access + refresh tokens). Protects against a
// database-only exposure — a leaked DATABASE_URL, a backup, the Supabase SQL
// console — since refresh tokens grant mailbox access that survives password
// changes. The key lives in the app environment, not the database.
//
// Format: "enc:v1:<iv>.<tag>.<ciphertext>" (base64url, AES-256-GCM).
//
// Rollout-safe by design:
//   - Reads accept legacy plaintext (no prefix) and pass it through, so the
//     code can deploy before the backfill runs.
//   - Writes encrypt only when TOKEN_ENCRYPTION_KEY is set; with no key they
//     store plaintext (and the backfill later encrypts), so a missing env var
//     never takes Gmail sync down.
//   - A prefixed value with no usable key THROWS rather than handing the
//     ciphertext to Google as if it were a token.
//
// TOKEN_ENCRYPTION_KEY: 32 bytes as base64 or 64 hex chars
//   (`openssl rand -base64 32`). TOKEN_ENCRYPTION_KEY_PREVIOUS is tried on
// decrypt only, to rotate: set new KEY, move old to PREVIOUS, run the backfill
// with --reencrypt, then drop PREVIOUS.

const PREFIX = 'enc:v1:'

function parseKey(raw: string | undefined): Buffer | null {
  if (!raw) return null
  const v = raw.trim()
  const buf = /^[0-9a-f]{64}$/i.test(v) ? Buffer.from(v, 'hex') : Buffer.from(v, 'base64')
  return buf.length === 32 ? buf : null
}

export function currentKey(): Buffer | null {
  return parseKey(process.env.TOKEN_ENCRYPTION_KEY)
}

export function isEncryptedToken(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

export function encryptToken(plaintext: string): string {
  // Empty means "deleted" (a disconnected Google connection) — nothing secret to encrypt.
  if (plaintext === '' || isEncryptedToken(plaintext)) return plaintext
  const key = currentKey()
  if (!key) return plaintext
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return `${PREFIX}${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ct.toString('base64url')}`
}

export function decryptToken(value: string): string {
  if (!isEncryptedToken(value)) return value
  const [ivB64, tagB64, ctB64, ...rest] = value.slice(PREFIX.length).split('.')
  if (!ivB64 || !tagB64 || !ctB64 || rest.length) throw new Error('Malformed encrypted token')
  const keys = [currentKey(), parseKey(process.env.TOKEN_ENCRYPTION_KEY_PREVIOUS)].filter((k): k is Buffer => !!k)
  if (keys.length === 0) throw new Error('TOKEN_ENCRYPTION_KEY is not set but an encrypted token was read')
  for (const key of keys) {
    try {
      const d = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'))
      d.setAuthTag(Buffer.from(tagB64, 'base64url'))
      return Buffer.concat([d.update(Buffer.from(ctB64, 'base64url')), d.final()]).toString('utf8')
    } catch {
      // try the next key
    }
  }
  throw new Error('Could not decrypt token with the configured key(s)')
}
