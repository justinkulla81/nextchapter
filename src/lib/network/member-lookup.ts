import 'server-only'
import { prisma } from '@/lib/prisma'
import { listAllAuthUsers } from '@/lib/admin/auth-users'
import type { NextChapterMembership } from '@/lib/network/next-chapter-membership'

// A candidate's own view of "who in my contacts is already on the
// platform" — deliberately looser than the Recruiter Database's
// candidate-visibility gate, since this only confirms membership (a badge),
// it never reveals grade/profile detail. Candidates are matched only when
// their privacy tier is at least as open as what already shows up in peer
// surfaces like Support Network groups (see community/groups.ts's
// VISIBLE_TIERS) — a STEALTH or LOCKED candidate stays invisible here too.
const CANDIDATE_VISIBLE_TIERS = ['PUBLIC', 'SEMI_PUBLIC'] as const

function lowerEmails(emails: (string | null)[]): string[] {
  return Array.from(new Set(emails.filter((e): e is string => !!e).map((e) => e.toLowerCase())))
}

// Caps the size of each `email IN (...)` query below. A candidate's Contact
// Directory can hold 27,000+ imported LinkedIn contacts, and the "On
// NextChapter" filter used to pass every matching email into one unbounded
// query here — chunking keeps each query's IN-list a fixed, reasonable size
// while still resolving membership for the full input list (just in
// parallel batches instead of one query per size N).
const LOOKUP_CHUNK_SIZE = 2000

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

// Looks up each given email against candidate, coach, recruiter, and hiring
// manager accounts and returns a map keyed by lowercased email. Coaches and
// recruiters store their login email directly (workEmail); hiring managers
// (EmployerProfile) don't, so those are matched via the same bulk
// auth-directory fetch the admin pages already use rather than an
// admin.getUserById call per contact.
export async function lookupNextChapterMemberships(
  emails: (string | null)[]
): Promise<Map<string, NextChapterMembership>> {
  const lowered = lowerEmails(emails)
  const result = new Map<string, NextChapterMembership>()
  if (lowered.length === 0) return result

  const [chunkResults, employers] = await Promise.all([
    Promise.all(
      chunk(lowered, LOOKUP_CHUNK_SIZE).map((batch) =>
        Promise.all([
          prisma.candidateProfile.findMany({
            where: { email: { in: batch, mode: 'insensitive' }, privacyTier: { in: [...CANDIDATE_VISIBLE_TIERS] } },
            select: { email: true },
          }),
          prisma.coach.findMany({ where: { workEmail: { in: batch, mode: 'insensitive' } }, select: { workEmail: true } }),
          prisma.recruiter.findMany({ where: { workEmail: { in: batch, mode: 'insensitive' } }, select: { workEmail: true } }),
        ])
      )
    ),
    prisma.employerProfile.findMany({ select: { userId: true } }),
  ])

  for (const [candidates, coaches, recruiters] of chunkResults) {
    for (const c of candidates) {
      if (c.email) result.set(c.email.toLowerCase(), 'CANDIDATE')
    }
    for (const c of coaches) result.set(c.workEmail.toLowerCase(), 'COACH')
    for (const r of recruiters) result.set(r.workEmail.toLowerCase(), 'RECRUITER')
  }

  if (employers.length > 0) {
    const authUsers = await listAllAuthUsers()
    const employerUserIds = new Set(employers.map((e) => e.userId))
    for (const user of authUsers.values()) {
      if (user.email && employerUserIds.has(user.id)) {
        result.set(user.email.toLowerCase(), 'HIRING_MANAGER')
      }
    }
  }

  return result
}
