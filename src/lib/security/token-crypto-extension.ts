import { Prisma } from '@prisma/client'
import { decryptToken, encryptToken, isEncryptedToken } from './token-crypto'

// Prisma client extension: encrypts OAuth token columns on write and decrypts
// them on read, so none of the ~50 call sites that use these connections
// change. Models below are the only ones whose accessToken/refreshToken are
// OAuth secrets — Coach.accessToken / Recruiter.accessToken are URL bearer
// tokens that are looked up by value and must stay as they are.
const ENCRYPTED_MODELS = new Set([
  'EmailConnection',
  'CalendarConnection',
  'LinkedInConnection',
  'GoogleInboxConnection',
  'AdminGoogleCalendarConnection',
])
const FIELDS = ['accessToken', 'refreshToken'] as const

function encryptData(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(encryptData)
  if (!data || typeof data !== 'object') return data
  const out: Record<string, unknown> = { ...(data as Record<string, unknown>) }
  for (const f of FIELDS) {
    const v = out[f]
    if (typeof v === 'string') out[f] = encryptToken(v)
    else if (v && typeof v === 'object' && typeof (v as { set?: unknown }).set === 'string') {
      out[f] = { ...(v as object), set: encryptToken((v as { set: string }).set) }
    }
  }
  return out
}

function encryptArgs(args: Record<string, unknown>): Record<string, unknown> {
  const next = { ...args }
  for (const k of ['data', 'create', 'update']) if (k in next) next[k] = encryptData(next[k])
  return next
}

function decryptDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    value.forEach(decryptDeep)
    return value
  }
  if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return value
  const obj = value as Record<string, unknown>
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if ((k === 'accessToken' || k === 'refreshToken') && isEncryptedToken(v)) obj[k] = decryptToken(v)
    else if (v && typeof v === 'object') decryptDeep(v)
  }
  return value
}

// Only walk results that can contain a token: a connection model itself, or a
// query that pulls a relation (include / nested select), e.g.
// EmailMessage.connection. Scalar-only list queries skip the walk entirely.
function mayReachTokens(model: string, args: Record<string, unknown>): boolean {
  if (ENCRYPTED_MODELS.has(model)) return true
  if (args.include) return true
  const sel = args.select
  return !!sel && typeof sel === 'object' && Object.values(sel as object).some((v) => v && typeof v === 'object')
}

// Exported for unit tests.
export const __internals = { encryptArgs, decryptDeep, mayReachTokens }

export const tokenCryptoExtension = Prisma.defineExtension({
  name: 'oauth-token-crypto',
  query: {
    $allModels: {
      async $allOperations({ model, args, query }) {
        let a = args as Record<string, unknown>
        if (ENCRYPTED_MODELS.has(model)) a = encryptArgs(a)
        const result = await query(a)
        return mayReachTokens(model, a) ? decryptDeep(result) : result
      },
    },
  },
})
