import { Prisma } from '@prisma/client'
import { isRoleAddress } from '@/lib/email/generic-address'

// Owner, 2026-11-24: generic mailboxes (info@, careers@, hr@ ...) are never stored on a CRM contact. They reach a shared inbox, not the
// person, and they were found on mailing lists as "people" named "Info" or "Main office". Every write to CrmPerson goes through this
// extension, so every way in (imports, Gmail sync, Hunter, the capture endpoint, the contact form, scripts) drops the address: the
// person is still saved, with no email, and a direct address can be added later.

const isGeneric = (v: unknown): v is string => typeof v === 'string' && v.includes('@') && isRoleAddress(v)

/** A single-address field: a string, or Prisma's `{ set: string }`. A generic address becomes null. */
function cleanOne(v: unknown): unknown {
  if (isGeneric(v)) return null
  if (v && typeof v === 'object' && 'set' in v && isGeneric((v as { set: unknown }).set)) return { ...v, set: null }
  return v
}

/** The `emails` list: an array, `{ set: [...] }` or `{ push: x | [...] }`. Generic addresses are dropped. */
function cleanList(v: unknown): unknown {
  const keep = (xs: unknown[]) => xs.filter((x) => !isGeneric(x))
  if (Array.isArray(v)) return keep(v)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (Array.isArray(o.set)) return { ...o, set: keep(o.set) }
    if ('push' in o) {
      const pushed = Array.isArray(o.push) ? keep(o.push) : isGeneric(o.push) ? [] : o.push
      if (Array.isArray(pushed) && pushed.length === 0) {
        const rest = { ...o }
        delete rest.push
        return Object.keys(rest).length ? rest : undefined
      }
      return { ...o, push: pushed }
    }
  }
  return v
}

export function cleanPersonData(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data
  if (Array.isArray(data)) return data.map(cleanPersonData)
  const row = { ...(data as Record<string, unknown>) }
  for (const f of ['email', 'guessedEmail'] as const) if (f in row) row[f] = cleanOne(row[f])
  if ('emails' in row) {
    const v = cleanList(row.emails)
    if (v === undefined) delete row.emails
    else row.emails = v
  }
  return row
}

export const genericEmailExtension = Prisma.defineExtension({
  name: 'crm-no-generic-email',
  query: {
    crmPerson: {
      async $allOperations({ operation, args, query }) {
        const a = { ...(args as Record<string, unknown>) }
        if (operation === 'upsert') {
          a.create = cleanPersonData(a.create)
          a.update = cleanPersonData(a.update)
        } else if (['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn'].includes(operation)) {
          a.data = cleanPersonData(a.data)
        }
        return query(a as typeof args)
      },
    },
  },
})
