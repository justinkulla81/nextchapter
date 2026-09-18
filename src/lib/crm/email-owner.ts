import 'server-only'
import { prisma } from '@/lib/prisma'
import { canonicalGmail, normalizeEmail } from './sync-matching'

/**
 * One email address belongs to one person.
 *
 * Enforced here, in the application, rather than by a database constraint:
 * a person holds addresses in two places (`email`, and the `emails` list),
 * and Postgres can't put a uniqueness rule across the elements of an array.
 * So every path that attaches an address to someone — Add Email, quick add,
 * CSV import, the email sync, the CHRO sync — asks this first.
 *
 * "Same address" means the same mailbox: case-insensitive everywhere, and
 * for Gmail, dots and +tags ignored (j.smith+crm@gmail.com is
 * jsmith@gmail.com). Other providers treat dots as significant, so only
 * Gmail is collapsed — see canonicalGmail.
 */
export function canonicalEmail(raw: string | null | undefined): string | null {
  const e = normalizeEmail(raw)
  return e ? canonicalGmail(e) : null
}

export interface EmailOwner {
  id: string
  fullName: string
  deleted: boolean
}

export async function findEmailOwner(
  raw: string | null | undefined,
  opts: { excludePersonId?: string; includeDeleted?: boolean } = {},
): Promise<EmailOwner | null> {
  const canon = canonicalEmail(raw)
  if (!canon) return null
  const rows = await prisma.$queryRaw<{ id: string; fullName: string; deletedAt: Date | null }[]>`
    SELECT p.id, p."fullName", p."deletedAt"
    FROM "CrmPerson" p
    WHERE (${opts.excludePersonId ?? null}::text IS NULL OR p.id <> ${opts.excludePersonId ?? null})
      AND (${opts.includeDeleted ?? false} OR p."deletedAt" IS NULL)
      AND EXISTS (
        SELECT 1 FROM unnest(array_append(p.emails, p.email)) AS e(addr)
        WHERE addr IS NOT NULL AND (
          CASE WHEN lower(split_part(trim(addr), '@', 2)) IN ('gmail.com', 'googlemail.com')
            THEN regexp_replace(split_part(split_part(lower(trim(addr)), '@', 1), '+', 1), '\\.', '', 'g') || '@gmail.com'
            ELSE lower(trim(addr))
          END
        ) = ${canon}
      )
    -- A live owner is the one that matters; a deleted one only when asked.
    ORDER BY p."deletedAt" NULLS FIRST
    LIMIT 1`
  const r = rows[0]
  return r ? { id: r.id, fullName: r.fullName, deleted: r.deletedAt !== null } : null
}
