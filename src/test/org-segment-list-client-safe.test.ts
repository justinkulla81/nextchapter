import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// EditionRecipientsTable is a client component. If it (or the list it imports) pulls in prisma, the browser throws on load and the
// mailing edition page shows "This page didn't load" (2026-11-11).
describe('org segment list stays client-safe', () => {
  it('org-segment-list.ts does not import prisma', () => {
    expect(readFileSync('src/lib/mailing/org-segment-list.ts', 'utf8')).not.toMatch(/prisma/)
  })
  it('the client table imports the list, not the database module', () => {
    const src = readFileSync('src/components/admin/mailing/EditionRecipientsTable.tsx', 'utf8')
    expect(src).toContain("'@/lib/mailing/org-segment-list'")
    expect(src).not.toContain("'@/lib/mailing/org-segments'")
  })
})
