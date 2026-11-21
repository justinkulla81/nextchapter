import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/email/resend-client', () => ({ createResend: vi.fn() }))
import { dailyDelta, rowBytes } from '@/lib/perf/egress-watch'

describe('egress watch', () => {
  it('counts a full posting text read as wide, a clipped one as clipped, others as narrow', () => {
    expect(rowBytes('SELECT "id", "description" FROM "ExclusiveJobPosting"')).toBe(5000)
    expect(rowBytes('SELECT id, left(description, $1) AS d FROM "ExclusiveJobPosting"')).toBe(1200)
    expect(rowBytes('SELECT "companyName", left("description", $4) AS "description" FROM (SELECT "companyName", "description", row_number() OVER () FROM x) s')).toBe(1200)
    expect(rowBytes('SELECT "id", "title" FROM "BoardLightRow"')).toBe(250)
    expect(rowBytes('SELECT id FROM "ExclusiveJobPosting" WHERE cardinality("aiSkillGroups") > $3')).toBe(40)
    expect(rowBytes('SELECT "public"."BoardLightRow"."id" FROM "public"."BoardLightRow" WHERE 1=1')).toBe(250)
  })
  it('measures a plain select from the column widths, and falls back when it cannot', () => {
    const widths = new Map([
      ['MailingListMember', new Map([['id', 26], ['email', 28], ['listId', 26]])],
      ['ExclusiveJobPosting', new Map([['id', 26], ['lastVerifiedAt', 8], ['description', 1800]])],
    ])
    // Prisma's form: 8 + (26 + 4) + (28 + 4)
    expect(rowBytes('SELECT "public"."MailingListMember"."id", "public"."MailingListMember"."email" FROM "public"."MailingListMember" WHERE $2=$3 OFFSET $1', widths)).toBe(70)
    // Raw SQL, unquoted column
    expect(rowBytes('SELECT id, "lastVerifiedAt" FROM "ExclusiveJobPosting" WHERE status = $1', widths)).toBe(50)
    // Posting text keeps its fixed size (pg_stats holds the compressed width)
    expect(rowBytes('SELECT "id", "description" FROM "ExclusiveJobPosting" WHERE id = $1', widths)).toBe(5000)
    // A short description column (a mailing list's) is measured, not counted as a posting
    const lists = new Map([['MailingList', new Map([['id', 26], ['key', 14], ['description', 90]])]])
    expect(rowBytes('SELECT "public"."MailingList"."id", "public"."MailingList"."key", "public"."MailingList"."description" FROM "public"."MailingList" WHERE 1=1', lists)).toBe(8 + 30 + 18 + 94)
    // A table with no statistics, a CTE, or a subquery in the list: the fixed sizes
    expect(rowBytes('SELECT "id", "title" FROM "BoardLightRow"', widths)).toBe(250)
    expect(rowBytes('WITH r AS (SELECT id FROM "MailingListMember") SELECT email FROM "MailingListMember"', widths)).toBe(250)
    expect(rowBytes('SELECT email, (SELECT 1 FROM x) FROM "MailingListMember"', widths)).toBe(250)
  })
  it('takes rows since the snapshot, and all of them after a reset or for a new statement', () => {
    const d = dailyDelta(
      [
        { queryid: 'a', rows: 1_000_000, calls: 10, query: 'SELECT "title"' },
        { queryid: 'b', rows: 50, calls: 1, query: 'SELECT "title"' },
        { queryid: 'c', rows: 400, calls: 2, query: 'SELECT "description"' },
      ],
      { a: { rows: 600_000, calls: 4 }, b: { rows: 900, calls: 9 } }
    )
    expect(d.find((x) => x.queryid === 'a')?.deltaRows).toBe(400_000)
    expect(d.find((x) => x.queryid === 'b')?.deltaRows).toBe(50)
    expect(d.find((x) => x.queryid === 'c')?.deltaRows).toBe(400)
    expect(d[0].queryid).toBe('a')
  })
})
