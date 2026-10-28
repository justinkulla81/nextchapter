import 'server-only'
import { prisma } from '@/lib/prisma'
import { parseView, PARSE_STALE_MS, type ResumeParseState } from '@/lib/resume/parse-view'

// The résumé upload returns as soon as the file is stored; reading it happens afterwards (background-parse.ts).
// The state of that reading lives in CandidateProfile.journeyDetails.resumeParse, so it needs no new column:
// a Resume row exists only once the file has been read, which keeps every "has a résumé" check true to its name.
// Writes are single SQL statements guarded on the attempt id, so a double upload, a retry or a slow old run can
// never overwrite a newer one.

const KEY = 'resumeParse'

export function readParseState(journeyDetails: unknown): ResumeParseState | null {
  const raw = (journeyDetails as Record<string, unknown> | null)?.[KEY]
  return raw && typeof raw === 'object' ? (raw as ResumeParseState) : null
}

export async function loadParseView(profileId: string) {
  const p = await prisma.candidateProfile.findUnique({ where: { id: profileId }, select: { journeyDetails: true } })
  return parseView(readParseState(p?.journeyDetails))
}

/** Starts an attempt unless a fresh one is already running. False means someone else's attempt is in flight. */
export async function claimParse(profileId: string, next: ResumeParseState): Promise<boolean> {
  const json = JSON.stringify(next)
  const n = await prisma.$executeRaw`
    UPDATE "CandidateProfile"
    SET "journeyDetails" = jsonb_set(COALESCE("journeyDetails", '{}'::jsonb), '{resumeParse}', ${json}::jsonb)
    WHERE "id" = ${profileId}
      AND NOT COALESCE(
        "journeyDetails" -> 'resumeParse' ->> 'status' = 'processing'
        AND ("journeyDetails" -> 'resumeParse' ->> 'startedAt')::timestamptz > now() - make_interval(secs => ${PARSE_STALE_MS / 1000}),
        false
      )`
  return n > 0
}

/** Records progress or an outcome for one attempt; ignored if a newer attempt has taken over. */
export async function updateParse(profileId: string, attempt: string, patch: Partial<ResumeParseState>): Promise<boolean> {
  const json = JSON.stringify(patch)
  const n = await prisma.$executeRaw`
    UPDATE "CandidateProfile"
    SET "journeyDetails" = jsonb_set("journeyDetails", '{resumeParse}', ("journeyDetails" -> 'resumeParse') || ${json}::jsonb)
    WHERE "id" = ${profileId} AND "journeyDetails" -> 'resumeParse' ->> 'attempt' = ${attempt}`
  return n > 0
}

/** Clears the state. With an attempt id only that attempt's state goes; without one (the member starting over) any does. */
export async function clearParse(profileId: string, attempt?: string): Promise<void> {
  if (attempt) {
    await prisma.$executeRaw`
      UPDATE "CandidateProfile" SET "journeyDetails" = "journeyDetails" - 'resumeParse'
      WHERE "id" = ${profileId} AND "journeyDetails" -> 'resumeParse' ->> 'attempt' = ${attempt}`
  } else {
    await prisma.$executeRaw`
      UPDATE "CandidateProfile" SET "journeyDetails" = "journeyDetails" - 'resumeParse'
      WHERE "id" = ${profileId} AND "journeyDetails" ? 'resumeParse'`
  }
}
