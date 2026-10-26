import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Owner rule (CLAUDE.md, "Google accounts: we never write to a member's"): nothing in NextChapter writes to a
// member's Google account. Member connections are read-only, so Google itself refuses a write. This test makes the
// rule fail loudly in CI if a write scope or a write helper shows up where a member's credentials could reach it.

const ROOT = join(process.cwd(), 'src')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}
const files = walk(ROOT).map((f) => ({ path: relative(process.cwd(), f), text: readFileSync(f, 'utf8') }))

const SCOPE_RE = /https:\/\/www\.googleapis\.com\/auth\/([a-z0-9._-]+)/g
// Read-only or identity scopes. Anything else is treated as able to write.
const READ_ONLY = new Set(['gmail.readonly', 'calendar.events.readonly', 'calendar.readonly', 'calendar.freebusy', 'documents.readonly', 'drive.readonly', 'userinfo.email', 'userinfo.profile'])

// Files that hold a write scope, each reviewed and each using NextChapter's own team accounts or a coach's own
// account, never a member's credentials. Adding a file here needs the owner's approval.
const REVIEWED_WRITE_SCOPE_FILES: Record<string, string> = {
  'src/lib/google/oauth.ts': 'NextChapter team Gmail send and Calendar (admin client)',
  'src/app/api/google/oauth/callback/route.ts': 'checks the team connection granted its scopes',
  'src/app/api/admin/google-calendar/callback/route.ts': 'team Calendar connection for webinars',
  'src/lib/webinars/admin-calendar-oauth.ts': 'team Calendar connection for webinars',
  'src/lib/coach/google/config.ts': "a coach's own calendar, for session booking",
  'src/lib/syndication/google-indexing-server.ts': "tells Google about our own public pages; no member's account",
}

const writeScopes = (text: string) => [...text.matchAll(SCOPE_RE)].map((m) => m[1]).filter((s) => !READ_ONLY.has(s))

// Where a member's Google credentials are used.
const MEMBER_FACING = (p: string) =>
  p.startsWith('src/lib/email-tracking/') || p.startsWith('src/lib/calendar-tracking/') || p === 'src/lib/onboarding/join-oauth.ts' || p === 'src/lib/google/grant.ts' ||
  p.startsWith('src/app/api/auth/') || p.startsWith('src/app/dashboard/') || p.startsWith('src/app/onboarding/')

// Helpers that write to a Google account. Member-facing code must never call them.
const WRITE_HELPERS = ['sendGmailMessage', 'markMessageRead', 'createMeetEvent', 'deleteCalendarEvent', 'moveCalendarEvent', 'createReminderEvent', 'createCoachMeetEvent', 'moveCoachEvent', 'deleteCoachEvent']
// Gmail and Calendar write endpoints.
const WRITE_ENDPOINTS = /gmail\/v1\/users\/[^'"`\s]*\/(messages\/send|drafts|labels|messages\/batchModify|messages\/[^'"`\s/]+\/(modify|trash|untrash)|threads\/[^'"`\s/]+\/(modify|trash|untrash))|calendar\/v3\/calendars\/[^'"`\s]*\/events[^'"`\s]*\/(move|quickAdd|import)/

describe('member Google connections are read-only', () => {
  it('requests only read-only or identity scopes anywhere a member can be sent to Google', () => {
    const bad = files.filter((f) => MEMBER_FACING(f.path)).flatMap((f) => writeScopes(f.text).map((s) => `${f.path}: ${s}`))
    expect(bad, 'A member-facing file names a Google write scope. Members are never asked to let us write to Google.').toEqual([])
  })

  it('keeps every write scope inside the reviewed team, coach and indexing files', () => {
    const outside = files.filter((f) => writeScopes(f.text).length > 0 && !(f.path in REVIEWED_WRITE_SCOPE_FILES)).map((f) => `${f.path}: ${writeScopes(f.text).join(', ')}`)
    expect(outside, 'A write scope appeared in a file nobody has reviewed. See CLAUDE.md, "Google accounts". Do not add it to the list without the owner.').toEqual([])
  })

  it('lists only files that still exist and still hold a write scope, so the list cannot go stale', () => {
    const byPath = new Map(files.map((f) => [f.path, f.text]))
    const stale = Object.keys(REVIEWED_WRITE_SCOPE_FILES).filter((p) => !byPath.has(p) || writeScopes(byPath.get(p)!).length === 0)
    expect(stale).toEqual([])
  })

  it('never calls a Google write helper from member-facing code', () => {
    const hits = files.filter((f) => MEMBER_FACING(f.path)).flatMap((f) => WRITE_HELPERS.filter((h) => new RegExp(`\\b${h}\\b`).test(f.text)).map((h) => `${f.path}: ${h}`))
    expect(hits, 'Member-facing code calls a helper that writes to Google. Give the member a link, a draft or a download instead.').toEqual([])
  })

  it('never names a Gmail or Calendar write endpoint outside the reviewed files', () => {
    const allowed = new Set(['src/lib/google/gmail.ts', 'src/lib/google/calendar-event.ts', 'src/lib/google/admin-calendar.ts', 'src/lib/coach/google/calendar.ts'])
    const hits = files.filter((f) => WRITE_ENDPOINTS.test(f.text) && !allowed.has(f.path)).map((f) => f.path)
    expect(hits).toEqual([])
  })

  it('the member-facing consent screens ask for exactly the read-only scopes', async () => {
    const { joinScopes } = await import('@/lib/onboarding/join-oauth')
    expect(joinScopes().sort()).toEqual(['email', 'https://www.googleapis.com/auth/calendar.events.readonly', 'https://www.googleapis.com/auth/gmail.readonly', 'openid', 'profile'])
  })
})

describe('the privacy policy states the promise', () => {
  it('says we never write to a member Google account, and that members are never asked for write permission', () => {
    const policy = files.find((f) => f.path === 'src/app/privacy-policy/page.tsx')!.text.replace(/\s+/g, ' ')
    expect(policy).toContain('We never write to your Google account')
    expect(policy).toContain('we never ask members for permission to write to Google')
    expect(policy).toContain('we never send email from your address')
  })
})
